# Festivo Project Context

## Overview
Festivo is a platform for discovering and planning free festivals.

The system includes:
- Web platform (festival discovery)
- Mobile app (festival planning and notifications)

## Tech Stack
**Frontend:** Next.js 14 (App Router)  
**Backend:** Next.js API routes  
**Database:** Supabase Postgres  
**Auth:** Supabase Auth  
**Mobile:** Flutter  
**Deployment:** Vercel

## Core System Modules
- Festival catalog
- Pending festival moderation
- Planning system
- Notification system
- Admin panel
- Ingestion workers

## Key Database Entities
- cities
- festivals
- pending_festivals
- festival_days
- festival_schedule_items
- organizers
- profiles
- user_plan_festivals
- user_plan_items
- user_plan_reminders
- user_notifications
- device_tokens

Full schema documented in: `docs/database-schema.md`

## Planning System
Users can:
- save festivals
- save schedule items
- set reminders

Tables involved:
- user_plan_festivals
- user_plan_items
- user_plan_reminders

## Notification System
Two notification pipelines exist.

**Reminder pipeline**  
`user_plan_reminders` → reminder job → `user_notifications` → push worker → `device_tokens` → mobile app

**Discovery pipeline**  
new festival → follower matching → `user_notifications` → push worker

Full documentation: `docs/notification-system.md`

## Admin System
Admin role stored in: `user_roles`

Admin pages located in: `/app/admin`

Pending ingestion moderation route: `/admin/pending-festivals` (review, edit, approve, reject).

## Architecture Documentation
Detailed architecture: `docs/system-architecture.md`  
Database schema: `docs/database-schema.md`  
Entity relationships: `docs/er-diagram.md`

## Rule for AI Assistants
Always read:
- `AI_CONTEXT.md`
- `AI_DEVELOPER_RULES.md`
- `AI_SYSTEM_ARCHITECT.md`

before generating code.

If schema, architecture, jobs, or notification pipelines change, update the documentation files.
