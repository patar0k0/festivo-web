# Festivo → TikTok auto-repost бот — дизайн

**Дата:** 2026-06-09
**Статус:** Approved (brainstorming → spec)
**Засегнати repo-та:** `festivo-web` (webhook), `festivo-workers` (worker + миграции)

---

## 1. Цел

Намираш клип във Facebook → пращаш линка на Telegram бот → ботът сваля видеото, показва ти preview с inline бутони → потвърждаваш / редактираш описание и хаштагове / насрочваш → клипът се качва в TikTok акаунта на Festivo през официалния Content Posting API.

## 2. Взети решения (от brainstorming)

| Тема | Решение |
|---|---|
| Вход | **Telegram бот** (не Viber) |
| Източник | **FB линк** → worker сваля сам (yt-dlp) |
| Контрол | **Потвърждаваща стъпка + насрочване** (inline бутони) |
| TikTok качване | **Официален Content Posting API** (без неофициална автоматизация) |
| Хостинг | Webhook на **Vercel** (festivo-web); тежка работа на **Railway** (festivo-workers) |
| Worker режим | **Cron** (на всеки 1–2 мин), не always-on → ~0 разход |

## 3. Ограничения, които приемаме

- **TikTok unaudited app** качва клиповете като **private/draft**, не публично. След пълен app audit при TikTok → същият код почва да постват публично, без промяна в кода.
- До ~2 мин lag между „пращане на линк" и „preview" заради cron режима (приемливо).
- `yt-dlp` понякога се чупи при промени във Facebook → трябва периодичен ъпдейт.
- Правна отговорност за репостване на чуждо съдържание е на оператора.

## 4. Data flow

```
Telegram бот (пращаш FB линк)
   │
   ▼
[Webhook: festivo-web на Vercel]  ── лек, само валидира + записва
   │  insert/update в Supabase (tiktok_repost_jobs)
   ▼
tiktok_repost_jobs (опашка + state machine)
   │
   ▼
[Cron worker: festivo-workers, на всеки 1–2 мин]
   │  1. claim queued job
   │  2. сваля видеото от FB (yt-dlp)
   │  3. качва файла в Supabase Storage (temp bucket)
   │  4. праща preview видео + inline бутони в Telegram
   │  5. чака решение / насрочен час
   │  6. публикува през TikTok Content Posting API (FILE_UPLOAD)
   ▼
TikTok (Festivo акаунт)
```

**Защо разделение web/worker:** Telegram иска бърз отговор (<секунди) за съобщения и callback от бутони → Vercel webhook само записва ред и връща 200. Сваляне + качване на мегабайти е бавно → Railway worker без timeout.

## 5. State machine на един job

```
queued          → току-що пратен линк
downloading     → worker claim-на и сваля от FB
awaiting_review → preview пратен, чака решение
  ├─ (редакция на описание/хаштагове)  → остава awaiting_review
  ├─ ✅ Публикувай сега                → publishing
  ├─ 🕒 Насрочи <час>                  → scheduled
  └─ ❌ Откажи                         → cancelled
scheduled       → чака scheduled_at, после → publishing
publishing      → качва се в TikTok
published       → готово (или draft при unaudited app)
failed          → грешка; ботът праща причината
```

Идемпотентност: всеки преход е guard-нат; dedupe ключ = `source_url + telegram_chat_id`, за да не дублира при повторно пращане на същия линк. Claim-ването на cron job-ове е атомично (status `queued`/`scheduled` → `downloading`/`publishing` с timestamp), по модела на съществуващите ingest worker-и.

## 6. Нови Supabase таблици (миграции в `festivo-workers/migrations/`)

### `tiktok_accounts`
Еднократна OAuth връзка към Festivo TikTok акаунта.
- `id`, `open_id` (TikTok user id), `access_token`, `refresh_token`, `expires_at`, `scope`, `created_at`, `updated_at`
- Worker refresh-ва токена автоматично преди изтичане.
- RLS: само service role (server-side).

### `tiktok_repost_jobs`
Опашката + състояние.
- `id`, `telegram_chat_id`, `telegram_user_id`, `source_url`, `video_storage_path` (nullable до сваляне), `caption` (nullable), `hashtags` (text[] / jsonb), `status` (enum от т.5), `scheduled_at` (timestamptz nullable), `tiktok_publish_id` (nullable), `error` (text nullable), `dedupe_key`, `created_at`, `updated_at`
- Индекси: `status`, `scheduled_at`, уникален `dedupe_key`.
- RLS: само service role.

### `tiktok_repost_allowed_users`
Whitelist — критично за сигурност (иначе всеки, открил бота, може да постват в TikTok акаунта).
- `telegram_user_id` (PK), `label`, `created_at`
- Webhook отказва съобщения от user id извън таблицата.

## 7. Компоненти (всеки с една отговорност)

| Компонент | Локация | Отговорност |
|---|---|---|
| Telegram webhook | `festivo-web` → `app/api/telegram/tiktok-bot/route.ts` | Валидира `TELEGRAM_WEBHOOK_SECRET`, проверява whitelist, записва/update-ва job ред, ack 200 |
| Repost cron worker | `festivo-workers` → `workers/tiktok_repost_worker.js` | Claim → download → upload to Storage → send preview → publish → token refresh |
| FB downloader | `festivo-workers` → `workers/lib/fb_video_download.js` | Обвива `yt-dlp`; валидира размер/формат/времетраене |
| TikTok client | `festivo-workers` → `workers/lib/tiktok_client.js` | OAuth refresh + Content Posting API (FILE_UPLOAD) |
| Telegram client | `festivo-workers` → `workers/lib/telegram_send.js` | sendVideo, inline keyboard, текстови съобщения |

Нов npm script в `festivo-workers/package.json`: `"start:tiktok-repost": "node workers/tiktok_repost_worker.js"`.
Нов Railway cron service (~1–2 мин интервал), по модела на съществуващите worker-и.

## 8. Webhook ↔ worker разпределение на отговорностите

Webhook (Vercel) — само бързи, леки операции:
- Нов линк → insert job (`queued`).
- Callback от бутон (✅/🕒/❌) → update на job (`publishing`/`scheduled`/`cancelled`).
- Текстово съобщение в режим редакция → update `caption`/`hashtags`.

Worker (Railway cron) — всичко бавно:
- Сваляне, качване в Storage, preview, реалното TikTok публикуване, refresh на токени, изпълнение на scheduled job-ове щом `scheduled_at <= now()`.

## 9. Външни предпоставки (еднократно, преди код)

- TikTok акаунт за Festivo + регистриран app в TikTok for Developers (client key/secret + OAuth, scope за video publish).
- Telegram бот токен (от @BotFather).
- `yt-dlp` добавен в Railway `Dockerfile` на festivo-workers.
- Нови env vars: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`.

## 10. Разходи

| Компонент | Цена/мес |
|---|---|
| Telegram, TikTok API, yt-dlp, Vercel webhook | 0 лв |
| Supabase Storage (temp клипове, трият се след качване) | ~0 лв |
| Railway **cron** worker (опция 2) | ~0 лв (плаща се само времето на изпълнение) |

Общо: практически **0 лв/мес**. Единствената „цена" е TikTok app audit (време) и поддръжка на yt-dlp.

## 11. Сигурност и идемпотентност (по festivo правила)

- Service-role ключове само server-side; никога към клиент.
- Webhook валидира secret + whitelist преди всяко действие.
- Всички job преходи идемпотентни, dedupe ключ, атомичен claim.
- TikTok токени никога не се логват.
- Temp видео файловете се трият от Storage след успешно публикуване (или при cancel/fail cleanup).

## 12. Извън обхвата (YAGNI)

- Multi-tenant (само един Festivo TikTok акаунт засега).
- Viber/WhatsApp входове.
- Автоматично генериране на описания с AI (може по-късно).
- Кросспостване към други платформи (Instagram Reels, YouTube Shorts).
