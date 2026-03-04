# Festivo AI Context

## Project overview
Festivo is a festival discovery and planning platform built with Next.js App Router and Supabase. It supports public browsing, personal plan building, reminders, and admin content management.

## Database conventions
- Supabase Postgres is the system of record.
- `auth.users` is the identity source; app tables reference user ids.
- Row Level Security (RLS) is enabled on user-owned tables; user APIs should operate on the authenticated user only.
- Notification and plan features rely on upserts + unique keys for idempotency.

## Table naming rules
- Use plural snake_case table names (e.g., `user_plan_festivals`, `festival_schedule_items`).
- Join/state tables are explicit (`user_*` prefix for user-owned state).
- Avoid introducing alternate names when a canonical table already exists.

## API route conventions
- App Router API handlers live in `app/api/**/route.ts`.
- User endpoints use server-authenticated Supabase clients.
- Admin or job endpoints enforce elevated checks (admin role and/or job secret headers).
- Cron-like jobs are under `app/api/jobs/*`.

## Notification architecture
- Event sources: reminder preferences and new-festival follow matching.
- Durable notification store: `user_notifications`.
- Delivery target registry: `device_tokens`.
- Push dispatcher reads pending notifications and writes `pushed_at` after success.
- Deduplication is based on `(user_id, festival_id, type)`.

## Reminder job logic
- Reads `user_plan_reminders` for enabled reminder types.
- Resolves festival start times and computes schedule windows (24h or same-day 09:00).
- Inserts reminder notification rows via upsert.
- Uses `cron_locks` to prevent overlapping runs.

## User plan system
- `user_plan_festivals`: saved festivals.
- `user_plan_items`: saved schedule/program entries.
- `user_plan_reminders`: per-festival reminder mode.
- Plan APIs toggle membership instead of duplicating rows.

## Admin permission model
- Admin access is role-based (`user_roles` contains `admin`).
- Protected admin pages validate role before rendering.
- Admin APIs/pages mutate festival catalog data consumed by public and notification flows.

## Instructions for AI assistants
- **Do not create duplicate tables.**
- **Use existing schema relationships.**
- **Respect Supabase RLS model.**
- **Prefer incremental changes over broad rewrites.**
