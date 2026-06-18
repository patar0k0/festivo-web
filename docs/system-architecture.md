# Festivo System Architecture

## Runtime components

### festivo-web (this repository)
Next.js application responsible for:
- public festival pages and queries
- mobile JSON endpoints (`/api/mobile/festivals`, `/api/mobile/festivals/[slug]`, `/api/mobile/recommendations`, `/api/mobile/onboarding/suggestions`)
- admin ingestion/moderation UI
- admin API routes for pending/festival/ingest management
- reminder/follow/push job endpoints under `/api/jobs/*`

### festivo-workers (external runtime, represented here by helper code)
Ingestion workers consume `ingest_jobs`, parse source pages/events, and update moderation records.

This repo includes worker helper logic in `workers/ingest_fb_event.js` for:
- Facebook event field extraction
- date/location normalization
- hero-image rehosting to Supabase Storage

### Discovery seed (admin UI + workers)

**Purpose:** Operators configure **discovery sources** (seed URLs / site types); an external **discovery seed worker** (`festivo-workers`, e.g. `discovery_seed_worker.js`) loads active sources, fetches pages, scores link candidates, writes **`discovered_links`**, updates **`discovery_runs`** (counters + **`metadata_json`**: per-source status/performance, disabled-source hints, learning/aggregator breakdown), and enqueues **`ingest_jobs`** for high-scoring URLs.

**festivo-web (admin):**
- Dashboard **`/admin/discovery`**: lists sources, run history, link inspector, source-quality aggregates; default table scope is **active sources** (`is_active !== false`); an **Inactive** filter shows soft-deactivated rows.
- **HTTP APIs** under **`/admin/api/discovery-sources`**: `POST` creates a source (includes **`label`** when required by DB); **`PATCH`** updates activity, limits, manual overrides (**`manual_disabled`** / **`manual_override`**), and catalog fields (**`name`**, **`label`**, **`base_url`**, **`source_type`** within an allowed set including **`aggregator_site`**); **`DELETE`** is a **soft deactivate** (sets **`is_active = false`** and **`manual_disabled = true`**, clears **`manual_override`**) — no physical row delete.
- Service-role writes after the admin session gate; audit logging on mutating routes where implemented.

**Discovery Control Plane (`scripts/sql/20260608_discovery_control_plane.sql`):**
- **`discovery_config`** — singleton (`id = 1`) of admin-tunable knobs: `score_threshold`, `max_sources_per_run`, `max_links_per_source`, `max_jobs_per_run`, `fetch_timeout_ms`, `soft_disable_approval_floor`, `soft_disable_min_enqueued`, `recovery_every`, `cron_enabled`. RLS admin-only; worker reads via service role.
- **`discovery_run_requests`** — queue of on-demand run requests (`status` requested→claimed→done/failed, `mode` full/single_source, `lock_token`, `run_id` → `discovery_runs`). A **partial unique index** (`status = 'requested'` over `(mode, coalesce(source_id, -1))`) prevents duplicate pending requests.
- **APIs:** `GET|PATCH /admin/api/discovery/config` (validated), `POST /admin/api/discovery/run` (creates/dedupes a request), `GET /admin/api/discovery/requests` (live status). UI: `components/admin/DiscoveryControlPanel.tsx` (run button + config form + requests panel, polls while active).
- **Coordination is Supabase-only** (worker takes no inbound HTTP). On each Railway cron tick the worker `readDiscoveryConfig()` (fallback env/defaults) then `claimRunRequest()` (atomic via `lock_token` race guard); if none pending and `cron_enabled` → scheduled run; else skip. Score threshold is threaded into `isScoreEligible(..., baseThreshold)` additively (default preserves 65/50 behavior).

**festivo-workers (discovery):**
- **`discovery_sources`** allowed **`source_type`** values include **`facebook_page`**, **`municipality_site`**, **`aggregator_site`** (worker allowlist in `discovery_helpers.js`).
- Per-source **`manual_disabled`**: source is always skipped; **`manual_override`**: skips auto soft-disable and approval-rate **penalties** (scoring caps/dedup/hard rejects unchanged).
- **`workers/lib/discovery_helpers.js`**: **`scoreDiscoveryCandidate`** applies base rules, learning boosts/penalties, and **aggregator-domain** heuristics (detail-page boosts vs listing rejects, optional Facebook event signal from anchors on the fetched page); **`extractAnchorCandidates`** returns candidates plus page-level signals for scoring.

Schema notes (flags, `label`, `source_type` checks) live in **`scripts/sql/`**; live Postgres remains authoritative.

## Security configuration

Defense in depth spans the **festivo.bg** edge (Cloudflare) and the **festivo-web** application (Next.js, Supabase).

### Cloudflare (festivo.bg)

Production domain protection is configured in the Cloudflare dashboard (not driven from this repository). Current settings include:

- **Bot fight mode:** enabled
- **Block AI bots:** enabled
- **Browser integrity check:** enabled
- **Continuous script monitoring:** enabled
- **Hotlink protection:** enabled
- **Cloudflare managed ruleset:** enabled
- **Leaked credentials detection:** enabled
- **HTTP DDoS attack protection:** enabled
- **Network-layer DDoS attack protection:** enabled

### Application layer (festivo-web)

- **Turnstile bot protection:** **`/signup`**, **`/organizer/profile/new`**, and **`/organizer/claim`** use the widget when site keys are set; corresponding API routes verify tokens server-side. Implementation detail: **Cloudflare Turnstile (public forms)** under Edge middleware below.
- **Rate limiting:** Upstash, **per bucket** and **per identity** (logged-in user id vs client IP). Implementation detail: **Rate limiting (Upstash)** under Edge middleware below.
- **Origin / Referer guard:** allowlisted hosts for `POST /api/*`. Implementation detail: **Origin / Referer guard (CSRF-ish)** under Edge middleware below.
- **RLS policies:** Supabase Postgres; user-owned and role-scoped tables rely on Row Level Security. Policy definitions live in the database (see repo rules: live Postgres / `scripts/sql/` as the authority for schema and RLS).
- **Admin staff role (UI gate):** canonical role rows live in **`public.user_roles`** (`admin` / `super_admin`). The app mirrors staff into Auth **`app_metadata.role`** via **`syncUserRoleToJwt`** (after role changes and when a staff user hits admin with a stale JWT) so server layouts and **`SiteHeader`** can treat the JWT as a fast path; **`hasAdminRole`** / **`resolveAdminAccessOrRedirect`** still fall back to **`user_roles`** when the claim is missing. Data access remains enforced by RLS and service-role admin APIs, not by the claim alone.

## Edge middleware: API POST hardening (festivo-web)

`middleware.ts` runs on the Edge runtime on matched app routes.

### Rate limiting (Upstash)

- **Scope:** **`POST`**, **`PATCH`**, **`PUT`**, and **`DELETE`** to paths under **`/api/*`** or **`/admin/api/*`**. **`GET`** (and other methods) are not rate-limited at the edge.
- **Implementation:** `lib/rateLimit.ts` uses `@upstash/ratelimit` with `@upstash/redis/cloudflare` (Edge-compatible). Redis keys are **per bucket** and **per identity**: if the request has a logged-in session (`getSession()` in `lib/middlewareSession.ts`, read-only-no cookie write), the key uses **`auth.users` id**; otherwise **client IP** (from `x-forwarded-for` / `x-real-ip`).
- **Activation:** requires both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. If either is missing, limits are skipped (no error).
- **Fail-open:** `checkRateLimit` does not block the site if Upstash throws (network, auth, etc.); the site must not return `500` because of rate limiting.
- **Jobs rate-limit / origin bypass** (`canBypassJobsRateLimit` in `lib/rateLimit.ts`; trusted job `POST`s to `/api/*`): applies to `/api/jobs/*`, `/api/notifications/*`, and `/api/cron/*` — header `x-vercel-cron`, or `x-job-secret` matching `JOBS_SECRET`.
- **Job route authorization** (`isAuthorizedJobRequest` in `lib/jobs/auth.ts`, used by `/api/jobs/*`, `/api/notifications/*`, `/api/cron/*`): `x-job-secret` matching `JOBS_SECRET`, or (TEMP) `User-Agent` containing `vercel-cron` for Vercel Cron without a custom secret (Hobby limitation).

**Buckets (fixed windows):** path prefixes are evaluated against `request.nextUrl.pathname` (same for `/api/*` and `/admin/api/*` where the suffix matches).

| Prefix / path | Limit |
|---------------|-------|
| `/api/auth/*`, `/api/admin/auth/*` | 5 / 60s |
| `/api/admin/research-ai` | 10 / 60s |
| `/api/jobs/*`, `/api/notifications/*`, `/api/cron/*` | 10 / 60s (unless bypassed) |
| `/api/plan/*`, `/api/follow/*`, `POST /api/device-token`, `POST /api/push/register`, `POST /api/notification-settings`, `POST /api/email/preferences`, `POST /api/email/unsubscribe` | 30 / 60s |
| `POST /api/email/webhook` | skipped (Resend server-to-server; auth = Svix signature) |
| other write requests under `/api/*` or `/admin/api/*` | 20 / 10s |
| **Second cap:** destructive admin user actions (`DELETE`/`POST` on `/admin/api/users/*` soft+hard delete, restore, ban, force-logout, reset-password, `DELETE /api/admin/users/[id]/hard-delete`, `POST /admin/api/users/bulk`) | **20 / 60s** per admin (in addition to path-specific bucket above) |
| `POST /admin/api/users/bulk` (ban / soft_delete) | also consumes **per-target** tokens: **60 operations / 60s** per admin (each user id in the body counts as one operation) |

Limited responses: **429** with `Retry-After` (seconds).

### Origin / Referer guard (CSRF-ish) for `POST /api/*`

For **`POST` requests** whose path starts with **`/api/`** only (not other methods, not `/admin/api/*`), the following applies.

- **Implementation:** `lib/postOriginGuard.ts` - `verifyApiPostOrigin(request)`.
- **Behavior:** if `Origin` or `Referer` is present, the URL's **host** must be in an allowlist built from `NEXT_PUBLIC_SITE_URL`, `VERCEL_URL`, optional comma-separated `CSRF_ALLOWED_HOSTS`, dev localhost hosts, and mutual inclusion of `festivo.bg` / `www.festivo.bg`.
- **No `Origin` and no `Referer`:** allowed (e.g. `curl`, some server clients, Resend webhooks).
- **Empty allowlist:** fail-open (do not block) - typically only when neither site URL nor Vercel URL is set.
- **Jobs:** same bypass as rate limit for trusted job callers.
- Rejection: **403** with a small JSON body.

### Cloudflare Turnstile (public forms)

- **Client:** `components/TurnstileWidget.tsx` loads `https://challenges.cloudflare.com/turnstile/v0/api.js` and renders the widget when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set.
- **Forms:** Email/password signup (`POST /api/auth/signup`), create organizer (`POST /api/organizer/organizers`), and organizer claim (`POST /api/organizer/claims`) send a `turnstileToken` in the JSON body; submit stays disabled until a token exists when the site key is present.
- **Server:** `lib/turnstile.ts` posts tokens to `https://challenges.cloudflare.com/turnstile/v0/siteverify` with `TURNSTILE_SECRET_KEY`. On verification failure (or empty token when enforcement is on), routes return **403** with `{ "error": "Bot protection check failed." }`.
- **Fail-open:** If either `NEXT_PUBLIC_TURNSTILE_SITE_KEY` or `TURNSTILE_SECRET_KEY` is missing, verification is skipped and the server logs a one-time warning (local dev without keys). Production should set both.

Env var summary for production also lives in `README.md` (`UPSTASH_*`, `CSRF_ALLOWED_HOSTS`, `JOBS_SECRET`, Turnstile keys).

### Pathname for layout (internal)

`middleware.ts` forwards `request.nextUrl.pathname` on `NextResponse.next()` as request header `x-festivo-pathname` (overwrites any client-supplied value). The root shell uses it server-side with `FESTIVO_PUBLIC_MODE` and the `festivo_preview` cookie so **coming-soon** and **`/coming-soon`** render without the public header/footer (no catalog navigation on those surfaces). В **coming-soon** режим пътищата под **`/unsubscribe`** също са allowlisted, за да работят линкове от имейл.

Auth UX includes signup/login and password recovery: `/signup` creates email+password users via `POST /api/auth/signup` (Supabase `signUp` on the server; Cloudflare Turnstile when keys are set), `/login` sends Supabase reset emails, and `/reset-password` applies `auth.updateUser({ password })` for valid recovery sessions.

**Soft-deleted vs banned sessions:** `middleware.ts` loads the current user with `supabase.auth.getUser()`, then **upserts** `public.users` (`id`, `email`) for that user with **on conflict do nothing** semantics (`ensurePublicUserRowForSession` in `lib/ensurePublicUserRowForSession.ts`; RLS policy **`users_insert_own_row`** in `scripts/sql/20260504_users_rls_authenticated_insert_own_row.sql`) so a shadow row exists **before** the gate read. It then reads optional `public.users.deleted_at` and **`public.users.banned_until`** (RLS: authenticated may `select` only their own row). The `users` lookup retries briefly on transient errors and is **short-TTL cached in-process** (`lib/middlewareUserGateCache.ts`, a few seconds) to cut repeated DB reads on hot paths; admin **ban/unban**, **soft delete**, **restore**, and hard-delete/sweep cleanup paths call **`invalidateCachedUserGate`** so the next request re-reads `users`. If `deleted_at` is set, the user is redirected to `/account-deleted` without signing out so `app/account-deleted/page.tsx` can confirm `users.deleted_at` server-side; other routes still send them back there. Authenticated **`/api/*` routes** that require a logged-in user use **`requireActiveUser` / `requireActiveUserWithSupabase`** (`lib/auth/requireActiveUser.ts`), which rejects sessions when `users.deleted_at` is set (**403**); **`getOptionalUser`** (`lib/authUser.ts`) treats soft-deleted accounts as logged out for server-rendered pages and optional flows (e.g. analytics `user_id`). **`getPortalSessionUser`** (`lib/organizer/portal.ts`) does the same for organizer portal APIs so soft-deleted users cannot act as organizers while a JWT still exists. If **either** the JWT’s `banned_until` **or** the DB mirror `users.banned_until` indicates an active ban, the user is signed out and redirected to `/banned`. Admin ban/unban updates Auth and then **`admin_sync_user_banned_until`** (see `scripts/sql/20260430_admin_user_sweep_ban_cleanup.sql`) so the mirror stays aligned; if DB sync fails after a ban, APIs attempt to roll back the Auth ban. If rollback also fails, **`users.ban_sync_error`** is set and a **`ban_sync_rollback_failed`** row is written to **`admin_audit_logs`** for manual reconciliation.

**RLS vs soft-deleted `authenticated`:** User-owned tables that already use permissive RLS for `authenticated` also have a **RESTRICTIVE** policy **`block_deleted_users`** (`scripts/sql/20260503_rls_block_soft_deleted_users.sql`) requiring `exists (select 1 from public.users u where u.id = auth.uid() and u.deleted_at is null)`, so a valid JWT alone cannot read or write those rows after soft delete. **`public.users`** is excluded; **`service_role`** bypasses RLS for jobs and admin/server paths.

**Post-auth sweep reliability:** Before `auth.admin.deleteUser` (admin hard-delete: production **`DELETE /api/admin/users/[id]/hard-delete`**, dev-only **`DELETE /admin/api/users/[id]/hard`**, and self-service **`POST /api/account/delete`**), the app enqueues **`user_sweep_retry_queue`** (one row per user; **`next_retry_at`** / **`attempts`** with exponential backoff + 0-30% jitter and **`seen_in_auth_before`**) and sets **`users.cleanup_pending`** when a shadow row exists. `seen_in_auth_before` is treated as write-once true (never downgraded). `admin_sweep_user_after_auth_delete` runs with retries; on success **`clearUserSweepTracking`** removes the queue row, clears **`cleanup_pending`**, and invalidates middleware gate cache (best-effort, non-blocking). Production scheduling uses **`GET /api/cron/worker`** (Vercel Cron, typically every five minutes), which runs notification batching, email jobs, legacy reminders/push, weekend digest scheduling when local Sofia time matches the historical slots, and (at most once per 60 minutes, tracked via a `cron_locks` marker row) delegates to **`GET /api/jobs/user-sweep-retry`**. That sweep endpoint remains overlap-protected by `cron_locks` with a short lock TTL (3 minutes) and claims due work with **`admin_claim_user_sweep_retry_batch`** (`SELECT … FOR UPDATE SKIP LOCKED` plus **`locked_until`** lease; expired leases are reclaimable). The handler runs in two explicit phases (ban-sync retry, then sweep retry) and logs lightweight queue stats (`pending`, `retrying`, `failedMaxAttempts`). After **five** failed attempts, an **orphan** path (auth user missing) may finish the sweep with zero deletes only when the queue row indicates the user was previously seen in Auth; never-seen rows are dropped from the queue to avoid permanent false-orphan retries. The same cron run performs lightweight retries for users marked with **`ban_sync_error`** and clears the flag on successful Auth↔DB sync. Sweep logs include RPC errors and post-success counts; all-zero counts when the auth user **did** exist before the operation are treated as a hard error.

Staff soft-delete and session revoke remain via `admin_set_user_soft_deleted` in `scripts/sql/20260503_admin_user_delete_uuid_compare.sql` (optional `deleted_reason` sanitized in-RPC); `public.users.email` mirrors Auth at RPC / ban-sync time (`scripts/sql/20260504_public_users_email_mirror.sql`) so hard-delete confirmation compares `confirm_email` to the **database** row, not client-trusted detail payloads. `user_roles` uses RLS so authenticated users can only `select` their own role row (writes go through service-role admin APIs).

**Admin user API rate limits (Upstash):** stricter fixed-window buckets apply to `DELETE /admin/api/users/[id]` (soft delete), `DELETE .../hard`, **`DELETE /api/admin/users/[id]/hard-delete`** (production hard delete; shares the same hard-delete bucket as `.../hard`), `POST .../reset-password`, and `POST .../force-logout`, plus a **global destructive cap** for all high-risk user routes (see table above), keyed by the logged-in admin’s user id when the session is present.

**Audit logs:** `logAdminAction` logs insert failures and performs **one delayed async retry**; it does not fail the HTTP handler after the primary action has already succeeded. Rows may include **`dedupe_key`** (hash of actor/entity/action plus high-precision nonce) and the same key is reused for the delayed retry to avoid duplicate audit rows without breaking main flow.

## Moderation-first content flow

Unified rule: **new catalog candidates reach `pending_festivals` only via `ingest_jobs`** (worker insert). Exceptions outside this doc’s ingestion scope (e.g. organizer portal drafts) remain as implemented.

1. **Enqueue `ingest_jobs`**
   - **Facebook (manual):** `POST /admin/api/ingest-jobs` with `source_url` → `source_type=facebook_event`, optional `payload_json.submission_source=ingest`.
   - **Discovery (manual):** same route with `source_type=discovery`, `source_url`, optional `discovered_link_id` → worker scrapes URL (routes to FB vs generic web by URL); `pending_festivals.submission_source=discovery`.
   - **Research (Gemini / Perplexity):** `POST /admin/api/ingest-jobs` with `source_type=research` and `result`/`final_values` or `ai_result`. Festivo-web builds a **handoff snapshot** (geocode + hero rehost + row shape) in `ingest_jobs.payload_json.pending_row` with `submission_source=research`, then runs a **post-AI quality pass** (fetch primary URLs, fill gaps, validate required fields, structural **confidence score** + **`needs_review`** flag — see *Post-AI row quality* under AI research below). Worker **does not scrape**; it inserts `pending_festivals` from that snapshot (treats new columns as optional if the DB is not migrated yet).
   - Legacy alias: `POST /admin/api/research-festival/create-pending` enqueues the same research job (deprecated path).

2. **Ingestion worker processing**
   - Worker marks job lifecycle in `ingest_jobs` (`pending` / `processing` / `done` / `failed` only).
   - Worker may persist `ingest_jobs.fb_browser_context` (authenticated Playwright FB state vs anonymous) for scrape jobs; unused for `research`.
   - Worker creates or updates `pending_festivals` (orchestration lives in festivo-workers). Scrape jobs map extra event fields when present in the DB; research jobs map from `payload_json`.

3. **Admin moderation of pending record**
   - `/admin/pending-festivals`: lists only `status=pending`.
   - `/admin/pending-festivals/[id]`: full record editing; may show last linked `ingest_jobs` status, finish time, and `fb_browser_context`. Optional вЂњfilled fieldsвЂќ summary uses `lib/admin/pendingFestivalQuality.ts`.
   - Admin manual coord helper: `POST /api/admin/geocode` (admin-gated) normalizes BG location/city text and returns lat/lng (Google-first geocoding with OSM fallback).
   - Save route (`PATCH /admin/api/pending-festivals/[id]`) updates pending core fields.
   - Hero image import from URL: `PATCH /admin/api/pending-festivals/[id]/hero-image` (server-side rehost via `lib/admin/rehostHeroImageFromUrl.ts`).
   - Extra gallery images + optional video (YouTube/Facebook page URL): pending uses `POST/DELETE /admin/api/pending-festivals/[id]/gallery-image` and `PUT /admin/api/pending-festivals/[id]/video` (also persisted via `PATCH` save on `gallery_image_urls` / `video_url`); published festivals use `GET/POST /admin/api/festivals/[id]/media`, `DELETE /admin/api/festivals/[id]/media/[mediaId]`, and `PUT /admin/api/festivals/[id]/media/video` (writes **`festivals.video_url`**, not `festival_media`). Approve copies pending gallery images into `festival_media` and copies `video_url` onto the new `festivals` row. Admin deletes of gallery rows or pending gallery URLs remove the corresponding object from the **`festival-hero-images`** bucket (env `SUPABASE_HERO_IMAGES_BUCKET`) when the stored URL is this project’s public Storage URL (`/storage/v1/object/public/<bucket>/…`); external gallery URLs are not deleted from Storage.

4. **Decision**
   - Approve (`POST /admin/api/pending-festivals/[id]/approve`):
     - validates pending status still `pending`
     - resolves city input to canonical `cities.id`
     - enforces start date + slug/source_url conflict checks
     - inserts a new `festivals` row (`status=verified`, `is_verified=true`)
     - carries geocode metadata from pending to published (`place_id`, `geocode_provider`)
     - copies gallery / video, then applies **`pending_festivals.program_draft`** into **`festival_days`** + **`festival_schedule_items`** (replace semantics; failure rolls back the new `festivals` row like `festival_media` failures)
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
- retry resets job to `status=pending` and clears `started_at`, `finished_at`, `error` (never `queued`)
- jobs can also be removed from queue via admin delete

## AI autofill and authority boundaries
`pending_festivals` may contain AI/normalization guess fields (e.g. cleaned title/description, city/date/location/tags/coordinates guesses).

Current behavior in admin edit UI:
- AI values are shown as hints and comparison statuses
- admin can apply guessed values into editable core fields
- вЂњUse all safe valuesвЂќ only fills missing fields
- core moderated fields remain authoritative for save/approve

Admin festival research (`POST /admin/api/research-festival`, UI `/admin/research`) runs a **multi-step Gemini pipeline** (server-only):
1. **Search:** Gemini with **Google Search grounding** — multiple query variants (original query, `фестивал`, `събор`, year variants via `buildGeminiPipelineQueries`) collect grounded `groundingChunks` (title, URL; snippet mirrors title when the API does not return a separate snippet).
2. **Rank:** `lib/admin/research/search-hit-rank.ts` scores sources (Bulgarian domains, official/municipal/tourism/media/Facebook events, list-page penalties) and keeps **top 3–5** URLs.
3. **Extract:** For each ranked URL, the server fetches page text (`fetchSourceDocument`) and runs **Gemini structured JSON** extraction (`lib/admin/research/gemini-extract.ts`) — evidence-only, unknown → null.
4. **Validate:** `lib/admin/research/pipeline-validate.ts` enforces date sanity, title length, and clears inconsistent data with warnings.
5. **Output:** Normalized `ResearchFestivalResult` with `best_guess` (including `organizers[]` plus legacy `organizer`), optional structured **`program_draft`** when sources list a schedule, `sources`, `evidence`, `confidence`, `warnings` (no raw model text in the API response).

Research handoff (before enqueue): `lib/admin/ingest/researchPendingRowFromRequest.ts` normalizes location/city/address text, then resolves coordinates via `lib/location/resolveEventCoordinates.ts`: **normalized venue+city lookup** in `public.location_cache` (when a row exists), then **Google `place_id`** (when present and the API key is configured), then **venue + city**, then **venue/address line only** — **never** a city-only geocode (no city-center fallback). Callers may pass **`coords_override: true`** with **`latitude`/`longitude`** (e.g. on `best_guess` / final values) to **skip cache and geocoding** and keep those coordinates (`geocode_provider` `manual`). New **high-confidence** API results (score ≥ 60; never overwriting an existing key via the default upsert) are stored in `location_cache` for reuse. Admin **manual map pins** upsert the cache at **confidence 100** via `POST /admin/api/location-cache` (replaces the row for that normalized key). Results pass `lib/location/validateCoordinates.ts` (finite lat/lng; optional distance vs city center when callers supply reference coords). Uncertain resolution leaves `latitude`/`longitude`/`place_id`/`geocode_provider` null. Admin `POST /api/admin/geocode` uses the same resolver (optional `place_id`, and optional `coords_override` + `existing_lat` / `existing_lng` in the body). Published and pending admin editors expose a **Leaflet map picker** (`components/admin/MapPicker.tsx`) for pin placement; `coords_override` is **UI session state** unless callers persist flags in payloads as above.

**Post-AI row quality (research ingest only):** After the snapshot row is built, `lib/admin/research/festivalDataQuality.ts` runs **enrich → optional second geocode pass if city/venue appeared but coordinates were still null → validate → score**. Enrichment uses `fetchSourceDocument` on a small cap of source URLs, parses ISO / European dates, matches city substrings against **`public.cities.name_bg`**, and applies light venue/title heuristics so missing core fields can be filled from page text. **Validation** marks **`needs_review = true`** when **title**, **`start_date`** (ISO `yyyy-mm-dd`), or **city** (`city_guess` / `city_name_display`) is still missing. **`confidence_score`** (0–100) is a **structural completeness** score (weights: title, date, city, venue, source URL), not model self-confidence; it is stored on **`pending_festivals`** together with **`needs_review`** (`scripts/sql/20260504_pending_festivals_quality_score.sql`). Audit detail lives under **`evidence_json.post_ai_quality`**. In **festivo-workers**, research pending inserts list these columns as optional so older databases without the migration do not fail inserts.

**Configuration:** `GEMINI_API_KEY` (or `GOOGLE_AI_API_KEY`); optional `GEMINI_RESEARCH_MODEL` (overrides the **primary** model, default `gemini-3.5-flash`), `GEMINI_RESEARCH_TIMEOUT_MS`. On a 429/quota error the provider walks a 3-model fallback chain — `gemini-3.5-flash` → `gemini-3.1-flash-lite` (500 RPD free tier) → `gemini-2.5-flash` — across grounded search, JSON extraction, and vision rerank. `gemini-3.1-pro` is intentionally excluded (paid-only, no free tier); `gemini-2.0-*` were shut down 2026-06-01.

If Gemini is not configured, the route returns **503**. If extraction yields no usable fields, the API returns a **low-confidence** minimal result with sources + warnings (preferring null over speculative values).

`/api/admin/research-ai` (Perplexity-backed extraction) may return `organizer_names[]` (optional) in addition to `organizer_name`; the ingest handoff stores ordered `organizer_entries` on the pending snapshot. The pipeline uses a strict structured first pass plus additive follow-up passes:
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
- **RLS (`festivals`):** policies that scope anonymous/public reads should keep that same catalog surface. A separate `SELECT` policy (`festivals_select_preview_admin_organizers`, `scripts/sql/20260501_festivals_rls_preview_access.sql`) grants **authenticated** users **admin/super_admin** (`public.is_admin()`) or **active** `organizer_members` linked via `festivals.organizer_id` or `festival_organizers` access to additional rows for preview; unauthenticated clients still rely only on the public policies.
- Authenticated user UX keeps planning and account concerns separate: `/plan` is for saved festivals/schedule/reminders, while `/profile` is the account hub (identity, shortcuts, push toggles via `/api/notification-settings`, optional reminder-email toggle via `/api/email/preferences`, and security actions).
- **Festival date filtering:** when `occurrence_dates` (jsonb) holds discrete ISO days, listing/calendar/filter logic treats those days as the event schedule; otherwise overlap uses `start_date`/`end_date`. The database exposes `public.festivals_intersecting_range(from, to)` for window queries (see `scripts/sql/20260323_festival_occurrence_dates.sql`). Admin pending/published edit forms can maintain `occurrence_dates`; approve copies it into `festivals`.
- Pending moderation records are admin-only.
- **Monetization (organizer + event-level promotion):**
  - `organizers.plan` supports `free` / `vip`; VIP is active by plan window (`plan_started_at`, `plan_expires_at`).
  - Festival promotion is event-level via `festivals.promotion_status` (`normal` / `promoted`) and `promotion_rank`.
  - Public listing priority is: promoted first, then higher `promotion_rank`, then VIP organizers, then higher `organizer_rank`, then `start_date` asc.
  - Promotion credits are tracked yearly in `organizer_promotion_credits` (one row per organizer/year, lazy-created).
  - Credit consumption happens only on explicit transition `promotion_status: normal -> promoted` in admin update; edits on already promoted festivals do not consume another credit.
  - `promotion_expires_at` remains optional/nullable and is not required for promotion at this stage.
- Public festival detail uses `FestivalGallery` when processed media items exist (replaces older inline-only gallery wiring in `FestivalDetailClient`).
- **Public festival detail UX:** hero emphasizes a single primary action („Напомни ми“); calendar export is secondary in the same row. The rail groups „Добави в моя план“, navigation, and reminder timing without duplicating the hero CTA. Quick facts render as a compact strip when data exists. **`/profile` — напомняния:** една секция „Напомняния“ обединява `push_enabled` и **default време за ново запазени** (`POST /api/notification-settings`, поле `default_plan_reminder_type`), имейл напомняния (`POST /api/email/preferences`), обобщение за текущо запазените (`GET /api/plan/reminders`) и по избор **прилагане към вече запазените** (`POST /api/plan/reminders` с `applyToAllSaved`); unsubscribe линк от reminder имейли → `/unsubscribe/[token]`.
- **Public reminder persistence:** changing reminder timing on festival detail (`POST /api/plan/reminders`) updates `user_plan_reminders` and synchronizes pending `notification_jobs` reminders for the same user/festival (disable → cancel pending jobs; enable/change → reschedule). **Профил:** по подразбиране за *нови* запазвания — `user_notification_settings.default_plan_reminder_type` (`/api/notification-settings`, стойности включително `default`); при `POST /api/plan/festivals` с включени напомняния се записва `user_plan_reminders.reminder_type = default` и се вика `syncReminderJobsForPreference(…, "default")`. За всеки ненулев тип се насрочват **два** reminder job-а (~24 ч и ~2 ч преди старт), ако са в бъдеще (`lib/notifications/scheduler.ts` — `computeSavedFestivalReminderTimes`). Фестивалите могат да имат опционални `start_time`/`end_time` (Postgres `time`); планирането използва Europe/Sofia инстант от `start_date` + `start_time`, когато е зададено.
- **Accommodation near venue (extension point):** normalized offers are loaded server-side via `lib/accommodation/fetchAccommodationOffers.ts`, which aggregates registered providers (`lib/accommodation/providers/*`). The public UI renders the „Настаняване наблизо“ block only when at least one offer is returned. Register `bookingAccommodationProvider` with `BOOKING_ACCOMMODATION_ENABLED=1` when the integration is implemented (currently returns no offers). Optional local testing uses `ACCOMMODATION_MOCK_PROVIDER=1` (empty offers) and `ACCOMMODATION_MOCK_SAMPLE=1` (sample card, non-production). Future Booking.com or other APIs register as providers without changing the page shell.
- Admin published-festival actions:
  - archive (`status=archived`)
  - restore (`status=verified`)
  - delete (hard delete)

## Notification pipelines (current)
- **Legacy / inbox + FCM:** `/api/jobs/reminders` (планови напомняния от `user_plan_reminders` → `user_notifications` → `/api/jobs/push`; **без** reminder `email_jobs`), `/api/jobs/new-festival-notifications` (категория/организатор/град), `/api/jobs/push` (изпращане към `device_tokens` от `user_notifications`).
- **MVP job queue (2026-03):** `notification_jobs` + `notification_logs` — планиране, `dedupe_key`, time-window дедупликация по тип, rate limit от `notification_logs` (24 ч), приоритет high/normal, изпълнение през `GET /api/notifications/run` (batch ~75, сортиране по приоритет). High-frequency scheduling е external-first (Railway/worker/cron service) през `x-job-secret: JOBS_SECRET`; Vercel cron е optional само за low-frequency jobs на Hobby-safe честота. Уикенд откриване (`GET /api/notifications/weekend-trigger/fri_18` и `.../sat_09`) мачва фестивали по следвани градове (`user_followed_cities`) и може да ползва профилен `city_id` като fallback за „наблизо“. Добавени са queue-safe типове `followed_organizer` (одобрени фестивали от следван организатор) и weekly `trending` (sat_09) с лек score (saves/freshness/proximity/promoted/trending flags). Job endpoint-ите (`notifications/run`, `jobs/reminders`, `weekend-trigger/*`) използват `cron_locks` guard срещу parallel runs. Тригери: запис в план (`POST /api/plan/festivals`), админ редакция на фестивал (`PATCH /admin/api/festivals/[id]`), одобряване на pending (`POST .../approve`). Детайли: `docs/notification-system.md`.
- **Push audit + inbox (2026-05):** `push_delivery_audit` пази durable delivery/open telemetry за всеки push send attempt (вкл. token/status/provider response). Mobile inbox чете paginated от `GET /api/notifications/inbox`, а push open lifecycle updates минават през `POST /api/push/open` (cold/background/foreground contexts).
- **Transactional email queue (Phase 1–2, 2026-04):** `email_jobs` — queue-first запис в таблицата, изпращане през Resend от `GET /api/jobs/email` (същият jobs auth като останалите: `isAuthorizedJobRequest` — `x-job-secret: JOBS_SECRET` или TEMP `User-Agent` с `vercel-cron`), `cron_locks` (`email_jobs_run`), service-role клиент. On Vercel Hobby, trigger via external scheduler with `x-job-secret`; `SUPABASE_SERVICE_ROLE_KEY` and `RESEND_API_KEY` remain required. Атомарно взимане на batch с `claim_due_email_jobs` (Postgres `FOR UPDATE SKIP LOCKED`); статуси `pending` → `processing` → `sent` / `failed` с retry и partial unique index върху `dedupe_key`. При успешен send се записват `provider='resend'`, `provider_message_id` от Resend, `sent_at`/`updated_at`. Липсващ `RESEND_API_KEY` не оставя реда в `processing` — нормален retry/fail с `last_error=resend_not_configured`. Непознат `type` → контролиран fail с `unknown_job_type:…`. Невалиден payload при рендер → `render_failed:…` в `last_error`. Регистър: `lib/email/emailRegistry.ts` + `emailSchemas.ts` + шаблони в `emails/*`; типове: `test` + осем transactional ключа (организаторски заявки, подавания, админ алерти — виж `docs/notification-system.md`) + **`reminder-1-day-before`** / **`reminder-same-day`**, enqueue-вани от `lib/notifications/processDueJobs.ts` при due `notification_jobs` с `job_type=reminder` и същите `reminder_subkind` слотове като push (`24h` / `2h`), без втори scheduler; типът `reminder-same-day` в опашката отговаря на слот `2h` (~2 ч преди начало). Legacy `/api/jobs/reminders` не enqueue-ва тези имейли. Опционално `EMAIL_ADMIN` за админ алерти (липсата не чупи основните flow-ове). Опционално `EMAIL_REPLY_TO` за Reply-To в Resend. Dev: `GET /api/test-email?to=…&type=…&payload=…` (само извън production). SQL: `scripts/sql/20260403_email_jobs_queue.sql`.
- **Resend webhooks / delivery visibility (Phase 4, 2026-04):** `POST /api/email/webhook` — Svix верификация с `RESEND_WEBHOOK_SECRET` и **raw** тяло (както в [Resend docs](https://resend.com/docs/webhooks/verify-webhooks-requests)); запис в `email_events`; дедупликация по уникален `webhook_delivery_id` (= header `svix-id`, препоръка на Resend за at-least-once доставка). Мачване към `email_jobs` през `data.email_id` ↔ `column provider_message_id` при `status=sent`. Обобщение на реда в `email_jobs` (`delivery_status`, `delivered_at`, `bounced_at`, `last_event_type`, `last_event_at`) за бърз оперативен поглед; пълната история е в `email_events`. При нов успешен send същият job нулира обобщителните delivery полета. Endpoint-ът не изпраща имейли и не enqueue-ва работа. Код: `lib/email/webhook/verifyResendWebhook.ts`, `lib/email/normalizeEmailWebhookEvent.ts`, `lib/email/applyResendEmailEventToEmailJob.ts`. SQL: `scripts/sql/20260404_email_events_resend_webhooks.sql`. Подробности и тестване: `docs/notification-system.md`. **Админ:** оперативен преглед на опашката и събитията — `/admin/email-jobs` и `/admin/email-jobs/[id]` (service-role четене на сървъра, само за логнат админ).
- **Email preferences / unsubscribe (Phase 5):** таблица `user_email_preferences` (SQL `scripts/sql/20260405_user_email_preferences.sql`); RLS за собственика; service role за jobs и token-based unsubscribe. Категории `email_jobs.type` и `canSendEmailTypeToUser` в `lib/email/emailTypeCategory.ts` / `lib/email/emailPreferences.ts`. **Required/admin** имейли: fail-open при prefs lookup грешка. **Optional** (reminder email, бъдещи optional типове): fail-closed при prefs lookup грешка (`preference_lookup_failed` на процесора; без enqueue в reminder flow). Reminder имейли: gating при enqueue в `lib/notifications/processDueJobs.ts` (`loadEmailPreferencesMapForReminderUsers`, `fetchUserEmailPreferencesStrict`) + повторна проверка при send в `lib/email/processEmailJobs.ts`; push vs email каналите са разделени за `job_type=reminder` (виж `docs/notification-system.md`). Публично: `GET /unsubscribe/[token]`, `POST /api/email/unsubscribe`; логнат потребител: `GET/POST /api/email/preferences`. Имейл footer за reminder: `emails/components/EmailFooter.tsx` + `FestivalReminderEmail`.

## Analytics tracking (push follow-up)
- `POST /api/analytics/track` records `push_open`, `festival_view`, `festival_saved`, and `app_open` events into `analytics_events`.
- Event writes are anonymous-safe; when a user session exists, `user_id` is attached server-side.
- Clients should include `notification_id` from the FCM payload to correlate follow-up actions after a push.

## Outbound click tracking
- `GET /out` accepts `url` (http/https only), optional `festival_id` (UUID), `type` (destination label, e.g. `website`, `ticket`, `maps`, `booking`), and `source` (e.g. `festival_detail`). It records a row in `outbound_clicks` via the service role (same pattern as `analytics_events`), attaches `user_id` when a Supabase session exists, then responds with `302` to the validated target URL. Invalid or non-http(s) URLs return `400` (no redirect).
- Admins can review outbound traffic at `/admin/outbound`: default period is last 7 days (optional all time or 30 days), optional filter by destination type; the page shows count summaries (total + booking/maps/website/ticket), a top-festivals table (per-type breakdown, top 20, plus a simple booking “intent” column from booking share vs total clicks), and the latest 100 raw rows with festival titles (joined from `festivals`).
- Public festival detail can show a small “Популярен за пътуване” label near the accommodation blocks when `outbound_clicks` booking count for that festival in the last 30 days is at least 2 (server-side count via service role, same table).


## Admin organizers management

### Storage layer (organizer logos)

Organizer logos use a small type-safe storage layer located in:

`lib/storage/paths.ts`

Instead of constructing storage paths manually (e.g. `"logos/${hash}.webp"`), the system uses:

- `organizerLogo(hash)`

This returns a structured object:

- `bucket` – storage bucket name
- `path` – internal storage path
- `publicUrl` – fully qualified public URL

#### Why this exists

- Prevents string-based path bugs
- Centralizes storage structure in one place
- Makes refactoring safe (change in one file only)
- Ensures delete/upload logic stays consistent

#### Important constraints

- Never construct storage paths manually
- Never trust raw URL paths for deletion
- Always derive paths from hash using the helper (or rebuild via `organizerLogoFromValidatedStoragePath` after verifying the URL belongs to this bucket)

Screens and workflows:

- Admin has dedicated organizer management screens at `/admin/organizers`, `/admin/organizers/[id]`, and duplicate review at `/admin/organizers/duplicates`.
- Pending approval resolves organizers from `pending_festivals.organizer_entries` (ordered `{ organizer_id?, name }` rows; legacy `organizer_name` / `organizer_id` still supported) to `organizers.id` (exact normalized-name match when only a name is given), auto-creating organizer rows when needed, then writes **all** relation rows to `festival_organizers` in order.
- Duplicate candidates are conservative-only (exact normalized name, exact slug, exact `facebook_url` when present).
- Manual merge endpoint `/admin/api/organizers/merge` reassigns `festival_organizers.organizer_id` (plus compatibility fields `festivals.organizer_id` and `pending_festivals.organizer_id`), backfills missing target profile fields from source, then marks source organizer inactive (`is_active=false`, `merged_into=target_id`).
- Organizer list and public organizer profile lookups use active organizers by default (`is_active=true`).
- Approved festivals persist organizer links in `festival_organizers`, keep `festivals.organizer_id` as compatibility, and keep `organizer_name` as display fallback only.
- Organizer profile enrichment supports admin AI research via `/api/admin/research-organizer` (Perplexity structured extraction); UI is embedded in organizer edit form and applies extracted values only after moderator action.

## Admin audit logging
- Successful admin write actions are recorded to `admin_audit_logs` from route success paths (for example organizer/festival create-update-delete, pending approve/reject/edit, claim approvals, and selected admin state mutations).
- Logging is **best-effort** and **non-blocking**: failures are caught locally and never fail the main admin action.
- Stored fields are intentionally minimal: actor user id, action name, entity type/id, route/method, status, and small safe metadata in `details` (no secrets, tokens, cookies, or full sensitive payload snapshots).
- Admins can browse entries at `/admin/activity` (read-only table, cursor pagination via `page`, optional filters on action / entity type / actor / date range; service-role query after the standard admin layout gate).

## Organizer portal (MVP, user-facing)
- **Model:** `organizer_members` links `auth.users` to `organizers` with `role` (`owner`, `admin`, `editor`) and `status` (`pending`, `active`, `revoked`). Unique `(organizer_id, user_id)`. RLS: authenticated users may `select` their own rows or admins may read all (`is_admin()`); mutations use server routes with the service role after session checks.
- **Traceability:** `pending_festivals` adds `organizer_id`, `submitted_by_user_id`, `submission_source` (`organizer_portal` | `admin` | `ingest` | `research`). Organizer-submitted drafts use `submission_source=organizer_portal` and `source_type=organizer_portal` where applicable.
- **Public routes (BG UI):** `/organizer`, `/organizer/dashboard`, `/organizer/profile/new`, `/organizer/claim`, `/organizer/festivals/new`, `/organizer/festivals/preview/[id]` (owner-only persisted preview from `pending_festivals.status=draft`), `/organizer/submissions`, `/organizer/submissions/[id]/edit`. Navigation: site header/nav and profile shortcuts to `/organizer` (not mixed with admin chrome).
- **Access:** `/organizer` is the public entry; **active owners** (`organizer_members.status=active` and `role=owner`) are redirected server-side to `/organizer/dashboard`. Other signed-in users see onboarding CTAs (`/organizer/profile/new`, `/organizer/claim`) and status messages for pending/revoked membership. `/organizer/dashboard`, `/organizer/submissions`, `/organizer/festivals/new`, and `/organizer/submissions/[id]/edit` require an **active owner** server-side (`requireOrganizerOwnerPortalSession`); non-owners with active `admin`/`editor` membership are redirected to `/organizer`; unauthenticated users redirect to login (with `next`). Workspace sidebar shows owner tools (табло, подавания, нов фестивал) only for owners; otherwise only onboarding links. Onboarding routes `/organizer/profile/new` and `/organizer/claim` stay available to signed-in users without active membership. `GET /api/organizer/memberships` returns 403 without active membership.
- **API (session + service role after authorization):** `POST /api/organizer/organizers` (create profile + active owner), `POST /api/organizer/claims` (pending owner claim; **requires** `contact_email` + `contact_phone` for staff verification; persisted on `organizer_members`; blocked when an active owner already exists; same user with `revoked` membership is reset to `pending` owner claim with updated contact; active or pending row for same user returns 409), `GET /api/organizer/memberships`, `POST /api/organizer/pending-festivals` (optional body `status: draft` creates a persisted preview row **without** moderation emails), `PATCH /api/organizer/pending-festivals/[id]` (only `submission_source=organizer_portal` + active membership + `status` in `draft` or `pending`; body `status: pending` promotes a **draft** to the moderation queue and enqueues the same emails as a non-draft `POST`).
- **Approve:** when `pending.source_url` is absent, published `festivals.source_type` is derived from `pending.source_type` (e.g. organizer portal rows keep `organizer_portal` after mapping), after any ingest-job match on `source_url`.
- **Admin (organizer claims):** `/admin/organizer-claims` and `/admin/organizer-claims/[id]` list pending membership requests with **claim contact** fields (`contact_email`, `contact_phone`) loaded via **service role**; those columns are not granted to the `authenticated` role at Postgres (JWT clients cannot read them even for own rows). `POST /admin/api/organizer-members/[id]/approve` activates membership (conflicts if a second `owner` is approved while another active owner exists). `POST /admin/api/organizer-members/[id]/reject` sets the pending row to `revoked` (allows a later fresh claim flow).
- **Admin (pending festivals queue):** Pending queue list shows an „Орг. портал“ badge when `submission_source=organizer_portal`; detail form shows a banner with submitter user id.
- **Approve integration:** `POST /admin/api/pending-festivals/[id]/approve` builds the published festival’s organizer list from `organizer_entries` when present (each row: optional `organizer_id` or name-only via `resolveOrCreateOrganizerId`), otherwise legacy `organizer_id` / `organizer_name`; syncs **all** IDs to `festival_organizers`.
- **Migration:** `scripts/sql/20260328_organizer_members_portal.sql`; `public.festivals_source_type_check` includes `organizer_portal` so portal approvals can persist that value on `festivals.source_type` (`scripts/sql/20260330_festivals_source_type_organizer_portal.sql`). Claim verification contacts: `scripts/sql/20260401_organizer_members_contact.sql`. Organizer preview drafts: `pending_festivals.status` includes `draft` (`scripts/sql/20260428_pending_festivals_draft_status.sql`).
- **Festival ownership (2026-06):** `festival_organizers.role` (`owner` | `co_host`, default `co_host`) с partial unique index `festival_organizers_one_owner_idx` (`scripts/sql/20260601_festival_organizers_role_constraint.sql`). При approve на portal-submitted pending → submitting organizer (`pending_festivals.organizer_id`) се записва като `owner`; останалите organizer entries → `co_host`. Admin/ingest/research approves → всички `co_host` (orphan; admin продължава да управлява). Portal endpoints `GET /api/organizer/festivals/[id]`, `PATCH .../[id]` (owner-only, безопасен subset от полета: description, links, price/is_free), `POST/DELETE .../[id]/co-organizers` (owner-only, директно добавяне без accept flow; owner-ът не може да премахне себе си). Read-only view `/organizer/festivals/[id]` виждан от owner и co_host; edit `/organizer/festivals/[id]/edit` — owner-only (co_host redirect-ва към view). Permission gating: `lib/organizer/festivalAccess.ts#getUserFestivalRole`. `syncFestivalOrganizers` запазва role при sync.



## Telegram poster ingest bot

Operator sends a festival poster photo to a dedicated Telegram bot (`@FestivoPosterBot`) → inline Gemini vision extraction → Zod validation → geocode → dedup → insert as `pending_festivals` draft.

**Flow:**
```
Telegram photo message (whitelist-gated)
  → POST /api/telegram/poster-bot (Vercel, maxDuration=60, nodejs runtime)
      → poster_ingest_jobs upsert (dedupe_key = sha256(chatId::fileUniqueId)[0:32])
      → downloadTelegramFile → Buffer
      → posterBufferToInline (sharp, 1280px JPEG) → base64 inline image
      → uploadPosterImage → hero bucket (telegram-poster/ prefix)
      → geminiExtractJsonWithImages → posterExtractionSchema (Zod) → PosterExtraction
      → resolveMissingYear (weekday cross-check, explicit year preferred)
      → buildResearchPendingRowFromRequest (geocode + quality pipeline)
      → findDuplicateFestivals (score ≥ 0.5 + same_year → ask operator)
      ├── duplicate → poster_ingest_jobs status=awaiting_dup_confirm + inline keyboard
      │    └── "Все пак създай" callback → insertFromStoredExtraction
      └── no dup → pending_festivals INSERT → Telegram link to /admin/pending-festivals/[id]
```

**Key decisions:**
- `source_type = "research"` (passes existing constraint). Provenance in `extraction_version = "telegram_poster_vision_v1"` and `evidence_json.ingest_channel = "telegram_poster"`.
- `verification_status = "needs_review"` always — never auto-published.
- Contact phone/person stored in `evidence_json.contact` and appended to `description`; no new column.
- Whitelist: `social_repost_allowed_users` (shared with social-bot).
- Separate env: `TELEGRAM_POSTER_BOT_TOKEN`, `TELEGRAM_POSTER_WEBHOOK_SECRET`.

**Key files:** `lib/admin/poster/` · `lib/telegram/posterBot.mjs` · `app/api/telegram/poster-bot/route.ts` · `scripts/sql/20260617_poster_ingest_jobs.sql`
