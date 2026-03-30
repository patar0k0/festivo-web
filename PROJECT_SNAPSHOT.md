# Festivo — project snapshot (agent entry)

Concise stable facts. For depth, use task-specific files (`PROJECT_CONTEXT.md`, `docs/system-architecture.md`, etc.) only when needed.

## Product

- **Festivo** catalogs **festivals in Bulgaria**: discovery, detail pages, planning/reminders, organizer-facing portal, and **admin moderation**.
- **Stack:** Next.js (App Router) API routes, Supabase Postgres + Auth, TypeScript, Vercel; mobile app consumes APIs/notifications (Flutter).

## Data sources

- **Public catalog:** `festivals` (verified / published / visible scope per RLS and app queries).
- **Ingestion & submissions:** new or edited content is staged in **`pending_festivals`** until approved.
- **Organizers:** canonical **`organizers`**; published festivals link via **`festival_organizers`** (and related fields). Portal uses **`organizer_members`** for access control.

## Moderation flow (critical)

1. Records await review in **`pending_festivals`**.
2. Admin **saves** edits on pending only; **approve** inserts into **`festivals`** and marks pending approved; **reject** marks pending rejected.
3. **Public pages read published data from `festivals`**, not from pending as the live catalog source.

## Monetization (high level)

- **Organizer plan:** `free` vs **`vip`** (plan window and rules in DB/app — see code and `docs/system-architecture.md` if implementing billing UI or listing).
- **Festival promotion:** per-event **`normal`** vs **`promoted`**; listing order favors promoted/VIP/rank as implemented in queries.
- **VIP promotion credits:** yearly **`organizer_promotion_credits`** — credits apply when promoting a festival (consumed on explicit promote transition, not on every edit; details in architecture doc).

## Notifications & planning (basics)

- **Reminders / discovery / follow** flows enqueue or write **`user_notifications`**; push delivery uses **`device_tokens`** (see `docs/notification-system.md` for pipelines and job endpoints).
- User planning tables include **`user_plan_festivals`**, **`user_plan_items`**, **`user_plan_reminders`** (detail in ER and architecture docs when changing behavior).

## Database & safety

- **Schema authority:** Supabase (live DB) + this repo’s migrations and typed queries — **not** markdown alone.
- **Changes:** only via **`scripts/sql/YYYYMMDD_description.sql`**; include RLS/indexes/constraints when adding objects.
- **No destructive drops** or bulk data deletes without explicit approval.
- **Service role / secrets:** only on server routes or trusted workers — never client bundles.

## Admin

- Admin role is enforced in app (e.g. **`user_roles`**) under **`/app/admin`**. Organizer portal under **`/organizer`** is separate from staff admin.

## When this snapshot is not enough

Use **`docs/system-architecture.md`** for flows, middleware, and ops. Use **`docs/er-diagram.md`** for relationship diagrams. Use **`PROJECT_CONTEXT.md`** for long-form product modules and edge cases.
