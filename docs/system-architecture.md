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

## Edge middleware: API POST hardening (festivo-web)

`middleware.ts` runs on the Edge runtime on matched app routes.

### Rate limiting (Upstash)

- **Scope:** **`POST`**, **`PATCH`**, **`PUT`**, and **`DELETE`** to paths under **`/api/*`** or **`/admin/api/*`**. **`GET`** (and other methods) are not rate-limited at the edge.
- **Implementation:** `lib/rateLimit.ts` uses `@upstash/ratelimit` with `@upstash/redis/cloudflare` (Edge-compatible). Redis keys are **per bucket** and **per identity**: if the request has a logged-in session (`getSession()` in `lib/middlewareSession.ts`, read-only-no cookie write), the key uses **`auth.users` id**; otherwise **client IP** (from `x-forwarded-for` / `x-real-ip`).
- **Activation:** requires both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. If either is missing, limits are skipped (no error).
- **Fail-open:** `checkRateLimit` does not block the site if Upstash throws (network, auth, etc.); the site must not return `500` because of rate limiting.
- **Jobs bypass** (applies to `/api/jobs/*` and `/api/notifications/*`): Vercel Cron header `x-vercel-cron`, or `x-job-secret` matching `JOBS_SECRET`. Same bypass is used for the origin check below.

**Buckets (fixed windows):** path prefixes are evaluated against `request.nextUrl.pathname` (same for `/api/*` and `/admin/api/*` where the suffix matches).

| Prefix / path | Limit |
|---------------|-------|
| `/api/auth/*`, `/api/admin/auth/*` | 5 / 60s |
| `/api/admin/research-ai` | 10 / 60s |
| `/api/jobs/*`, `/api/notifications/*` | 10 / 60s (unless bypassed) |
| `/api/plan/*`, `/api/follow/*`, `POST /api/device-token`, `POST /api/push/register`, `POST /api/notification-settings` | 30 / 60s |
| other write requests under `/api/*` or `/admin/api/*` | 20 / 10s |

Limited responses: **429** with `Retry-After` (seconds).

### Origin / Referer guard (CSRF-ish) for `POST /api/*`

For **`POST` requests** whose path starts with **`/api/`** only (not other methods, not `/admin/api/*`), the following applies.

- **Implementation:** `lib/postOriginGuard.ts` - `verifyApiPostOrigin(request)`.
- **Behavior:** if `Origin` or `Referer` is present, the URL's **host** must be in an allowlist built from `NEXT_PUBLIC_SITE_URL`, `VERCEL_URL`, optional comma-separated `CSRF_ALLOWED_HOSTS`, dev localhost hosts, and mutual inclusion of `festivo.bg` / `www.festivo.bg`.
- **No `Origin` and no `Referer`:** allowed (e.g. `curl`, some server clients).
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

`middleware.ts` forwards `request.nextUrl.pathname` on `NextResponse.next()` as request header `x-festivo-pathname` (overwrites any client-supplied value). The root shell uses it server-side with `FESTIVO_PUBLIC_MODE` and the `festivo_preview` cookie so **coming-soon** and **`/coming-soon`** render without the public header/footer (no catalog navigation on those surfaces).

Auth UX includes signup/login and password recovery: `/signup` creates email+password users via `POST /api/auth/signup` (Supabase `signUp` on the server; Cloudflare Turnstile when keys are set), `/login` sends Supabase reset emails, and `/reset-password` applies `auth.updateUser({ password })` for valid recovery sessions.

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
   - Extra gallery images + optional video (YouTube/Facebook page URL): pending uses `POST/DELETE /admin/api/pending-festivals/[id]/gallery-image` and `PUT /admin/api/pending-festivals/[id]/video` (also persisted via `PATCH` save on `gallery_image_urls` / `video_url`); published festivals use `GET/POST /admin/api/festivals/[id]/media`, `DELETE /admin/api/festivals/[id]/media/[mediaId]`, `PUT /admin/api/festivals/[id]/media/video`. Approve copies pending gallery + video into `festival_media`. Admin deletes of gallery rows or pending gallery URLs remove the corresponding object from the **`festival-hero-images`** bucket (env `SUPABASE_HERO_IMAGES_BUCKET`) when the stored URL is this project’s public Storage URL (`/storage/v1/object/public/<bucket>/…`); external URLs and published `festival_media` video rows are not deleted from Storage.

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

Admin festival research (`POST /admin/api/research-festival`, UI `/admin/research`) runs a **multi-step Gemini pipeline** (server-only):
1. **Search:** Gemini with **Google Search grounding** — multiple query variants (original query, `фестивал`, `събор`, year variants via `buildGeminiPipelineQueries`) collect grounded `groundingChunks` (title, URL; snippet mirrors title when the API does not return a separate snippet).
2. **Rank:** `lib/admin/research/search-hit-rank.ts` scores sources (Bulgarian domains, official/municipal/tourism/media/Facebook events, list-page penalties) and keeps **top 3–5** URLs.
3. **Extract:** For each ranked URL, the server fetches page text (`fetchSourceDocument`) and runs **Gemini structured JSON** extraction (`lib/admin/research/gemini-extract.ts`) — evidence-only, unknown → null.
4. **Validate:** `lib/admin/research/pipeline-validate.ts` enforces date sanity, title length, and clears inconsistent data with warnings.
5. **Output:** Normalized `ResearchFestivalResult` with `best_guess` (including `organizers[]` plus legacy `organizer`), `sources`, `evidence`, `confidence`, `warnings` (no raw model text in the API response).

**Configuration:** `GEMINI_API_KEY` (or `GOOGLE_AI_API_KEY`); optional `GEMINI_RESEARCH_MODEL` (default `gemini-2.0-flash`), `GEMINI_RESEARCH_TIMEOUT_MS`.

If Gemini is not configured, the route returns **503**. If extraction yields no usable fields, the API returns a **low-confidence** minimal result with sources + warnings (preferring null over speculative values).

`/api/admin/research-ai` (Perplexity-backed extraction) may return `organizer_names[]` (optional) in addition to `organizer_name`; create-pending stores ordered `organizer_entries` on the draft. The pipeline uses a strict structured first pass plus additive follow-up passes:
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
- Authenticated user UX keeps planning and account concerns separate: `/plan` is for saved festivals/schedule/reminders, while `/profile` is the account hub (identity, shortcuts, direct notification toggles via `/api/notification-settings`, and security actions).
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
- **Public festival detail UX:** hero emphasizes a single primary action („Напомни ми“); calendar export is secondary in the same row. The rail groups „Добави в моя план“, navigation, and reminder timing without duplicating the hero CTA. Quick facts render as a compact strip when data exists.
- **Public reminder persistence:** changing reminder timing on festival detail (`POST /api/plan/reminders`) updates `user_plan_reminders` and synchronizes pending `notification_jobs` reminders for the same user/festival (disable → cancel pending jobs; enable/change → reschedule pending jobs). Фестивалите могат да имат опционални `start_time`/`end_time` (Postgres `time`); планирането на напомнянията и legacy `/api/jobs/reminders` използват Europe/Sofia инстант от `start_date` + `start_time`, когато е зададено.
- **Accommodation near venue (extension point):** normalized offers are loaded server-side via `lib/accommodation/fetchAccommodationOffers.ts`, which aggregates registered providers (`lib/accommodation/providers/*`). The public UI renders the „Настаняване наблизо“ block only when at least one offer is returned. Register `bookingAccommodationProvider` with `BOOKING_ACCOMMODATION_ENABLED=1` when the integration is implemented (currently returns no offers). Optional local testing uses `ACCOMMODATION_MOCK_PROVIDER=1` (empty offers) and `ACCOMMODATION_MOCK_SAMPLE=1` (sample card, non-production). Future Booking.com or other APIs register as providers without changing the page shell.
- Admin published-festival actions:
  - archive (`status=archived`)
  - restore (`status=verified`)
  - delete (hard delete)

## Notification pipelines (current)
- **Legacy / inbox + FCM:** `/api/jobs/reminders` (планови напомняния от `user_plan_reminders`), `/api/jobs/new-festival-notifications` (категория/организатор/град), `/api/jobs/push` (изпращане към `device_tokens` от `user_notifications`).
- **MVP job queue (2026-03):** `notification_jobs` + `notification_logs` — планиране, `dedupe_key`, time-window дедупликация по тип, rate limit от `notification_logs` (24 ч), приоритет high/normal, изпълнение през `GET /api/notifications/run` (batch ~75, сортиране по приоритет). High-frequency scheduling е external-first (Railway/worker/cron service) през `x-job-secret: JOBS_SECRET`; Vercel cron е optional само за low-frequency jobs на Hobby-safe честота. Уикенд откриване (`GET /api/notifications/weekend-trigger/fri_18` и `.../sat_09`) мачва фестивали само по следвани градове (`user_followed_cities`), не по отделно поле за област. И трите job endpoint-а (`notifications/run`, `jobs/reminders`, `weekend-trigger/*`) използват `cron_locks` guard срещу parallel runs. Тригери: запис в план (`POST /api/plan/festivals`), админ редакция на фестивал (`PATCH /admin/api/festivals/[id]`), одобряване на pending (`POST .../approve`). Детайли: `docs/notification-system.md`.
- **Transactional email queue (Phase 1–2, 2026-04):** `email_jobs` — queue-first запис в таблицата, изпращане през Resend от `GET /api/jobs/email` (същият jobs auth като останалите: `x-vercel-cron` или `x-job-secret: JOBS_SECRET`), `cron_locks` (`email_jobs_run`), service-role клиент. Атомарно взимане на batch с `claim_due_email_jobs` (Postgres `FOR UPDATE SKIP LOCKED`); статуси `pending` → `processing` → `sent` / `failed` с retry и partial unique index върху `dedupe_key`. При успешен send се записват `provider='resend'`, `provider_message_id` от Resend, `sent_at`/`updated_at`. Липсващ `RESEND_API_KEY` не оставя реда в `processing` — нормален retry/fail с `last_error=resend_not_configured`. Непознат `type` → контролиран fail с `unknown_job_type:…`. Невалиден payload при рендер → `render_failed:…` в `last_error`. Регистър: `lib/email/emailRegistry.ts` + `emailSchemas.ts` + шаблони в `emails/*`; типове: `test` + осем transactional ключа (организаторски заявки, подавания, админ алерти — виж `docs/notification-system.md`). Опционално `EMAIL_ADMIN` за админ алерти (липсата не чупи основните flow-ове). Опционално `EMAIL_REPLY_TO` за Reply-To в Resend. Dev: `GET /api/test-email?to=…&type=…&payload=…` (само извън production). SQL: `scripts/sql/20260403_email_jobs_queue.sql`.

## Analytics tracking (push follow-up)
- `POST /api/analytics/track` records `push_open`, `festival_view`, `festival_saved`, and `app_open` events into `analytics_events`.
- Event writes are anonymous-safe; when a user session exists, `user_id` is attached server-side.
- Clients should include `notification_id` from the FCM payload to correlate follow-up actions after a push.

## Outbound click tracking
- `GET /out` accepts `url` (http/https only), optional `festival_id` (UUID), `type` (destination label, e.g. `website`, `ticket`, `maps`, `booking`), and `source` (e.g. `festival_detail`). It records a row in `outbound_clicks` via the service role (same pattern as `analytics_events`), attaches `user_id` when a Supabase session exists, then responds with `302` to the validated target URL. Invalid or non-http(s) URLs return `400` (no redirect).
- Admins can review outbound traffic at `/admin/outbound`: default period is last 7 days (optional all time or 30 days), optional filter by destination type; the page shows count summaries (total + booking/maps/website/ticket), a top-festivals table (per-type breakdown, top 20, plus a simple booking “intent” column from booking share vs total clicks), and the latest 100 raw rows with festival titles (joined from `festivals`).
- Public festival detail can show a small “Популярен за пътуване” label near the accommodation blocks when `outbound_clicks` booking count for that festival in the last 30 days is at least 2 (server-side count via service role, same table).


## Admin organizers management
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
- **Public routes (BG UI):** `/organizer`, `/organizer/dashboard`, `/organizer/profile/new`, `/organizer/claim`, `/organizer/festivals/new`, `/organizer/submissions`, `/organizer/submissions/[id]/edit`. Navigation: site header/nav and profile shortcuts to `/organizer` (not mixed with admin chrome).
- **Access:** `/organizer` is the public entry; it shows CTAs by auth and membership (dashboard link only when the user has at least one **active** `organizer_members` row with role `owner`/`admin`/`editor`). `/organizer/dashboard`, `/organizer/submissions`, `/organizer/festivals/new`, and `/organizer/submissions/[id]/edit` require the same active membership server-side (`requireActiveOrganizerPortalSession`); otherwise redirect to login (with `next`) or to `/organizer`. Onboarding routes `/organizer/profile/new` and `/organizer/claim` stay available to signed-in users without active membership. `GET /api/organizer/memberships` returns 403 without active membership.
- **API (session + service role after authorization):** `POST /api/organizer/organizers` (create profile + active owner), `POST /api/organizer/claims` (pending owner claim; **requires** `contact_email` + `contact_phone` for staff verification; persisted on `organizer_members`; blocked when an active owner already exists; same user with `revoked` membership is reset to `pending` owner claim with updated contact; active or pending row for same user returns 409), `GET /api/organizer/memberships`, `POST /api/organizer/pending-festivals`, `PATCH /api/organizer/pending-festivals/[id]` (only `submission_source=organizer_portal` + active membership + `status=pending`).
- **Approve:** when `pending.source_url` is absent, published `festivals.source_type` is derived from `pending.source_type` (e.g. organizer portal rows keep `organizer_portal` after mapping), after any ingest-job match on `source_url`.
- **Admin (organizer claims):** `/admin/organizer-claims` and `/admin/organizer-claims/[id]` list pending membership requests with **claim contact** fields (`contact_email`, `contact_phone`) loaded via **service role**; those columns are not granted to the `authenticated` role at Postgres (JWT clients cannot read them even for own rows). `POST /admin/api/organizer-members/[id]/approve` activates membership (conflicts if a second `owner` is approved while another active owner exists). `POST /admin/api/organizer-members/[id]/reject` sets the pending row to `revoked` (allows a later fresh claim flow).
- **Admin (pending festivals queue):** Pending queue list shows an „Орг. портал“ badge when `submission_source=organizer_portal`; detail form shows a banner with submitter user id.
- **Approve integration:** `POST /admin/api/pending-festivals/[id]/approve` builds the published festival’s organizer list from `organizer_entries` when present (each row: optional `organizer_id` or name-only via `resolveOrCreateOrganizerId`), otherwise legacy `organizer_id` / `organizer_name`; syncs **all** IDs to `festival_organizers`.
- **Migration:** `scripts/sql/20260328_organizer_members_portal.sql`; `public.festivals_source_type_check` includes `organizer_portal` so portal approvals can persist that value on `festivals.source_type` (`scripts/sql/20260330_festivals_source_type_organizer_portal.sql`). Claim verification contacts: `scripts/sql/20260401_organizer_members_contact.sql`.

