# Festivo AI Development Context

Before generating code always read:

docs/database-schema.md
docs/system-architecture.md
docs/notification-system.md
docs/er-diagram.md

--------------------------------------------------

Project stack

Next.js 14 App Router  
Supabase (Postgres + Auth)  
TypeScript  
Tailwind  
Vercel  
Flutter mobile app

--------------------------------------------------

Database rules

Use existing tables only.

Important tables:

cities
festivals
festival_days
festival_schedule_items
organizers
profiles
user_notifications
user_plan_festivals
user_plan_items
user_plan_reminders
device_tokens
cron_locks

Never create duplicate tables.

--------------------------------------------------

Notification architecture

Reminder pipeline:

user_plan_reminders
→ reminder job
→ user_notifications
→ push job
→ device_tokens
→ mobile app

Festival discovery notifications:

followers
→ new festival job
→ user_notifications

--------------------------------------------------

User plan system

Tables:

user_plan_festivals
user_plan_items
user_plan_reminders

Users can:

save festivals  
save schedule items  
create reminders

--------------------------------------------------

Coding rules

Prefer incremental changes.

Do not modify database schema unless explicitly asked.

Use Supabase queries compatible with:

@supabase/supabase-js

Use existing API patterns in /app/api.

--------------------------------------------------

Admin rules

Admin role stored in:

user_roles

Admin pages located in:

/app/admin

--------------------------------------------------

Mobile integration

Mobile app is built in Flutter.

Push notifications use:

device_tokens
user_notifications

--------------------------------------------------

Output code compatible with the existing architecture.

--------------------------------------------------
