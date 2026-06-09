# Festivo → социални мрежи auto-repost бот — дизайн

**Дата:** 2026-06-09
**Статус:** Approved (brainstorming → spec)
**Засегнати repo-та:** `festivo-web` (webhook), `festivo-workers` (worker + миграции)
**Фаза 1 мрежи:** TikTok + Instagram (Reels)

---

## 1. Цел

Намираш клип във Facebook → пращаш линка на Telegram бот → ботът сваля видеото, показва ти preview с inline бутони → избираш мрежи (TikTok и/или Instagram), редактираш описание/хаштагове, публикуваш сега или насрочваш → клипът се качва в Festivo акаунтите през официалните API-та на съответните мрежи.

## 2. Взети решения (от brainstorming)

| Тема | Решение |
|---|---|
| Вход | **Telegram бот** (не Viber) |
| Източник | **FB линк** → worker сваля сам (yt-dlp) |
| Контрол | **Потвърждаваща стъпка + насрочване** (inline бутони) |
| Мрежи (Фаза 1) | **TikTok + Instagram Reels** (избираеми per клип) |
| Качване | **Само официални API-та** (без неофициална автоматизация) |
| Хостинг | Webhook на **Vercel** (festivo-web); тежка работа на **Railway** (festivo-workers) |
| Worker режим | **Cron** (на всеки 1–2 мин), не always-on → ~0 разход |

## 3. Ограничения, които приемаме

- **TikTok unaudited app** качва клиповете като **private/draft**, не публично. След пълен app audit при TikTok → същият код почва да публикува публично, без промяна в кода.
- **Instagram** изисква Business/Creator акаунт, свързан с FB Page, и Meta app review за `instagram_content_publish`. Instagram **дърпа видеото от публичен URL** (не файлово качване) → temp файлът в Storage трябва да е достъпен по публичен/signed URL.
- До ~2 мин lag между „пращане на линк" и „preview" заради cron режима (приемливо).
- `yt-dlp` понякога се чупи при промени във Facebook → трябва периодичен ъпдейт.
- Двата app review-а (TikTok + Meta) текат паралелно; до одобрение — TikTok влиза като draft.
- Правна отговорност за репостване на чуждо съдържание е на оператора.

## 4. Data flow

```
Telegram бот (пращаш FB линк)
   │
   ▼
[Webhook: festivo-web на Vercel]  ── лек, само валидира + записва
   │  insert/update в Supabase (social_repost_jobs)
   ▼
social_repost_jobs (опашка + state machine, targets[])
   │
   ▼
[Cron worker: festivo-workers, на всеки 1–2 мин]
   │  1. claim queued job
   │  2. сваля видеото от FB (yt-dlp)
   │  3. качва файла в Supabase Storage (temp bucket; signed URL за IG)
   │  4. праща preview видео + inline бутони (избор на мрежи) в Telegram
   │  5. чака решение / насрочен час
   │  6. за всяка избрана мрежа → съответния publisher:
   │       ├─ TikTok  → Content Posting API (FILE_UPLOAD)
   │       └─ Instagram → Graph API Content Publishing (pull от signed URL)
   ▼
TikTok + Instagram (Festivo акаунти)
```

**Защо разделение web/worker:** Telegram иска бърз отговор (<секунди) за съобщения и callback от бутони → Vercel webhook само записва ред и връща 200. Сваляне + качване на мегабайти е бавно → Railway worker без timeout.

## 5. State machine на един job

```
queued          → току-що пратен линк
downloading     → worker claim-на и сваля от FB
awaiting_review → preview пратен, чака решение
  ├─ (избор на мрежи: TikTok / Instagram / двете)
  ├─ (редакция на описание/хаштагове)  → остава awaiting_review
  ├─ ✅ Публикувай сега                → publishing
  ├─ 🕒 Насрочи <час>                  → scheduled
  └─ ❌ Откажи                         → cancelled
scheduled       → чака scheduled_at, после → publishing
publishing      → публикува по избраните мрежи (per-target резултат)
published       → готово (per мрежа: published / draft / failed)
failed          → грешка по всички мрежи; ботът праща причината
```

**Per-target резултат:** една job може да успее за TikTok и да се провали за Instagram. Резултатът се пази per мрежа (виж `target_results` в т.6); ботът докладва статуса по мрежи. Retry е per failed target, не за цялата job.

Идемпотентност: всеки преход е guard-нат; dedupe ключ = `source_url + telegram_chat_id`. Claim-ването е атомично (по модела на съществуващите ingest worker-и). Публикуване към вече публикувана мрежа никога не се повтаря.

## 6. Нови Supabase таблици (миграции в `festivo-workers/migrations/`)

### `social_accounts`
Еднократни OAuth връзки към Festivo акаунтите, по една на мрежа.
- `id`, `network` (`tiktok` | `instagram`), `external_id` (open_id / IG business id), `access_token`, `refresh_token` (nullable), `expires_at`, `scope`, `meta` (jsonb — напр. свързан FB Page id за IG), `created_at`, `updated_at`
- Уникалност по `network` (един акаунт per мрежа във Фаза 1).
- Worker refresh-ва токена автоматично преди изтичане.
- RLS: само service role.

### `social_repost_jobs`
Опашката + състояние.
- `id`, `telegram_chat_id`, `telegram_user_id`, `source_url`, `video_storage_path` (nullable до сваляне), `caption` (nullable), `hashtags` (text[] / jsonb), `targets` (text[] — избрани мрежи), `target_results` (jsonb — per мрежа: status, external_post_id, error), `status` (enum от т.5), `scheduled_at` (timestamptz nullable), `dedupe_key`, `error` (text nullable), `created_at`, `updated_at`
- Индекси: `status`, `scheduled_at`, уникален `dedupe_key`.
- RLS: само service role.

### `social_repost_allowed_users`
Whitelist — критично за сигурност (иначе всеки, открил бота, може да публикува в акаунтите).
- `telegram_user_id` (PK), `label`, `created_at`
- Webhook отказва съобщения от user id извън таблицата.

## 7. Компоненти (всеки с една отговорност)

| Компонент | Локация | Отговорност |
|---|---|---|
| Telegram webhook | `festivo-web` → `app/api/telegram/social-bot/route.ts` | Валидира `TELEGRAM_WEBHOOK_SECRET`, проверява whitelist, записва/update-ва job ред (вкл. избор на targets), ack 200 |
| Repost cron worker | `festivo-workers` → `workers/social_repost_worker.js` | Claim → download → upload to Storage → preview → publish per target → token refresh |
| FB downloader | `festivo-workers` → `workers/lib/fb_video_download.js` | Обвива `yt-dlp`; валидира размер/формат/времетраене |
| TikTok publisher | `festivo-workers` → `workers/lib/publishers/tiktok.js` | OAuth refresh + Content Posting API (FILE_UPLOAD) |
| Instagram publisher | `festivo-workers` → `workers/lib/publishers/instagram.js` | Meta OAuth refresh + Graph API Content Publishing (pull от signed URL) |
| Publisher registry | `festivo-workers` → `workers/lib/publishers/index.js` | Мапва `network → publisher`; общ интерфейс `publish(job, account, mediaUrl/file)` |
| Telegram client | `festivo-workers` → `workers/lib/telegram_send.js` | sendVideo, inline keyboard (избор на мрежи), текстови съобщения |

Нов npm script в `festivo-workers/package.json`: `"start:social-repost": "node workers/social_repost_worker.js"`.
Нов Railway cron service (~1–2 мин интервал), по модела на съществуващите worker-и.

**Publisher интерфейс (изолация):** всеки publisher е самостоятелен модул с един метод и ясни зависимости (account токени + медия). Добавяне на нова мрежа във Фаза 2 = нов файл в `publishers/`, без промяна на worker-а.

## 8. Webhook ↔ worker разпределение на отговорностите

Webhook (Vercel) — само бързи, леки операции:
- Нов линк → insert job (`queued`).
- Callback от бутон (избор на мрежи / ✅ / 🕒 / ❌) → update на job (`targets`, `publishing`/`scheduled`/`cancelled`).
- Текстово съобщение в режим редакция → update `caption`/`hashtags`.

Worker (Railway cron) — всичко бавно:
- Сваляне, качване в Storage, signed URL, preview, реалното публикуване per target, refresh на токени, изпълнение на scheduled job-ове щом `scheduled_at <= now()`.

## 9. Външни предпоставки (еднократно, преди код)

**TikTok:**
- Festivo TikTok акаунт + регистриран app в TikTok for Developers (client key/secret + OAuth, video publish scope).

**Instagram:**
- Festivo IG **Business/Creator** акаунт, свързан с **Facebook Page**.
- Meta app + бизнес верификация + app review за `instagram_content_publish`, `instagram_basic`, `pages_show_list`.

**Общи:**
- Telegram бот токен (от @BotFather).
- `yt-dlp` добавен в Railway `Dockerfile` на festivo-workers.
- Нови env vars: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `META_APP_ID`, `META_APP_SECRET`.

## 10. Разходи

| Компонент | Цена/мес |
|---|---|
| Telegram, TikTok API, Instagram Graph API, yt-dlp, Vercel webhook | 0 лв |
| Supabase Storage (temp клипове, трият се след качване) | ~0 лв |
| Railway **cron** worker (опция 2) | ~0 лв (плаща се само времето на изпълнение) |

Общо: практически **0 лв/мес**. Единствената „цена" е TikTok + Meta app review (време) и поддръжка на yt-dlp.

## 11. Сигурност и идемпотентност (по festivo правила)

- Service-role ключове само server-side; никога към клиент.
- Webhook валидира secret + whitelist преди всяко действие.
- Всички job преходи идемпотентни, dedupe ключ, атомичен claim, per-target идемпотентност.
- Токени (TikTok/Meta) никога не се логват.
- Signed URL за IG е краткоживеещ; temp видео файловете се трият от Storage след успешно публикуване (или при cancel/fail cleanup).

## 12. Извън обхвата (YAGNI)

- Multi-tenant (само Festivo акаунти засега) — виж Фаза 2.
- Viber/WhatsApp входове.
- Автоматично генериране на описания с AI (може по-късно).
- YouTube Shorts / Facebook feed постване — виж Фаза 2.

## 13. Фаза 2 (бъдеща, отделна spec) — организаторско auto-posting

Идея: организатор добавя клип към събитие в portal-а → опция „качи автоматично в социалните мрежи" → клипът се публикува в **собствените акаунти на организатора**.

**Преизползва се от Фаза 1:** download/публикуване engine, state machine, publisher registry (TikTok + Instagram вече готови), token store, идемпотентност/dedupe, per-target резултати.

**Ново за Фаза 2 (значимо):**
- Multi-tenant: OAuth връзка **per организатор, per мрежа** (`organizer_social_accounts`), RLS per организатор — никой не публикува от чуждо име.
- Тригер от organizer portal (web бутон при добавяне на клип към събитие), не Telegram.
- Допълнителни мрежи: Facebook feed, YouTube Shorts (Google OAuth) — **всяка нова мрежа = нов publisher + отделен app review**.
- Решение за модерация: дали Festivo review-ва преди публикуване, или организаторът публикува директно.

**Препоръка за реда:** TikTok + Instagram (преизползват Фаза 1 директно), после Facebook/YouTube инкрементално.

Фаза 2 получава собствена spec → plan → implementation цикъл; не блокира Фаза 1.

## 14. Фаза 1.5 (идея, не насрочена) — Telegram → каталог ingestion

**Концепция:** пращаш на същия бот **Facebook пост за фестивал** (с текст + снимка) → ботът го подава за дообработка → попада в `pending_festivals` за admin одобрение. Същият бот, **втори режим** до repost-а.

**Защо се връзва (минимум нов код):** Festivo вече има цялата верига
`ingest_jobs → festivo-workers (scrape + снимка rehost + AI нормализация) → pending_festivals → admin review`.
FB ingestion worker-ът (`fb_ingest_v2_worker.js`) вече вади текст, rehost-ва hero снимка и пуска AI извличане на дати/град/категория. Липсва само входът от Telegram.

**UX:** след пращане на линк, inline избор:
- `🎬 Repost във TikTok/IG` (Фаза 1)
- `🎪 Добави фестивал в каталога` (Фаза 1.5)

**Подходи:**
- **A (препоръчан, минимум код):** ботът вмъква ред в `ingest_jobs (source_type='facebook_event', source_url=<линк>, submitted_via='telegram')`; съществуващият worker прави всичко останало. Нов код = бутон + един insert.
- **B (по-богато AI):** webhook вика endpoint, който пуска Gemini smart research pipeline (`lib/admin/research/`) → pending_row snapshot (geocode + hero) → `ingest_jobs source_type='research'` (както `/admin/research?tab=smart`). За оскъдни линкове, където AI трябва да „доизследва".
- **C (Telegram-native):** пращаш самата снимка + текст (афиш / screenshot) → нов AI extraction слой върху свободен текст → `pending_festivals`. По-универсално, най-много нов код.

**Препоръка:** A като база + B като опционален „🔍 Дообработи с AI" бутон в pending прегледа.

**Запазва moderation-first:** нищо не става публично без admin одобрение (по принципите на проекта). Засяга `festivo-web` (бот режим/админ) + `festivo-workers` (вече готов ingestion). Получава собствена spec → plan, когато се захванем.
