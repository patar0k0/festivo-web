# Festivo Repository Structure

## Top-level application areas
- `app/` — Next.js App Router pages, layouts, and API route handlers.
- `components/` — reusable UI and feature components (public, admin, plan, map, calendar).
- `lib/` — shared business logic, Supabase clients, DB/query helpers, auth/admin helpers, utilities.
- `scripts/` — operational scripts and SQL migrations/seeds.
- `docs/` — architecture notes, schema docs, ER diagrams, and project documentation.

## Where key concerns live

### API routes
- Live under `app/api/**/route.ts`.
- Examples: plan APIs (`app/api/plan/*`), auth APIs (`app/api/auth/*`), follow APIs, and jobs (`app/api/jobs/*`).

### Cron jobs
- Implemented as API routes in `app/api/jobs/`.
- Current jobs include reminders, push dispatch, and new-festival notifications.

### Database helpers
- Supabase clients and DB utility modules live in `lib/`.
- Core examples: `lib/supabase/*`, `lib/supabaseAdmin.ts`, `lib/queries.ts`, `lib/plan/server.ts`.

### Admin pages
- Admin UI routes are under `app/admin/`.
- Protected admin pages are grouped under `app/admin/(protected)/` and rely on admin role checks from `lib/admin/`.
