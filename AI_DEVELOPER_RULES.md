# Festivo AI Developer Rules

This project uses AI-assisted development.

AI must behave as a senior full-stack engineer and system architect.

Before generating code AI must read:

AI_CONTEXT.md
docs/database-schema.md
docs/system-architecture.md
docs/notification-system.md
docs/er-diagram.md

--------------------------------------------------

Project architecture

Frontend:
Next.js 14 (App Router)

Backend:
Next.js API routes

Database:
Supabase Postgres

Auth:
Supabase Auth

Mobile:
Flutter app

Deployment:
Vercel

--------------------------------------------------

Core system modules

Festivals
Planning system
Notifications
Discovery
Admin panel
Ingestion workers

--------------------------------------------------

Database principles

Use existing schema when possible.

Schema changes must always be delivered as SQL migrations.

Location:

scripts/sql/

Naming format:

YYYYMMDD_description.sql

Example:

20260305_add_notification_preferences.sql

--------------------------------------------------

Safety rules

AI must never:

drop tables automatically
drop columns automatically
delete data automatically

Schema removals require explicit user confirmation.

--------------------------------------------------

Coding rules

Prefer minimal, incremental changes.

Reuse existing API patterns.

Avoid introducing new dependencies unless required.

Respect project TypeScript types.

Use Supabase queries compatible with:

@supabase/supabase-js

--------------------------------------------------

Documentation rules

If a change affects:

database schema
architecture
API routes
notification pipelines
background jobs
security or anti-abuse (middleware, rate limits, Origin/CORS policy, session/cookie edges)

AI must update documentation:

docs/database-schema.md
docs/system-architecture.md
docs/notification-system.md
docs/er-diagram.md

For security / edge middleware / rate limiting / similar API hardening: always extend `docs/system-architecture.md` in the same change; add or update `README.md` environment-variable bullets when new secrets or toggles are required for production.

--------------------------------------------------

# Context synchronization rules

If a change affects:

• database schema
• architecture
• notification pipelines
• core system modules

AI must update:

PROJECT_CONTEXT.md

If schema changes occur also update:

docs/database-schema.md
docs/er-diagram.md

If architecture changes occur also update:

docs/system-architecture.md

If the change is cross-cutting safety (middleware, rate limits, CSRF-ish checks, auth cookie behavior at the edge), treat it as an architecture change: document behavior and env vars in `docs/system-architecture.md` (and `README.md` when operators need new variables).

If notification pipelines change also update:

docs/notification-system.md

Do not update documentation for:

• UI-only changes
• styling changes
• small bug fixes

--------------------------------------------------

Notification system overview

Reminder pipeline:

user_plan_reminders
→ reminder job
→ user_notifications
→ push worker
→ device_tokens
→ mobile app

Discovery pipeline:

new festival
→ follower matching
→ user_notifications
→ push worker

--------------------------------------------------

Mobile integration

Flutter mobile app receives notifications via:

device_tokens
user_notifications

--------------------------------------------------

Admin system

Admin role stored in:

user_roles

Admin pages located in:

/app/admin

--------------------------------------------------

AI must always preserve compatibility with the existing system.
