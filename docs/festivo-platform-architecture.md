# Festivo Platform Architecture (Current State)

This document is the cross-repository source of truth for the **currently implemented** Festivo platform across:
- `festivo-web` (Next.js app + admin + API routes)
- `festivo-workers` (ingestion worker runtime)
- Supabase (Postgres + Auth + Storage)

It describes implemented behavior only. Any future ideas are isolated in the final section.

## 1) Platform overview

Festivo is a **moderation-first** festival publishing platform:
- ingestion inputs are queued in `ingest_jobs`
- workers transform source data into `pending_festivals`
- admins review/edit pending records in `festivo-web`
- approval creates public `festivals` rows
- public pages read from `festivals` (not from pending tables)

## 2) Repository responsibilities

## `festivo-web`
- Public festival browsing and details.
- Admin moderation UI for pending festivals.
- Admin ingest queue management (enqueue/retry/delete jobs).
- Admin approval/rejection routes that enforce publication safeguards.
- Reminder/discovery/push job endpoints (`/api/jobs/*`) for notifications.

## `festivo-workers`
- Poll/process `ingest_jobs` lifecycle (`pending` → `processing` → `done`/`failed`).
- Extract source event fields and normalize candidate festival data.
- Upsert moderation records in `pending_festivals`.
- Run hero image candidate extraction + rehost pipeline before persisting `hero_image`.

## Supabase
- **Postgres** as system-of-record for queue, moderation, publication, planning, notifications.
- **Auth** for authenticated/admin user identity.
- **Storage** for rehosted hero assets (default bucket `festival-hero-images`).

## 3) Core data flow

```text
ingest_jobs (status=pending)
  ↓
workers claim/process job (processing → done|failed)
  ↓
pending_festivals (status=pending)
  ↓
admin review/edit in festivo-web
  ├─ reject → pending_festivals.status=rejected
  └─ approve → insert festivals row + pending_festivals.status=approved
  ↓
public site reads festivals only
```

Detailed lifecycle:
1. Admin enqueues source URL into `ingest_jobs`.
2. Worker processes job and writes/updates a `pending_festivals` candidate.
3. Admin can save edits (pending table only), then approve or reject.
4. Approval inserts into `festivals` with publication fields (`status=verified`, `is_verified=true`) and marks pending as approved.
5. Rejection updates pending status/metadata only.

## 4) Moderation-first publishing model

### Authoritative records by stage
- **Queue authority:** `ingest_jobs` tracks ingestion execution state.
- **Moderation authority:** `pending_festivals` stores editable candidate data.
- **Public authority:** `festivals` is the only public content source.

### Approval safeguards currently enforced
On approve, server-side logic enforces:
- pending row must still be `status=pending`
- city must resolve to canonical `cities.id`
- `start_date` must exist
- conflict checks for `source_url` and slug uniqueness
- if pending status update fails after insert, inserted festival is rolled back (deleted)

### Admin outcomes
- **Save**: updates moderated pending fields only.
- **Approve**: publishes to `festivals`, marks pending approved.
- **Reject**: marks pending rejected.

Published festival management in admin supports archive/restore/delete for `festivals`.

## 5) AI advisory layer

AI/normalization values on `pending_festivals` are **advisory**:
- used as hints in moderation UI (`title_clean`, `description_clean`, `city_guess`, `tags_guess`, date/location/coordinate guesses, etc.)
- can be copied into core editable fields via explicit admin actions
- safe autofill only fills missing fields

What AI currently does:
- provides guess columns consumed by moderation UI when present

What AI does **not** do authoritatively:
- does not directly publish festivals
- does not bypass moderation decisions
- does not override core fields without explicit admin action

Authoritative publish payload always comes from moderated core pending fields at approval time.

## 6) Media and storage flow

Hero image handling in worker ingestion:
1. candidate priority: Facebook cover image → OG image → existing pending hero image fallback
2. if URL is detected as Facebook-hosted, worker validates download with timeout/redirect/size/content-type guards
3. validated image is uploaded to Supabase Storage (`festival-hero-images` by default)
4. resulting public storage URL is written to `pending_festivals.hero_image`

Fail-safe behavior (implemented default):
- fail-closed for Facebook-hosted sources (`allowOriginalOnFailure=false`)
- when validation/rehost fails, hero image is set to `null` rather than preserving untrusted original URL

## 7) City and location handling

- Worker/normalization can populate advisory `city_guess` and location guesses.
- Approval requires canonical city resolution to `cities.id`.
- If city cannot be resolved, approval is blocked until moderator sets a valid city.
- Moderation implications:
  - guesses can accelerate editing
  - unresolved city prevents publication
  - only canonical `city_id` is used for public publication integrity

## 8) Key data entities and status/state transitions

## `ingest_jobs`
- Lifecycle: `pending` → `processing` → `done` or `failed`.
- Retry behavior (admin): only `failed` jobs can be retried; retry resets status/timestamps/error.

## `pending_festivals`
- Moderation lifecycle: `pending` → `approved` or `rejected`.
- Records remain moderation artifacts even after approval/rejection.

## `festivals`
- Public lifecycle used now: verified/published records are visible; archived records are excluded from public views.
- Admin supports archive (`status=archived`), restore (`status=verified`), and hard delete.

## 9) Current operational safeguards

- Moderation gate: no direct public publish from ingestion.
- Server-side approval validation (city/date/conflict checks + rollback path).
- Public reads from `festivals` only.
- Hero image ingestion validation + storage rehosting guardrails.
- Notification jobs remain decoupled from moderation flow and run through dedicated `/api/jobs/*` pipelines.

## 10) Planned / not yet implemented (explicitly future)

- A dedicated cross-platform “mobile architecture” section is not represented in this repository set; current docs indicate Flutter integration for planning/notifications, but this document focuses on the web/workers/Supabase architecture actually evidenced here.
- If a separate mobile repository becomes part of the architecture source-of-truth set, it should be added as a first-class repository responsibility section in a future revision.
