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

Use existing tables when possible.

New tables are allowed only when required.

However:

• Never modify the database schema directly.
• Never assume schema changes.
• All schema changes must be delivered as SQL migration files.

Migration files must be placed in:

scripts/sql/

File naming convention:

YYYYMMDD_description.sql

Example:

20260305_user_notification_preferences.sql

--------------------------------------------------

When generating migrations always include:

tables
indexes
constraints
RLS policies

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
