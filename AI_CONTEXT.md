# Mandatory AI Context Loading

Before generating any code, AI must read the following files in order:

1. `PROJECT_CONTEXT.md`
2. `AI_CONTEXT.md`
3. `AI_DEVELOPER_RULES.md`
4. `AI_SYSTEM_ARCHITECT.md`
5. `docs/system-architecture.md`
6. `docs/notification-system.md`
7. `docs/er-diagram.md`

**Database schema is not defined by markdown docs.** Supabase (live Postgres) is authoritative. Infer tables, columns, RPCs, and access patterns from existing Supabase usage, shared types, and `scripts/sql/` migrations in this repo. Do not read or rely on `docs/database-schema.md` unless a human explicitly asks to sync that file.

These files are the source of truth for:

- system architecture, notification system, API patterns, data relationships (high level)
- **not** for column-level database schema (use code + Supabase)

AI must never generate code without first reading these files (when the task is not purely mechanical).

If a file is missing, AI should continue using the remaining files.

---

# Festivo AI Development Context

## Project stack

- Next.js 14 App Router
- Supabase (Postgres + Auth)
- TypeScript
- Tailwind
- Vercel
- Flutter mobile app

## Database rules

Use existing tables when possible.

New tables are allowed only when required.

However:

- Never modify the database schema directly.
- Never assume schema changes.
- All schema changes must be delivered as SQL migration files.

Migration files must be placed in:

`scripts/sql/`

File naming convention:

`YYYYMMDD_description.sql`

Example:

`20260305_user_notification_preferences.sql`

## Documentation sync (same PR / same agent task)

When you add or change schema, RPCs, RLS, or meaningful API/product behavior, update the in-repo docs in the **same change**, without waiting for a separate request:

- `scripts/sql/*.sql` migration for actual DDL/RLS (required when schema changes)
- `docs/system-architecture.md` (flows)
- `docs/er-diagram.md` (if entity relationships or diagram attributes change)
- `PROJECT_CONTEXT.md` (high-level product/module notes)

Optional: `docs/database-schema.md` only if the team maintains a manual snapshot there; it is **not** mandatory to read or update for every change.

See `.cursor/rules/festivo.mdc` for the full checklist.

## Migration quality requirements

When generating migrations always include:

- tables
- indexes
- constraints
- RLS policies

Important tables:

- cities
- festivals
- festival_days
- festival_schedule_items
- organizers
- profiles
- user_notifications
- user_plan_festivals
- user_plan_items
- user_plan_reminders
- device_tokens
- cron_locks

## Notification architecture

Reminder pipeline:

`user_plan_reminders`
→ reminder job
→ `user_notifications`
→ push job
→ `device_tokens`
→ mobile app

Festival discovery notifications:

followers
→ new festival job
→ `user_notifications`

## User plan system

Tables:

- `user_plan_festivals`
- `user_plan_items`
- `user_plan_reminders`

Users can:

- save festivals
- save schedule items
- create reminders

## Coding rules

- Prefer incremental changes.
- Do not modify database schema unless explicitly asked.
- Use Supabase queries compatible with `@supabase/supabase-js`.
- Use existing API patterns in `/app/api`.
- For AI extraction endpoints, prefer strict-first extraction plus additive enrichment (fill-null-only) instead of overwriting accepted values.

## Admin rules

Admin role stored in:

`user_roles`

Admin pages located in:

`/app/admin`

## Mobile integration

Mobile app is built in Flutter.

Push notifications use:

- `device_tokens`
- `user_notifications`

Output code compatible with the existing architecture.
