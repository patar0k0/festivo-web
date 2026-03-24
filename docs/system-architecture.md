# Festivo System Architecture

## Runtime components

### festivo-web (this repository)
Next.js application responsible for:
- public festival pages and queries
- admin ingestion/moderation UI
- admin API routes for pending/festival/ingest management
- reminder/follow/push job endpoints under `/api/jobs/*`

### festivo-workers (external runtime, represented here by helper code)
Ingestion workers consume `ingest_jobs`, parse source pages/events, and update moderation records.

This repo includes worker helper logic in `workers/ingest_fb_event.js` for:
- Facebook event field extraction
- date/location normalization
- hero-image rehosting to Supabase Storage

## Edge middleware: API POST hardening (festivo-web)

`middleware.ts` runs on the Edge runtime and applies **only to `POST` requests** whose path starts with `/api/`.

### Rate limiting (Upstash)

- **Implementation:** `lib/rateLimit.ts` uses `@upstash/ratelimit` with `@upstash/redis/cloudflare` (Edge-compatible). Redis keys are **per bucket** and **per identity**: if the request has a logged-in session (`getSession()` in `lib/middlewareSession.ts`, read-only-no cookie write), the key uses **`auth.users` id**; otherwise **client IP** (from `x-forwarded-for` / `x-real-ip`).
- **Activation:** requires both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. If either is missing, limits are skipped (no error).
- **Fail-open:** if Upstash throws (network, auth, etc.), the request is **not** blocked-site must not return `500` because of rate limiting.
- **Jobs bypass** (applies to `/api/jobs/*` only): Vercel Cron header `x-vercel-cron`, or `x-job-secret` matching `JOBS_SECRET`. Same bypass is used for the origin check below.

**Buckets (fixed windows):**

| Prefix / path | Limit |
|---------------|-------|
| `/api/auth/*`, `/api/admin/auth/*` | 5 / 60s |
| `/api/admin/research-ai` | 10 / 60s |
| `/api/jobs/*` | 10 / 60s (unless bypassed) |
| `/api/plan/*`, `/api/follow/*`, `POST /api/device-token`, `POST /api/notification-settings` | 30 / 60s |
| other `POST /api/*` | 20 / 10s |

Limited responses: **429** with `Retry-After` (seconds).

### Origin / Referer guard (CSRF-ish)

- **Implementation:** `lib/postOriginGuard.ts` - `verifyApiPostOrigin(request)`.
- **Behavior:** if `Origin` or `Referer` is present, the URL's **host** must be in an allowlist built from `NEXT_PUBLIC_SITE_URL`, `VERCEL_URL`, optional comma-separated `CSRF_ALLOWED_HOSTS`, dev localhost hosts, and mutual inclusion of `festivo.bg` / `www.festivo.bg`.
- **No `Origin` and no `Referer`:** allowed (e.g. `curl`, some server clients).
- **Empty allowlist:** fail-open (do not block) - typically only when neither site URL nor Vercel URL is set.
- **Jobs:** same bypass as rate limit for trusted job callers.
- Rejection: **403** with a small JSON body.

Env var summary for production also lives in `README.md` (`UPSTASH_*`, `CSRF_ALLOWED_HOSTS`, `JOBS_SECRET`).

Auth UX includes signup/login and password recovery: `/signup` creates email+password users (`auth.signUp`), `/login` sends Supabase reset emails, and `/reset-password` applies `auth.updateUser({ password })` for valid recovery sessions.

## Moderation-first content flow

1. **Queue source URL**
   - Admin posts Facebook event URLs to `/admin/api/ingest-jobs`.
   - URL is validated and normalized, then inserted into `ingest_jobs`.

2. **Ingestion worker processing**
   - Worker marks job lifecycle in `ingest_jobs` (`pending/processing/done/failed`).
   - Worker may persist `ingest_jobs.fb_browser_context` (authenticated Playwright FB state vs anonymous) for admin diagnostics.
   - Worker creates or updates `pending_festivals` (actual worker orchestration is not implemented in Next.js routes here). Recent worker versions also map extra event fields (e.g. external website, ticket URL, price range) and hero metadata columns when present in the DB.

3. **Admin moderation of pending record**
   - `/admin/pending-festivals`: lists only `status=pending`.
   - `/admin/pending-festivals/[id]`: full record editing; may show last linked `ingest_jobs` status, finish time, and `fb_browser_context`. Optional вЂњfilled fieldsвЂќ summary uses `lib/admin/pendingFestivalQuality.ts`.
   - Save route (`PATCH /admin/api/pending-festivals/[id]`) updates pending core fields.
   - Hero image import from URL: `PATCH /admin/api/pending-festivals/[id]/hero-image` (server-side rehost via `lib/admin/rehostHeroImageFromUrl.ts`).

4. **Decision**
   - Approve (`POST /admin/api/pending-festivals/[id]/approve`):
     - validates pending status still `pending`
     - resolves city input to canonical `cities.id`
     - enforces start date + slug/source_url conflict checks
     - inserts a new `festivals` row (`status=verified`, `is_verified=true`)
     - marks pending row `approved`
     - rollback: deletes inserted festival if pending status update fails
   - Reject (`POST /admin/api/pending-festivals/[id]/reject`):
     - updates pending row to `rejected` with reviewer metadata

## Admin ingest status linking and moderation-cycle behavior
The admin ingest page does cross-table matching between each job and moderation/public records using:
- exact `source_url`
- normalized URL (`lib/admin/sourceUrlMatching.ts`)
- extracted Facebook event id

Displayed workflow actions/states are derived from queue + moderation outcome:
- in progress (`pending` / `processing` / non-done)
- open pending review
- open published festival
- rejected
- approved without linked festival
- no pending record

Retry behavior is explicit and limited:
- only `failed` jobs can be retried
- retry resets job to `status=pending` and clears `started_at`, `finished_at`, `error`
- jobs can also be removed from queue via admin delete

## AI autofill and authority boundaries
`pending_festivals` may contain AI/normalization guess fields (e.g. cleaned title/description, city/date/location/tags/coordinates guesses).

Current behavior in admin edit UI:
- AI values are shown as hints and comparison statuses
- admin can apply guessed values into editable core fields
- вЂњUse all safe valuesвЂќ only fills missing fields
- core moderated fields remain authoritative for save/approve

Admin festival research (`/admin/api/research-festival`) uses a simplified backend flow:
- query generation + web search
- authority-first ranking of trustworthy Bulgarian sources
- fetch and clean top source text excerpts
- one structured LLM extraction call over source payloads
- moderator review and optional insert into `pending_festivals`

If LLM extraction fails/unavailable, the API returns a low-confidence minimal result with sources + warnings (preferring null over speculative values).

`/api/admin/research-ai` (Perplexity-backed extraction) uses a strict structured first pass plus additive follow-up passes:
- enrichment runs when first-pass has enough still-null factual fields (low threshold for admin UX)
- follow-up passes inherit `source_urls` from the prior pass so Perplexity responses that omit URLs do not trigger вЂњfacts without sourcesвЂќ wipes
- optional third pass runs when merged result still has many missing fields
- merge is additive-only (fills nulls, preserves already extracted non-null values)
- single-day convenience: if `end_date` is null but `start_date` is set, `end_date` mirrors `start_date`
- light `is_free` hint from description text (e.g. вЂњР±РµР·РїР»Р°С‚РµРЅвЂќ) when the model omitted the boolean
- on enrichment failure, system returns first-pass result (no hard failure)

## Hero image pipeline safeguards
Ingestion helper behavior for candidate hero image:
- source preference: `fbEvent.cover.source` в†’ OG image в†’ existing pending hero image
- Facebook-hosted URL detection by hostname patterns
- validation before rehost:
  - request timeout
  - redirect cap
  - max bytes
  - image content-type requirement
  - non-empty body
- rehost target: Supabase Storage bucket (`festival-hero-images` default)

Failure policy for detected Facebook URLs is fail-closed in current defaults:
- `allowOriginalOnFailure=false`
- if validation or upload fails, stored hero image becomes `null`
- HTML error bodies (e.g. Facebook login walls) and similar failures are surfaced with explicit error text in admin import flows

Published festivals support the same pattern: `PATCH /admin/api/festivals/[id]/hero-image` for moderator-initiated rehost from a URL.

`pending_festivals` may store hero provenance columns (`hero_image_source`, `hero_image_original_url`, `hero_image_score`, `hero_image_fallback_reason`) populated by the worker or admin import (`scripts/sql/20260322_add_pending_festivals_hero_ingest_columns.sql`).

## Public vs admin data visibility
- Public discovery/detail queries read from `festivals` only.
- Public scope includes rows matching `status in (published, verified)` or `is_verified=true`, and excludes `status=archived`.
- **Festival date filtering:** when `occurrence_dates` (jsonb) holds discrete ISO days, listing/calendar/filter logic treats those days as the event schedule; otherwise overlap uses `start_date`/`end_date`. The database exposes `public.festivals_intersecting_range(from, to)` for window queries (see `scripts/sql/20260323_festival_occurrence_dates.sql`). Admin pending/published edit forms can maintain `occurrence_dates`; approve copies it into `festivals`.
- Pending moderation records are admin-only.
- Public festival detail uses `FestivalGallery` when processed media items exist (replaces older inline-only gallery wiring in `FestivalDetailClient`).
- Admin published-festival actions:
  - archive (`status=archived`)
  - restore (`status=verified`)
  - delete (hard delete)

## Notification pipelines (current)
Reminder/discovery jobs and push delivery remain as implemented in `/api/jobs/*` and documented in `docs/notification-system.md`; this ingest/moderation sync does not change those flows.


## Admin organizers management
- Admin has dedicated organizer management screens at `/admin/organizers`, `/admin/organizers/[id]`, and duplicate review at `/admin/organizers/duplicates`.
- Pending approval resolves `pending_festivals.organizer_name` to `organizers.id` (exact normalized-name match), auto-creating organizer rows when needed, then writes relation rows to `festival_organizers`.
- Duplicate candidates are conservative-only (exact normalized name, exact slug, exact `facebook_url` when present).
- Manual merge endpoint `/admin/api/organizers/merge` reassigns `festival_organizers.organizer_id` (plus compatibility fields `festivals.organizer_id` and `pending_festivals.organizer_id`), backfills missing target profile fields from source, then marks source organizer inactive (`is_active=false`, `merged_into=target_id`).
- Organizer list and public organizer profile lookups use active organizers by default (`is_active=true`).
- Approved festivals persist organizer links in `festival_organizers`, keep `festivals.organizer_id` as compatibility, and keep `organizer_name` as display fallback only.
- Organizer profile enrichment supports admin AI research via `/api/admin/research-organizer` (Perplexity structured extraction); UI is embedded in organizer edit form and applies extracted values only after moderator action.

