# Festivo Notification System

## Два слоя (съвместими)

1. **По-стари job маршрути** — пишат директно в `user_notifications`; push през `/api/jobs/push`.
2. **MVP опашка (notification_jobs)** — планиране, дедупликация, одит в `notification_logs`; изпращане от `/api/notifications/run` чрез FCM (същият `FCM_SERVER_KEY`).
3. **Transactional email (email_jobs)** — отделна опашка за имейл през Resend; enqueue от приложния код (или dev-only `GET /api/test-email`), batch processor `GET /api/jobs/email` с `JOBS_SECRET` / Vercel cron header; не смесва push payload-и с FCM.

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
- При `none`: pending reminder jobs се отменят (`status=cancelled`).
- При `24h`/`same_day_09`: съществуващите pending reminder jobs първо се отменят, после се насрочват наново чрез текущия scheduler поток.
