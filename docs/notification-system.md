# Festivo Notification System

## Два слоя (съвместими)

1. **По-стари job маршрути** — пишат директно в `user_notifications`; push през `/api/jobs/push`.
2. **MVP опашка (notification_jobs)** — планиране, дедупликация, одит в `notification_logs`; изпращане от `/api/notifications/run` чрез FCM (същият `FCM_SERVER_KEY`).

## MVP типове (job_type)

| Тип | Тригер | Правила |
|-----|--------|---------|
| `reminder` | Потребител добавя фестивал в плана (`user_plan_festivals` чрез `POST /api/plan/festivals`) | 24ч и 2ч преди начало (локално Europe/Sofia, начало от `start_date`); само бъдещи; при махане от плана — отменяне на pending reminder jobs. |
| `update` | Админ `PATCH /admin/api/festivals/[id]` с осмислена промяна | Само потребители със запис в `user_plan_festivals`; не повече от един изпратен ъпдейт на потребител/фестивал за 1ч; pending се заменя при нова редакция. |
| `weekend` | Cron: `/api/notifications/weekend-trigger/fri_18` или `.../sat_09` | Фестивали с `start_date` в следващите до 3 дни; потребител с `notify_weekend_digest`, без `only_saved`, с поне един последван град или мач по `region_slugs` ↔ `festivals.region`; минимум 2 фестивала; макс. 1 на потребител на слот (dedupe_key). |
| `new_city` | След успешно одобряване на pending (`POST .../approve`) | Само последователи на града (`user_followed_cities`); качество: заглавие, slug, `start_date`; макс. 1 `new_festival` на потребител за календарен ден (София). |

## Payload (FCM data + notification)

Всички изпращания включват в `data`: `type`, `festival_id`, `slug`, `deep_link` (`festivo://festival/[slug]`), `title`, `body`.

Типове в payload: например `festival_reminder`, `festival_updated`, `weekend_nearby`, `new_festival_in_city`.

## Дедупликация

- Уникален ключ: `notification_jobs.dedupe_key` (upsert с `ignoreDuplicates`).
- `user_notifications`: upsert по `(user_id, festival_id, type)` след успешен push; типове за reminder: `saved_festival_reminder_24h` / `saved_festival_reminder_2h`.

## Cron (Vercel)

- `GET /api/notifications/run` — на всеки 5 минути; обработва pending с `scheduled_for <= now` (lock `cron_locks.notifications_run`).
- Уикенд: `fri_18` = петък 16:00 UTC (~18:00 София зима), `sat_09` = събота 07:00 UTC (~09:00 София зима); при лятно часово време коригирайте в `vercel.json` при нужда.

## Автентикация на jobs

Същото като `/api/jobs/*`: `x-vercel-cron` или `x-job-secret: JOBS_SECRET`.

## Таблици

- `device_tokens` — `platform`, `invalidated_at` при невалиден FCM токен.
- `user_notification_settings` — `push_enabled`, `only_saved`, `quiet_hours_*`, `region_slugs` (за уикенд регион).
- `notification_jobs`, `notification_logs` — виж `scripts/sql/20260326_notification_jobs_mvp.sql`.

## Legacy reminder pipeline

`user_plan_reminders` → `/api/jobs/reminders` → `user_notifications` → `/api/jobs/push` — непокътнат; паралелно с MVP reminder jobs от плана.
