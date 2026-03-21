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
- Public festival discovery (`festivals` queries scoped to visible statuses); public festival detail loads all `festival_organizers` rows via a dedicated query and resolves organizer names (service role client when `SUPABASE_SERVICE_ROLE_KEY` is set, otherwise anon — requires RLS `select` on `organizers` for active rows, see `scripts/sql/20260321_organizers_public_select_active.sql`).
- **Festival dates:** `festivals` and `pending_festivals` may store non-consecutive days in `occurrence_dates` (jsonb array of ISO dates). Empty/null means “continuous range” via `start_date`/`end_date` only. App code merges min/max into start/end when discrete days are set (`lib/festival/occurrenceDates.ts`); listing/ICS/calendar use `lib/festival/listingDates.ts` and `lib/queries.ts` (RPC `festivals_intersecting_range` for filters). Admin: occurrence editor on published and pending festival forms. SQL: `scripts/sql/20260323_festival_occurrence_dates.sql`.
- **Settlement labels:** `cities.is_village` drives „с.“ vs град в публичния UI; логика в `lib/settlements/formatDisplayName.ts` и `festivalCityLabel` (SQL: `scripts/sql/20260321_cities_is_village.sql`).
- **Admin hero от URL:** `lib/admin/rehostHeroImageFromUrl.ts` — валидиране и качване в Storage; API `PATCH .../admin/api/pending-festivals/[id]/hero-image` и `PATCH .../admin/api/festivals/[id]/hero-image`. Worker и админ пишат метаданни в `pending_festivals.hero_image_*` колоните (виж `scripts/sql/20260322_add_pending_festivals_hero_ingest_columns.sql`).
- **Ingest диагностика:** `ingest_jobs.fb_browser_context` се попълва от festivo-workers; админ pending страницата показва последния job статус/контекст до реда.
- **Публична детайлна страница:** медия галерия чрез `components/festival/FestivalGallery.tsx` в `FestivalDetailClient`.
- **Дати в админ форми:** компонент `DdMmYyyyDateInput` + `lib/dates/euDateFormat.ts` за въвеждане/показване в EU подредба.
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

`Research with AI` extraction (`/api/admin/research-ai`) uses multiple additive passes when many fields stay null.
- first pass returns strict structured values; follow-up passes target unresolved fields
- later passes inherit prior `source_urls` so extracted facts are not wiped when the model omits URLs in JSON
- optional third pass when the merged form is still sparse
- merge is additive-only (fills null fields, does not overwrite already extracted values)

## Hero image rehosting role
Worker `workers/ingest_fb_event.js` (operational deployment: festivo-workers) performs hero image handling for ingestion patches:
- extracts candidate image from Facebook cover first, OG image second
- detects Facebook-hosted image URLs
- downloads with validation (timeout, redirect limit, max bytes, image content-type); may send user-agent / session-related headers where configured
- uploads validated images to Supabase Storage bucket (`festival-hero-images` by default)
- writes resulting public URL to `pending_festivals.hero_image` and fills `hero_image_source`, `hero_image_original_url`, `hero_image_score`, `hero_image_fallback_reason` when the schema columns exist

The Next.js admin app can rehost from an arbitrary HTTPS image URL using the same validation/upload path (`lib/admin/rehostHeroImageFromUrl.ts`) via the hero-image API routes above.

Failure behavior is fail-closed by default (`allowOriginalOnFailure=false`): if rehosting/validation fails for detected Facebook URLs, hero image is set to `null` rather than preserving original URL; reasons may be recorded in `hero_image_fallback_reason`.

## Public vs admin visibility

- Routes under `/admin` render without the public site header/footer (`ConditionalSiteChrome` + `usePathname`); `SiteHeader`/`SiteFooter` are passed as props from the server `LayoutShell` so `next/headers` is not pulled into the client bundle (Vercel build).
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

**Моят план (UX):** „Запази“ на картите/картата записва целия фестивал (`user_plan_festivals`); отделни часове се добавят само от детайлната страница в секция „Програма“ (`user_plan_items`). Напомнянията са към фестивала. На детайлна страница секцията „Програма“ винаги е налична с anchor `#festival-program` (виж `lib/festival/programmeAnchor.ts`).
- `user_notifications`
- `device_tokens`

Full schema docs: `docs/database-schema.md`.

## Organizer duplicate management
- Organizer duplicates are reviewed manually in admin at `/admin/organizers/duplicates`.
- Duplicate candidates are conservative-only: exact normalized name, exact slug, exact `facebook_url` (when present).
- Merges are manual via `/admin/api/organizers/merge`; no auto-merge job exists.
- Merge behavior moves organizer links in `festival_organizers` (plus compatibility fields `festivals.organizer_id` and `pending_festivals.organizer_id`) to a canonical organizer, backfills missing target profile fields, then marks source organizer inactive (`is_active=false`, `merged_into=target`).
- Organizer list/public lookups use active organizers by default (`is_active=true`).
- Organizer edit includes AI enrichment (`/api/admin/research-organizer`) for profile fields (`description`, `logo_url`, official/social URLs, contact data) with admin review before save.
- New organizers can be researched and created from `/admin/organizers/research` (linked next to duplicate detection on the organizers list); flow calls the same research API then `POST /admin/api/organizers` and redirects to edit.

## Notification System
Reminder and discovery notifications write to `user_notifications`, then push delivery reads unsent rows and dispatches via `device_tokens`.

Details: `docs/notification-system.md`.
