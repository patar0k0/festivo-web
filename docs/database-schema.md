# Festivo Database Schema (code-synced notes)

This document is intentionally scoped to the schema surfaces actively used by current ingest/moderation/public flows in this repository.

## public.cities

Canonical city dictionary used for moderation resolution and public routing/filtering.

| column | type | usage intent in code |
|---|---|---|
| id | bigint | canonical city key used by `festivals.city_id` and `pending_festivals.city_id` |
| slug | text | canonical slug used in route/filter matching and denormalized festival city text |
| name_bg | text | display name used in admin and public UI |
| is_village | boolean | when true, public UI prefixes settlement with „с.“ (village); default false for cities (`scripts/sql/20260321_cities_is_village.sql`) |

Used by:
- city resolution helpers (`id` / `slug` / `name_bg` lookup)
- pending/festival admin edit city assignment
- public city lists and joins

## public.ingest_jobs

Admin-managed ingestion queue.

| column | type | usage intent in code |
|---|---|---|
| id | uuid | queue job id |
| source_url | text | normalized source URL (currently Facebook event URL input) |
| source_type | text | source discriminator (`facebook_event` currently inserted by admin queue route) |
| status | text | job lifecycle: `pending`, `processing`, `done`, `failed` |
| error | text | worker/admin-visible error message |
| created_at | timestamptz | queue ordering and admin display |
| started_at | timestamptz | worker start timestamp |
| finished_at | timestamptz | worker completion timestamp |
| fb_browser_context | text | set by festivo-workers: how the job ran the browser (e.g. authenticated FB storage state vs anonymous); surfaced on admin ingest/pending views (`scripts/sql/20260322_add_ingest_jobs_fb_browser_context.sql`) |

Observed constraints/indexes from migrations:
- unique index on `source_url`
- status check constraint for allowed lifecycle values
- index on `(status, created_at desc)`

Operational behavior in web app:
- create job from admin ingest page
- retry allowed only for `failed` jobs (resets status/timestamps/error)
- delete job from admin panel
- ingest page links jobs to pending/published records via source-url matching logic

## public.pending_festivals

Moderation table for ingested candidates before publication.

| column | type | usage intent in code |
|---|---|---|
| id | uuid | moderation record id |
| title | text | candidate title; editable and publish source |
| slug | text | optional preferred slug seed for publish |
| description | text | editable/publishable description |
| city_id | bigint | canonical city reference for moderation/publish |
| category | text | moderated category used by approve/canonical mapping |
| region | text | moderated region used by approve/canonical mapping |
| location_name | text | venue/location label |
| address | text | venue address |
| latitude | numeric | moderation coordinates |
| longitude | numeric | moderation coordinates |
| start_date | date | required for approve/publish |
| end_date | date | optional end date |
| occurrence_dates | jsonb | optional sorted unique ISO date strings `["2025-06-11","2025-06-18"]` for non-consecutive days; null/empty → use `start_date`/`end_date` range only (see `public.festivals_intersecting_range`) |
| organizer_name | text | source organizer hint |
| source_url | text | source reference and dedupe key |
| source_type | text | ingest source type carried into publish mapping |
| website_url | text | optional website |
| ticket_url | text | optional ticketing URL |
| price_range | text | optional pricing label |
| is_free | boolean | free/paid flag |
| hero_image | text | moderated hero image URL (often worker-rehosted) |
| hero_image_source | text | ingest trace: which candidate supplied the hero (worker) |
| hero_image_original_url | text | original URL before rehost (worker/admin import) |
| hero_image_score | numeric | optional ingest ranking/score for chosen hero |
| hero_image_fallback_reason | text | when rehost fails, machine-readable reason (e.g. HTML body, 403); see migration `scripts/sql/20260322_add_pending_festivals_hero_ingest_columns.sql` |
| tags | text[] | moderation tags passed into publish |
| status | text | moderation state: `pending`, `approved`, `rejected` |
| created_at | timestamptz | moderation queue ordering |
| reviewed_at | timestamptz | decision timestamp |
| reviewed_by | uuid | admin reviewer id |

AI/normalization-related columns are also consumed when present (selected via `*` in admin detail page), including fields such as:
- `title_clean`, `description_clean`, `description_short`
- `category_guess`, `tags_guess`
- `city_guess`, `location_guess`, `date_guess`, `is_free_guess`
- coordinate guess variants (`latitude_guess` / `longitude_guess` / `lat_guess` / `lng_guess` and similar)
- normalization trace/decision metadata payloads (`normalization_version`, `deterministic_guess_json`, `ai_guess_json`, `merge_decisions_json`)

Important behavior:
- save route updates pending fields only
- approve reads moderated core fields and writes a new festival
- reject only updates moderation status/metadata

Observed constraints/indexes from migrations:
- status check constraint (`pending`, `approved`, `rejected`)
- index on `status`
- unique partial index on `source_url` where non-null

## public.festivals

Published festival catalog used by public discovery/detail pages and admin published management.

| column | type | usage intent in code |
|---|---|---|
| id | uuid | primary identifier |
| title | text | public/admin display |
| slug | text | public detail route key |
| description | text | detail content |
| city_id | bigint | canonical city FK reference |
| city | text | denormalized city slug/text used in filters and fallback display |
| region | text | region filter/display field |
| address | text | venue address |
| start_date | date | listing and calendar window logic; with discrete days, typically min day (merged in app) |
| end_date | date | optional range end; with discrete days, typically max day (merged in app) |
| occurrence_dates | jsonb | optional non-consecutive calendar days (ISO date strings in a JSON array); null/empty → continuous range via `start_date`/`end_date` only |
| category | text | category filter |
| image_url | text | persisted hero image on approve path |
| hero_image | text | also read by public UI/image resolver if present |
| website_url | text | detail link |
| ticket_url | text | detail link |
| price_range | text | detail metadata |
| is_free | boolean | free filter |
| lat | numeric | map/location |
| lng | numeric | map/location |
| source_url | text | dedupe + ingest linkage |
| source_type | text | mapped ingest source type (e.g. `facebook`) |
| tags | text[] | tags used in UI/filtering contexts |
| status | text | moderation/public visibility state (`verified`, `published`, `archived`, etc.) |
| is_verified | boolean | legacy visibility flag still used in public scope predicate |
| updated_at | timestamptz | admin updates ordering |

Behavior tied to these columns:
- approve inserts new rows with `status=verified`, `is_verified=true`, `source_type` mapped from ingest source
- public date filtering and calendar placement use `occurrence_dates` when present; otherwise legacy overlap on `start_date`/`end_date` (PostgREST RPC `public.festivals_intersecting_range(p_from, p_to)` — see `scripts/sql/20260323_festival_occurrence_dates.sql`)
- archive/restore toggles `status` between `archived` and `verified`
- public queries include verified/published/is_verified rows but exclude archived

## public.festivals_intersecting_range

SQL function (not a table): `festivals_intersecting_range(p_from date, p_to date) → setof (festival_id uuid)`.

- Returns published/verified (non-archived) festivals that overlap the inclusive window.
- Overlap is either any discrete day in `occurrence_dates` within the window, or classic range overlap when `occurrence_dates` is null/empty.
- Granted to `anon` and `authenticated` for use from the web app Supabase client.

Migration: `scripts/sql/20260323_festival_occurrence_dates.sql`.

## Notes on authoritative vs advisory data
- Authoritative publish inputs are moderated core columns on `pending_festivals`.
- AI/normalization guess columns are advisory and only become authoritative if copied into core fields by admin actions.


## public.festival_organizers

Many-to-many organizer links for published festivals. `festivals.organizer_id` remains a compatibility field during migration.

| column | type | usage intent in code |
|---|---|---|
| festival_id | uuid | FK to `festivals.id` |
| organizer_id | uuid | FK to `organizers.id` |
| role | text | optional role (reserved for future use) |
| sort_order | integer | ordering of organizers per festival |
| created_at | timestamptz | link creation timestamp |

Constraints/indexes:
- foreign key `festival_id -> festivals.id` (`on delete cascade`)
- foreign key `organizer_id -> organizers.id` (`on delete cascade`)
- unique `(festival_id, organizer_id)`
- index on `festival_id`
- index on `organizer_id`
- index on `(festival_id, sort_order)`

RLS policy model:
- `select`: public read policy (`using (true)`) to support public festival/organizer joins.
- `insert` / `update` / `delete`: restricted to authenticated admins via `public.is_admin()`.

Backfill behavior:
- Existing `festivals.organizer_id` rows are inserted into `festival_organizers` during migration.

## public.organizers

Organizer profiles referenced by `festival_organizers.organizer_id` (and compatibility field `festivals.organizer_id`).

| column | type | usage intent in code |
|---|---|---|
| id | uuid | primary identifier |
| name | text | organizer display name |
| slug | text | organizer profile slug |
| description | text | optional rich profile content |
| logo_url | text | optional organizer logo |
| website_url | text | official site |
| facebook_url | text | social link |
| instagram_url | text | social link |
| email | text | contact field editable in admin |
| phone | text | contact field editable in admin |
| verified | boolean | organizer trust marker |
| city_id | bigint | optional city relation |
| claimed_events_count | integer | admin visibility metric |
| is_active | boolean | active profile flag; default scope for admin/public organizer queries |
| merged_into | uuid | self-reference to canonical organizer after manual merge |
| created_at | timestamptz | record timestamp |

RLS (recommended): allow `select` for `anon` and `authenticated` where `is_active = true` (see `scripts/sql/20260321_organizers_public_select_active.sql`). Without this, public festival detail cannot resolve organizer names from `festival_organizers` when using only the anon API key.

Behavior tied to this table:
- Pending approval resolves/creates organizers from `pending_festivals.organizer_name`, inserts organizer links in `festival_organizers`, and keeps `festivals.organizer_id` synchronized as compatibility.
- Admin list/detail pages support post-approval organizer enrichment workflows.
- Admin duplicate review uses conservative match keys (normalized name / slug / facebook_url) and requires manual merge execution.
- Manual merge sets source organizer inactive and linked via `merged_into`, while festival/pending organizer foreign keys are reassigned to canonical organizer id.
