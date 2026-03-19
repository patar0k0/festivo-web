# Festivo Project Context

## Overview
Festivo is a moderation-first festival catalog.

Public users browse verified/published festivals, while ingestion inputs first land in `pending_festivals` and require admin review before publication.

## Tech Stack
**Frontend:** Next.js 14 (App Router)
**Backend:** Next.js API routes + worker-side ingestion helpers
**Database:** Supabase Postgres
**Auth:** Supabase Auth
**Mobile:** Flutter
**Deployment:** Vercel

## Core System Modules
- Public festival discovery (`festivals` queries scoped to visible statuses)
- Admin moderation (`pending_festivals` edit/approve/reject, including organizer resolve/create on approve)
- Admin organizer quality controls (duplicate detection + manual merge workflow)
- Admin ingest queue (`ingest_jobs` enqueue/retry/delete + job-to-record linking)
- Admin discovery dashboard (`discovery_sources` monitoring + source activation toggles + recent `discovery_runs` visibility)
- Planning + reminders + notifications
- Ingestion helper pipeline for Facebook event extraction and hero image rehosting

## Moderation-first publish model
Current publish flow in this repo:

1. Admin enqueues a Facebook event URL into `ingest_jobs` (`status=pending`).
2. Worker processes the job and writes/updates a `pending_festivals` record (outside Next.js runtime; queue state is surfaced in admin ingest UI).
3. Admin reviews pending data at `/admin/pending-festivals/[id]`:
   - **Save edits** updates only `pending_festivals`.
   - **Approve** inserts a new `festivals` row, then marks pending row `approved`.
   - **Reject** marks pending row `rejected`.
4. Public pages read from `festivals` only (not from pending tables).

Approval safeguards implemented in API route:
- pending row must still be `status=pending`
- city must resolve to canonical `cities.id`
- `start_date` is required
- conflict checks for `source_url` and slug uniqueness
- on pending status update failure, inserted festival is rolled back (deleted)

## Ingestion behavior currently represented
- `ingest_jobs` statuses shown in admin: `pending`, `processing`, `done`, `failed`.
- Admin ingest page resolves queue rows to moderation outcomes by matching:
  - exact `source_url`
  - normalized source URL
  - extracted Facebook event id
- The UI derives workflow states such as `pending_review`, `published`, `rejected`, `no_pending`.

## AI normalization / extraction role
AI/normalization fields exist on `pending_festivals` and are consumed by the admin edit form as **advisory guesses** (for example `title_clean`, `description_clean`, `city_guess`, `tags_guess`, coordinate/date guesses).

These guesses are non-authoritative:
- they can be copied into editable core fields via “Use” actions
- core pending fields remain authoritative for save/approve
- only core moderated values are written into `festivals` during approval

## Hero image rehosting role
Worker helper `workers/ingest_fb_event.js` performs hero image handling for ingestion patches:
- extracts candidate image from Facebook cover first, OG image second
- detects Facebook-hosted image URLs
- downloads with validation (timeout, redirect limit, max bytes, image content-type)
- uploads validated images to Supabase Storage bucket (`festival-hero-images` by default)
- writes resulting public URL to `pending_festivals.hero_image`

Failure behavior is fail-closed by default (`allowOriginalOnFailure=false`): if rehosting/validation fails for detected Facebook URLs, hero image is set to `null` rather than preserving original URL.

## Public vs admin visibility
- Public queries include verified/published rows and exclude archived (`status != archived`).
- Pending festivals are admin-only moderation records.
- Published admin management supports archive/restore/delete on `festivals`, and links into organizer profile enrichment in admin organizers pages.

## Key Database Entities
- `cities`
- `festivals`
- `pending_festivals`
- `ingest_jobs`
- `festival_days`
- `festival_schedule_items`
- `organizers`
- `profiles`
- `user_plan_festivals`
- `user_plan_items`
- `user_plan_reminders`
- `user_notifications`
- `device_tokens`

Full schema docs: `docs/database-schema.md`.

## Organizer duplicate management
- Organizer duplicates are reviewed manually in admin at `/admin/organizers/duplicates`.
- Duplicate candidates are conservative-only: exact normalized name, exact slug, exact `facebook_url` (when present).
- Merges are manual via `/admin/api/organizers/merge`; no auto-merge job exists.
- Merge behavior moves organizer links in `festival_organizers` (plus compatibility fields `festivals.organizer_id` and `pending_festivals.organizer_id`) to a canonical organizer, backfills missing target profile fields, then marks source organizer inactive (`is_active=false`, `merged_into=target`).
- Organizer list/public lookups use active organizers by default (`is_active=true`).

## Notification System
Reminder and discovery notifications write to `user_notifications`, then push delivery reads unsent rows and dispatches via `device_tokens`.

Details: `docs/notification-system.md`.
