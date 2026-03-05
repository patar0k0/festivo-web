# Festivo System Architecture

## Project overview
Festivo is a Next.js + Supabase application for discovering festivals, building personal plans, and sending reminder/follow notifications to web and mobile users.

## Technology stack
- **Frontend/UI:** Next.js App Router (React, TypeScript).
- **Backend/API:** Next.js route handlers under `app/api/*`.
- **Database/Auth:** Supabase Postgres + Supabase Auth + RLS.
- **Background jobs:** Cron-triggered API routes (`/api/jobs/*`).
- **Push provider:** Firebase Cloud Messaging (FCM).

## Core entities
- **Location/content:** `cities`, `festivals`, `festival_days`, `festival_schedule_items`, `organizers`.
- **User identity/profile layer:** `profiles` (profile metadata), auth user id, and user-owned plan/notification records.
- **Planning:** `user_plan_festivals`, `user_plan_items`, `user_plan_reminders`.
- **Delivery:** `user_notifications`, `device_tokens`, `cron_locks`.

## Festival data model
- `cities` provides canonical city slugs used by festival filtering and follow logic.
- `ingest_jobs` stores admin-queued source URLs (currently Facebook event URLs) for asynchronous ingestion workers.
- `pending_festivals` stores ingested/unreviewed candidates as a moderation layer before publication.
- `festivals` is the main aggregate; each row may reference an `organizer` and city slug.
- `festival_days` is a 1:N child of `festivals` for multi-day programs.
- `festival_schedule_items` is a 1:N child of `festival_days` for timed sessions.

## User interaction model
- Users save festivals through `user_plan_festivals` (festival-level planning).
- Users save specific schedule entries through `user_plan_items` (program-level planning).
- Users configure per-festival reminders in `user_plan_reminders` (`24h` or `same_day_09`).
- User/account metadata is associated with profile/auth records (`profiles` + auth user id), while plan data remains in dedicated plan tables.

## Admin system
- Admin users are identified by role checks (`user_roles`), and admin pages/API mutate core content.
- Admin content changes in `festivals` (and related program tables) affect public pages and notification targeting.
- Admin ingestion flow at `/admin/ingest` allows enqueueing source URLs into `ingest_jobs`.
- Admin moderation flow at `/admin/pending-festivals` allows reviewing/editing `pending_festivals`, approving into `festivals`, or rejecting records.

## Notification system
- Notification-producing jobs read planning/follow state and write durable messages into `user_notifications`.
- `user_notifications` is the source of truth for in-app history and push send status (`sent_at`, `pushed_at`).
- Deduplication is enforced at insert/upsert time by `(user_id, festival_id, type)`.

## Reminder cron jobs
- Reminder job scans `user_plan_reminders`, joins festival start date, computes due reminder windows, and writes reminder notifications.
- `cron_locks` prevents overlapping reminder runs by acquiring a named lock (`reminders_job`) and cleaning stale locks.

## Push notification pipeline
- Push job selects `user_notifications` that are ready (`sent_at` set, `pushed_at` null).
- It resolves recipients via `device_tokens` per user and sends payloads through FCM.
- On success, each notification row is marked with `pushed_at`.

## Mobile app integration
- Mobile clients register FCM tokens into `device_tokens` via authenticated API calls.
- Mobile deep links (e.g., `festivo://festival/:slug`) allow notification taps/web CTAs to open app festival detail screens.
- The same backend notification records can feed both in-app history and external push delivery.
