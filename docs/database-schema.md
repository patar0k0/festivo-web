# Festivo Database Schema (code-synced notes)

This document is intentionally scoped to the schema surfaces actively used by current ingest/moderation/public flows in this repository.

## public.cities

Canonical city dictionary used for moderation resolution and public routing/filtering.

| column | type | usage intent in code |
|---|---|---|
| id | bigint | canonical city key used by `festivals.city_id` and `pending_festivals.city_id` |
| slug | text | canonical slug used in route/filter matching and denormalized festival city text |
| name_bg | text | display name used in admin and public UI |

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
| organizer_name | text | source organizer hint |
| source_url | text | source reference and dedupe key |
| source_type | text | ingest source type carried into publish mapping |
| website_url | text | optional website |
| ticket_url | text | optional ticketing URL |
| price_range | text | optional pricing label |
| is_free | boolean | free/paid flag |
| hero_image | text | moderated hero image URL (often worker-rehosted) |
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
| start_date | date | listing and calendar window logic |
| end_date | date | optional range end |
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
- archive/restore toggles `status` between `archived` and `verified`
- public queries include verified/published/is_verified rows but exclude archived

## Notes on authoritative vs advisory data
- Authoritative publish inputs are moderated core columns on `pending_festivals`.
- AI/normalization guess columns are advisory and only become authoritative if copied into core fields by admin actions.


## public.organizers

Organizer profiles referenced by `festivals.organizer_id`.

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

Behavior tied to this table:
- Pending approval resolves/creates organizers from `pending_festivals.organizer_name` and writes `festivals.organizer_id`.
- Admin list/detail pages support post-approval organizer enrichment workflows.
- Admin duplicate review uses conservative match keys (normalized name / slug / facebook_url) and requires manual merge execution.
- Manual merge sets source organizer inactive and linked via `merged_into`, while festival/pending organizer foreign keys are reassigned to canonical organizer id.
