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

AI must update documentation:

docs/database-schema.md
docs/system-architecture.md
docs/notification-system.md
docs/er-diagram.md

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
