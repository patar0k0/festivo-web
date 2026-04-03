# Festivo Notification System

## Два слоя (съвместими)

1. **По-стари job маршрути** — пишат директно в `user_notifications`; push през `/api/jobs/push`.
2. **MVP опашка (notification_jobs)** — планиране, дедупликация, одит в `notification_logs`; изпращане от `/api/notifications/run` чрез FCM (същият `FCM_SERVER_KEY`).
3. **Transactional email (email_jobs)** — отделна опашка за имейл през Resend; enqueue от приложния код (или dev-only `GET /api/test-email`), batch processor `GET /api/jobs/email` с `JOBS_SECRET` / Vercel cron header; не смесва push payload-и с FCM. Без конфигуриран `RESEND_API_KEY` job-ът не остава зависнал в `processing` — отива в обичайния retry/fail с `last_error` (напр. `resend_not_configured`); непознат `type` → `unknown_job_type:…`; невалиден payload при рендер → `render_failed:…`. Регистър и валидация: `lib/email/emailRegistry.ts`, `lib/email/emailSchemas.ts`, `lib/email/renderEmailJob.ts`; UI шаблони: `emails/components/*`, `emails/templates/*`. Абсолютни URL се подават в payload при enqueue (база: `NEXT_PUBLIC_SITE_URL` / `getBaseUrl()` в `lib/seo.ts`). **`EMAIL_ADMIN`** (опционално): inbox за админ-only типове (`admin-new-claim`, `admin-new-submission`); ако липсва — enqueue се пропуска с `console.info`, без да се чупи основният flow. **`EMAIL_REPLY_TO`** (опционално): Reply-To към Resend `emails.send`.

**Типове `email_jobs.type` (Phase 2 + reminder channel):**

| type | Кой enqueue-ва | Получател |
|------|----------------|-----------|
| `test` | dev `GET /api/test-email` | query `to` |
| `organizer-claim-received` | `POST /api/organizer/claims` (след успех) | `contact_email` от заявката |
| `admin-new-claim` | същият route | `EMAIL_ADMIN` (ако е зададен) |
| `organizer-claim-approved` | `POST /admin/api/organizer-members/[id]/approve` | имейл от Supabase Auth за `user_id`, иначе `contact_email` |
| `organizer-claim-rejected` | `POST /admin/api/organizer-members/[id]/reject` | същото |
| `festival-submission-received` | `POST /api/organizer/pending-festivals` | Auth имейл на подателя |
| `admin-new-submission` | същият route | `EMAIL_ADMIN` (ако е зададен) |
| `festival-approved` | `POST /admin/api/pending-festivals/[id]/approve` | само при `submission_source=organizer_portal` — Auth имейл на `submitted_by_user_id` |
| `festival-rejected` | `POST /admin/api/pending-festivals/[id]/reject` | същото |
| `reminder-1-day-before` | `GET /api/notifications/run` при обработка на `notification_jobs` с `job_type=reminder` и `payload_json.reminder_subkind` = `24h` (след push/quiet gates, преди FCM) | имейл от Supabase Auth за `user_id` |
| `reminder-same-day` | същият runner, `reminder_subkind` = `2h` | същото |

**Напомняния по имейл (без втори scheduler):** планирането остава в `notification_jobs` (`scheduleSavedFestivalReminders` / `syncReminderJobsForPreference` — същите инстанти 24h и 2h преди начало като push). При всяко due reminder job, след като минат проверките за `push_enabled` и тихи часове и payload-ът е валиден, кодът enqueue-ва съответния `email_jobs` ред (fail-soft: няма имейл в Auth → пропуск; грешка при enqueue → лог, push продължава). Дедупликация на имейла: `reminder-1-day-before:{user_id}:{festival_id}` и `reminder-same-day:{user_id}:{festival_id}` (виж `lib/email/emailDedupeKeys.ts`). Няма отделен cron за reminder имейли. Извън обхват: `email_events`/webhooks, UI за предпочитания само за имейл, digest/marketing.

**Осъзнато извън обхват на тези имейли:** pending записи без `organizer_portal` / без `submitted_by_user_id` нямат надежден „подател“ в базата — не се изпраща `festival-approved` / `festival-rejected` към краен потребител. Няма отделна страница „контакти“ в repo — copy за отхвърлена claim сочи към контакти „на сайта“ без измислен URL.

**Дедупликация (`dedupe_key`):** стойностите се конструират само при enqueue (helper `lib/email/emailDedupeKeys.ts`), не в процесора. Типични ключове: `organizer-claim-received` / `admin-new-claim` — `organizer_members.id`; `organizer-claim-approved` / `organizer-claim-rejected` — същият id; `festival-submission-received` / `admin-new-submission` — `pending_festivals.id`; `festival-approved` / `festival-rejected` — `pending_festivals.id`; напомняния — `reminder-1-day-before:{user_id}:{festival_id}` / `reminder-same-day:{user_id}:{festival_id}`. Повторен insert със същия ключ не създава втори ред (уникален partial index + pre-insert lookup).

**Transition guards:** одобряване/отхвърляне на claim (`organizer_members`) изпраща имейл само ако `UPDATE … WHERE status='pending'` реално промени ред (иначе 409). Pending фестивал: reject вече изисква успешен status transition преди enqueue; approve enqueue е след успешен insert в `festivals` и pending → `approved`, с финален публичен slug в payload.

## MVP типове (job_type)

| Тип | Приоритет | Тригер | Правила |
|-----|-----------|--------|---------|
| `reminder` | high | Потребител добавя фестивал в плана (`user_plan_festivals` чрез `POST /api/plan/festivals`) | 24ч и 2ч преди начало (локално Europe/Sofia; инстант от `start_date` + опционално `start_time`, иначе 09:00 на същия календарен ден); само бъдещи; при махане от плана — отменяне на pending reminder jobs. Без time-window dedupe (точно разписание). Legacy `/api/jobs/reminders` използва същия инстант за `24h` и за `same_day_09`. |
| `update` | high | Админ `PATCH /admin/api/festivals/[id]` с **смислена** промяна | Само потребители със запис в `user_plan_festivals`. Уведомление само при: промяна на `start_date`, значима промяна на `end_date` (≥1 ден), `city`, `address`, или архивиране (`status`). Игнор: описание, снимки, тагове, `occurrence_dates` и др. Pending ъпдейт се заменя при нова редакция извън dedupe прозореца. |
| `weekend` | normal | Cron: `/api/notifications/weekend-trigger/fri_18` или `.../sat_09` | Фестивали с `start_date` в следващите до 3 дни; потребител с `notify_weekend_digest`, без `only_saved`, с поне един последван град (`user_followed_cities` ↔ slug на фестивала); минимум 2 фестивала; макс. 1 на потребител на слот (dedupe_key). |
| `new_city` | normal | След успешно одобряване на pending (`POST .../approve`) | Само последователи на града (`user_followed_cities`); качество: заглавие, slug, `start_date`; макс. 1 `new_festival` на потребител за календарен ден (София). |

### Time-window дедупликация (освен `dedupe_key`)

Преди insert в `notification_jobs`: ако има ред със същия `user_id`, същия `job_type`, същия `festival_id` (когато е приложимо) и `created_at` в прозореца — **не** се създава нов job:

| job_type | Прозорец |
|----------|----------|
| `update` | 60 мин |
| `weekend` | 6 ч |
| `new_city` | 24 ч |
| `reminder` | — (няма прозорец) |

### Rate limit (при планиране)

По `notification_logs` (успешни `sent` в последните 24 ч), чрез join към `notification_jobs` за `job_type`:

- Напомнянията (`reminder`) **не** се лимитират от този глобален брой.
- За останалите: макс. **2** изпращания на потребител за 24 ч; макс. **1** „промо“ (`weekend` или `new_city` комбинирано) за 24 ч.

### Изпълнение (`GET /api/notifications/run`)

- Избор на pending: `priority` ascending (`high` преди `normal`), после `scheduled_for` ascending; batch до ~75.
- Тихи часове: `reminder` — **не** се препланира; job се **отменя** (`cancelled`, `quiet_hours_skip`). `weekend` / `new_city` — препланиране на следващ момент извън прозореца (стъпка 15 мин).
- Retry при грешка: `retry_count`, макс. 3 неуспеха, backoff 5 мин → 15 мин → 1 ч.
- FCM data: `notification_id`, `type`, `festival_id`, `slug`, `deep_link`, `title`, `body`, `source: push`, `notification_type`, `priority`.
- Логове: `notification_logs` с `duration_ms`, `priority`, `notification_type`; конзолен ред с processed/sent/failed/…

## Payload (FCM data + notification)

Всички изпращания включват в `data`: `notification_id`, `type`, `festival_id`, `slug`, `deep_link` (`festivo://festival/[slug]`), `title`, `body`.

Типове в payload: например `festival_reminder`, `festival_updated`, `weekend_nearby`, `new_festival_in_city`.

## Дедупликация

- Уникален ключ: `notification_jobs.dedupe_key` (upsert с `ignoreDuplicates`).
- Допълнително: time-window дедупликация по тип (виж таблицата по-горе).
- `user_notifications`: upsert по `(user_id, festival_id, type)` след успешен push; типове за reminder: `saved_festival_reminder_24h` / `saved_festival_reminder_2h`.

## Scheduling model (production-safe)

- High-frequency execution (`GET /api/notifications/run` every ~5 minutes) is expected from an **external scheduler** (Railway/worker/cron service), not from Vercel Cron.
- Vercel can keep only low-frequency schedules (for example daily reminders and optional weekend slots) to stay compatible with Hobby limits.
- Weekend slots remain callable by URL (`/api/notifications/weekend-trigger/fri_18`, `/api/notifications/weekend-trigger/sat_09`) and are safe for external scheduler triggering.
- Job routes use `cron_locks` to prevent parallel execution: `notifications_run`, `reminders_job`, `notifications_weekend_{slot}`.

## Автентикация на jobs

- `x-job-secret: JOBS_SECRET` (primary for external schedulers)
- `x-vercel-cron` (still accepted for optional Vercel low-frequency calls)

## Таблици

- `device_tokens` — `platform`, `invalidated_at` при невалиден FCM токен (NotRegistered, InvalidRegistration, MismatchSenderId, InvalidPackageName и подобни).
- Mobile push token registration: `POST /api/push/register` (writes to `device_tokens` under authenticated user).
- `user_notification_settings` — `push_enabled`, `only_saved`, `quiet_hours_*`.
- `notification_jobs`, `notification_logs` — `scripts/sql/20260326_notification_jobs_mvp.sql` + `scripts/sql/20260326_notification_jobs_hardening.sql`.

## Legacy reminder pipeline

`user_plan_reminders` → `/api/jobs/reminders` → `user_notifications` → `/api/jobs/push` — непокътнат; паралелно с MVP reminder jobs от плана.

## Reminder preference sync (public detail)

- `POST /api/plan/reminders` пази `user_plan_reminders` (`none`, `24h`, `same_day_09`) и синхронизира pending `notification_jobs` (`job_type=reminder`) за същия потребител/фестивал.
- Локално преглед на шаблоните за reminder имейл: `GET /api/test-email` (не е наличен в production) с `type=reminder-1-day-before` или `reminder-same-day` и URL-encoded JSON в `payload` (полета като при enqueue: `userId`, `festivalId`, `festivalTitle`, `festivalSlug`, `festivalUrl`, `cityDisplay`, `locationSummary`, `startDateDisplay`, `startTimeDisplay`, `reminderKind`: `1_day_before` | `same_day`).
- При `none`: pending reminder jobs се отменят (`status=cancelled`).
- При `24h`/`same_day_09`: съществуващите pending reminder jobs първо се отменят, после се насрочват наново чрез текущия scheduler поток.
