# Festivo Notification System

## Reminder notifications
1. Users choose a reminder mode per festival in `user_plan_reminders` (`24h` or `same_day_09`).
2. The reminder cron endpoint (`/api/jobs/reminders`) computes due reminders in a short lookahead window.
3. For each due record, it writes a `user_notifications` row of type `reminder_24h` or `reminder_same_day_09`.

## Festival follow notifications
1. A new festival event triggers `/api/jobs/new-festival-notifications`.
2. The job finds matching followers (city/category/organizer) and applies notification settings.
3. It stores `new_festival` entries in `user_notifications` for eligible users.

## Notification storage
- `user_notifications` is the durable notification outbox + history table.
- Jobs upsert into this table, then push delivery updates `pushed_at`.
- Deduplication key: **`(user_id, festival_id, type)`**.
  - Prevents duplicate reminder/follow notifications for the same user and festival event type.

## Cron jobs
- **Reminder job:** `/api/jobs/reminders`.
  - Reads `user_plan_reminders`, schedules due reminder notifications, writes to `user_notifications`.
  - Uses `cron_locks` to avoid concurrent reminder runs.
- **Push job:** `/api/jobs/push`.
  - Pulls unsent-to-push notifications (`sent_at` present, `pushed_at` null), dispatches push, then marks `pushed_at`.

## Push notifications (mobile)
Pipeline:

`user_plan_reminders`  
→ reminder job  
→ `user_notifications`  
→ push job  
→ `device_tokens`  
→ mobile app

How it works:
- Mobile devices register tokens in `device_tokens` by authenticated user.
- Push job groups by notification user, fetches that user’s tokens, and sends via FCM.
- Successful sends update `user_notifications.pushed_at`, keeping delivery idempotent on retries.
