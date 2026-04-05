# Festivo Project Context

## Overview
Festivo is a moderation-first festival catalog.

Public users browse verified/published festivals, while ingestion inputs first land in `pending_festivals` and require admin review before publication.

## Tech Stack
**Frontend:** Next.js 14 (App Router)
**Backend:** Next.js API routes + worker-side ingestion helpers
**Database:** Supabase Postgres
**Auth:** Supabase Auth (signup/login + password recovery via `/reset-password`)
**Mobile:** Flutter
**Deployment:** Vercel

**API edge hardening:** `middleware.ts` applies Upstash rate limits to **`POST` / `PATCH` / `PUT` / `DELETE`** on **`/api/*`** and **`/admin/api/*`**, and an Origin/Referer allowlist to **`POST /api/*`** only (details, buckets, env vars: `docs/system-architecture.md`, section *Edge middleware: API POST hardening*).

## Core System Modules
- Public festival discovery (`festivals` queries scoped to visible statuses); public festival detail loads all `festival_organizers` rows via a dedicated query and resolves organizer names (service role client when `SUPABASE_SERVICE_ROLE_KEY` is set, otherwise anon вЂ” requires RLS `select` on `organizers` for active rows, see `scripts/sql/20260321_organizers_public_select_active.sql`).
- **Festival dates:** `festivals` and `pending_festivals` may store non-consecutive days in `occurrence_dates` (jsonb array of ISO dates). Empty/null means вЂњcontinuous rangeвЂќ via `start_date`/`end_date` only. Optional wall-clock times `start_time` / `end_time` (Postgres `time`, Europe/Sofia with the calendar date in UI and notifications). App code merges min/max into start/end when discrete days are set (`lib/festival/occurrenceDates.ts`); listing/ICS/calendar use `lib/festival/listingDates.ts` and `lib/queries.ts` (RPC `festivals_intersecting_range` for filters). Admin: occurrence editor on published and pending festival forms. SQL: `scripts/sql/20260323_festival_occurrence_dates.sql`, `scripts/sql/20260329_festival_start_end_time.sql`.
- **Settlement labels:** `cities.is_village` drives вЂћСЃ.вЂњ vs РіСЂР°Рґ РІ РїСѓР±Р»РёС‡РЅРёСЏ UI; Р»РѕРіРёРєР° РІ `lib/settlements/formatDisplayName.ts` Рё `festivalCityLabel` (SQL: `scripts/sql/20260321_cities_is_village.sql`).
- **Admin hero РѕС‚ URL:** `lib/admin/rehostHeroImageFromUrl.ts` вЂ” РІР°Р»РёРґРёСЂР°РЅРµ Рё РєР°С‡РІР°РЅРµ РІ Storage; API `PATCH .../admin/api/pending-festivals/[id]/hero-image` Рё `PATCH .../admin/api/festivals/[id]/hero-image`. Worker Рё Р°РґРјРёРЅ РїРёС€Р°С‚ РјРµС‚Р°РґР°РЅРЅРё РІ `pending_festivals.hero_image_*` РєРѕР»РѕРЅРёС‚Рµ (РІРёР¶ `scripts/sql/20260322_add_pending_festivals_hero_ingest_columns.sql`).
- **Ingest РґРёР°РіРЅРѕСЃС‚РёРєР°:** `ingest_jobs.fb_browser_context` СЃРµ РїРѕРїСЉР»РІР° РѕС‚ festivo-workers; Р°РґРјРёРЅ pending СЃС‚СЂР°РЅРёС†Р°С‚Р° РїРѕРєР°Р·РІР° РїРѕСЃР»РµРґРЅРёСЏ job СЃС‚Р°С‚СѓСЃ/РєРѕРЅС‚РµРєСЃС‚ РґРѕ СЂРµРґР°.
- **Public festival detail (gallery + video):** Extra photos use `festival_media` (image rows only; `festival_media_type_check` allows `type='image'`). Optional promo video is an external YouTube/Facebook URL on `festivals.video_url` (not uploaded, not stored in `festival_media`). Pending moderation uses `gallery_image_urls` + `video_url`; on approve, gallery URLs copy to `festival_media` and `video_url` copies to `festivals.video_url`. See `scripts/sql/20260330_festival_media_gallery_video.sql`, `scripts/sql/20260405_festivals_video_url.sql`.
- **Public festival detail (web):** primary CTA „Напомни ми“ in the hero; plan/navigation/reminder timing in the sticky rail; compact facts strip (`FestivalQuickFactsStrip`); accommodation via `lib/accommodation/*` (optional `BOOKING_ACCOMMODATION_ENABLED` when a provider is implemented). External CTAs (website, tickets, maps, Booking.com search, partner accommodation) route through `GET /out` and append rows to `outbound_clicks` (service-role insert); admins review aggregates and recent rows at `/admin/outbound` (including a simple booking-intent signal per festival); the festival page may show a “popular for travel” label when booking clicks in the last 30 days meet a low threshold.
- **Р”Р°С‚Рё РІ Р°РґРјРёРЅ С„РѕСЂРјРё:** РєРѕРјРїРѕРЅРµРЅС‚ `DdMmYyyyDateInput` + `lib/dates/euDateFormat.ts` Р·Р° РІСЉРІРµР¶РґР°РЅРµ/РїРѕРєР°Р·РІР°РЅРµ РІ EU РїРѕРґСЂРµРґР±Р°.
- Admin moderation (`pending_festivals` edit/approve/reject, including multi-organizer drafts via `organizer_entries` jsonb and full `festival_organizers` sync on approve; legacy single `organizer_name` still supported)
- Admin audit logging (`admin_audit_logs`) records successful admin write actions (best-effort, non-blocking) for moderation and catalog mutations; read-only review at `/admin/activity` (paginated filters, service-role read after admin session check)
- Admin organizer quality controls (duplicate detection + manual merge workflow)
- Monetization layer: organizer plans (`free`/`vip`), event-level festival promotion (`normal`/`promoted`), yearly VIP promotion credits (`organizer_promotion_credits`), and listing priority that favors promoted and VIP-ranked content
- Admin ingest queue (`ingest_jobs` enqueue/retry/delete + job-to-record linking)
- Admin discovery dashboard (`discovery_sources` monitoring + source activation toggles + recent `discovery_runs` visibility)
- Admin email queue visibility (`/admin/email-jobs`, `/admin/email-jobs/[id]`): operational list + detail with `email_events` timeline; server-side service-role reads after admin gate — not a marketing/analytics dashboard
- Planning + reminders + notifications
- Transactional email queue (`email_jobs`): enqueue-first към Postgres, batch send през `GET /api/jobs/email` (jobs secret / Vercel cron) и Resend (`lib/email/*`); регистър на типове + BG шаблони в `emails/*` (Phase 2); enqueue след успех от `POST /api/organizer/claims`, `POST /api/organizer/pending-festivals`, `POST /admin/api/organizer-members/[id]/approve|reject`, `POST /admin/api/pending-festivals/[id]/approve|reject`; **напомняния за запазени фестивали** като втори канал към същите `notification_jobs` reminder слотове (`GET /api/notifications/run` → `reminder-1-day-before` / `reminder-same-day` за слотове `24h` / `2h`; legacy `/api/jobs/reminders` не праща тези имейли — виж `docs/notification-system.md`); опционално `EMAIL_ADMIN` за админ алерти; dev `GET /api/test-email` с `type` + JSON `payload` за преглед на шаблони; `dedupe_key` се задава при enqueue (`lib/email/emailDedupeKeys.ts`); claim approve/reject изпраща имейл само при реален `pending`→transition в DB; **Phase 4:** Resend Svix webhooks → `POST /api/email/webhook`, таблица `email_events`, обобщени delivery полета на `email_jobs` (виж `docs/notification-system.md`); **Phase 5:** `user_email_preferences` + категории типове (`lib/email/emailTypeCategory.ts`, `lib/email/emailPreferences.ts`), gating на опционални reminder имейли (**fail-closed** при prefs lookup грешка; required/admin **fail-open** при такава грешка), отделно от push (`user_notification_settings.push_enabled`), unsubscribe страница `/unsubscribe/[token]` + `POST /api/email/unsubscribe`, профил `GET/POST /api/email/preferences` (виж `docs/notification-system.md`)
- Account/profile hub (`/profile`) separated from planning (`/plan`); напомняния за плана: една секция с канали (`push_enabled`, имейл prefs) + **по подразбиране за ново запазени** фестивали (`user_notification_settings.default_plan_reminder_type` през `GET/POST /api/notification-settings`) и по избор **прилагане към вече запазените** (`POST /api/plan/reminders` с `applyToAllSaved`). При добавяне в плана (`POST /api/plan/festivals`) се записва `user_plan_reminders` според default-а и се вика `syncReminderJobsForPreference`.
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
- they can be copied into editable core fields via вЂњUseвЂќ actions
- core pending fields remain authoritative for save/approve
- only core moderated values are written into `festivals` during approval

Admin **festival research** (`POST /admin/api/research-festival`, page `/admin/research`) uses a **Gemini multi-step pipeline** (grounded search → ranked URLs → per-page JSON extraction → validation). Env: `GEMINI_API_KEY` or `GOOGLE_AI_API_KEY`; optional `GEMINI_RESEARCH_MODEL`.

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

**РњРѕСЏС‚ РїР»Р°РЅ (UX):** РќР° Р»РёСЃС‚РёРЅРі РєР°СЂС‚РёС‚Рµ СЃР°РјРѕ вЂћР—Р°РїР°Р·РёвЂњ/вЂћР—Р°РїР°Р·РµРЅРѕвЂњ (Р±РµР· Р»РёРЅРє вЂћРџСЂРѕРіСЂР°РјР°вЂњ Рё Р±РµР· РЅР°РїРѕРјРЅСЏРЅРµ РІ РєР°СЂС‚Р°С‚Р°). РќР° РєР°СЂС‚Р°С‚Р° (`MapView`) Рё РґРµС‚Р°Р№Р»Р° РѕСЃС‚Р°РІР°С‚ РїСЂРѕРіСЂР°РјР° + РЅР°РїРѕРјРЅСЏРЅРµ РєСЉРґРµС‚Рѕ Рµ РїРѕРґС…РѕРґСЏС‰Рѕ. вЂћР—Р°РїР°Р·РёвЂњ Р·Р°РїРёСЃРІР° С†РµР»РёСЏ С„РµСЃС‚РёРІР°Р» (`user_plan_festivals`); РѕС‚РґРµР»РЅРё С‡Р°СЃРѕРІРµ вЂ” РѕС‚ РґРµС‚Р°Р№Р»РЅР° СЃС‚СЂР°РЅРёС†Р° вЂћРџСЂРѕРіСЂР°РјР°вЂњ (`user_plan_items`). РќР°РїРѕРјРЅСЏРЅРёСЏС‚Р° СЃР° РєСЉРј С„РµСЃС‚РёРІР°Р»Р°. РЎРµРєС†РёСЏ вЂћРџСЂРѕРіСЂР°РјР°вЂњ РЅР° РґРµС‚Р°Р№Р»: anchor `#festival-program` (`lib/festival/programmeAnchor.ts`).
- `user_notifications`
- `device_tokens`

Database schema: **Supabase** is authoritative; follow queries, types, and `scripts/sql/` in this repo. The file `docs/database-schema.md` is not guaranteed current and is not required reading for agents.

## Organizer duplicate management
- Organizer duplicates are reviewed manually in admin at `/admin/organizers/duplicates`.
- Duplicate candidates are conservative-only: exact normalized name, exact slug, exact `facebook_url` (when present).
- Merges are manual via `/admin/api/organizers/merge`; no auto-merge job exists.
- Merge behavior moves organizer links in `festival_organizers` (plus compatibility fields `festivals.organizer_id` and `pending_festivals.organizer_id`) to a canonical organizer, backfills missing target profile fields, then marks source organizer inactive (`is_active=false`, `merged_into=target`).
- Organizer list/public lookups use active organizers by default (`is_active=true`).
- Organizer edit includes AI enrichment (`/api/admin/research-organizer`) for profile fields (`description`, `logo_url`, official/social URLs, contact data) with admin review before save.
- New organizers can be researched and created from `/admin/organizers/research` (linked next to duplicate detection on the organizers list); flow calls the same research API then `POST /admin/api/organizers` and redirects to edit.

## Organizer portal (user-managed organizers, MVP)
- Public `organizers` rows remain the canonical profile; registered users link via `organizer_members` (`owner`/`admin`/`editor`, `pending`/`active`/`revoked`). Editorial organizers without auth users are unchanged.
- `/organizer` (entry) adapts CTAs by session and `organizer_members`: dashboard and portal tools only after at least one **active** membership (`owner`/`admin`/`editor`). Pending-only members see a review message without dashboard access; revoked-only (no active/pending) see an explanatory note. `/organizer/dashboard`, `/organizer/submissions`, `/organizer/festivals/new`, and submission edit require active membership server-side; `/organizer/profile/new` and `/organizer/claim` require sign-in (layout redirect) and create organizer + active owner (new profile) or pending claim (`POST /api/organizer/claims` with contact email/phone for verification; revoked row for same user is reset to pending claim with updated contact). Admin approves or rejects claims at `/admin/organizer-claims` (list + detail show contact for staff only): `POST /admin/api/organizer-members/[id]/approve` or `.../reject` (reject → `status=revoked`). Bulgarian UI; separate from `/admin`.
- Festival submissions from the portal insert into `pending_festivals` with `submission_source=organizer_portal`, `submitted_by_user_id`, and `organizer_id`; publishing still only via existing admin approve flow. Approve prefers `pending_festivals.organizer_id` when set so the festival links to the claimed profile without duplicating organizers by name.
- SQL: `scripts/sql/20260328_organizer_members_portal.sql`.

## Notification System
Напомняния и откриване: по-старият поток пише в `user_notifications` и се изпраща през `/api/jobs/push` към `device_tokens`. От 2026-03: MVP опашка `notification_jobs` + `notification_logs`, изпълнение през `/api/notifications/run`; тригери от план, админ редакция и одобряване на pending. High-frequency scheduling е external-first (worker/cron service), Vercel се ползва само за low-frequency cron когато е нужно. Job endpoint-ите приемат `x-job-secret: JOBS_SECRET` и използват `cron_locks` за anti-overlap. Ограничения: приоритет high/normal, time-window дедупликация, rate limit по логове 24 ч, тихи часове (reminder без препланиране), retry/backoff — виж `docs/notification-system.md`.

Details: `docs/notification-system.md`.
