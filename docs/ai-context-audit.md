# AI Context Audit

_Date:_ 2026-03-05

## Scope
This audit validates that AI-facing context files and source-of-truth docs are internally consistent and aligned with the current codebase.

Reviewed inputs:
- `PROMPT_HEADER.txt`
- `PROJECT_CONTEXT.md`
- `AI_CONTEXT.md`
- `AI_DEVELOPER_RULES.md`
- `AI_SYSTEM_ARCHITECT.md`
- `docs/system-architecture.md`
- `docs/notification-system.md`
- `docs/er-diagram.md`
- route/table usage in `app/**` and `lib/**`

## Audit checks

### 1) Required context loading order
- Verified `PROMPT_HEADER.txt` requires loading:
  1. `PROJECT_CONTEXT.md`
  2. `AI_CONTEXT.md`
  3. `AI_DEVELOPER_RULES.md`
  4. `AI_SYSTEM_ARCHITECT.md`
  5. Source-of-truth docs under `docs/`
- `AI_CONTEXT.md` was updated to match this required order and include `PROJECT_CONTEXT.md` + `AI_SYSTEM_ARCHITECT.md` explicitly.

### 2) Architecture and module coverage
- Confirmed documentation covers implemented modules present in code:
  - festival discovery pages and filters
  - planning (`user_plan_*`)
  - notifications (`/api/jobs/reminders`, `/api/jobs/new-festival-notifications`, `/api/jobs/push`)
  - admin moderation (`/admin/pending-festivals`) and ingestion queue (`/admin/ingest`)

### 3) Data model consistency
- Found and corrected ER diagram mismatch:
  - `cities` is represented in runtime code using `id` and `slug`; canonical reference paths use `cities.id`.
  - `docs/er-diagram.md` now models `cities.id` as PK and keeps `slug` as unique.
- Added explicit `pending_festivals` entity to ER diagram and linked `cities -> pending_festivals` for moderation flow clarity.

### 4) Notification pipeline consistency
- Verified docs align on two pipelines:
  - reminder pipeline
  - discovery/new festival pipeline
- Verified dedupe model `(user_id, festival_id, type)` is consistently described.

### 5) Security and platform boundaries
- Confirmed docs consistently state:
  - Supabase + RLS as authority
  - service-role credentials server-only
  - web/mobile split remains intentional (web discovery, mobile planning/notifications)

## Result
- AI context loading instructions are now synchronized with `PROMPT_HEADER.txt`.
- ER model is now aligned with runtime usage for `cities` and moderation entities.
- No schema migration was required for this audit (documentation-only updates).

## Schema documentation note (2026-03)
- Agents and prompts no longer require `docs/database-schema.md`; Supabase and in-repo SQL/types are authoritative.

## Suggested ongoing maintenance
- Keep this audit lightweight and refresh whenever:
  - new core tables are introduced
  - API contract paths change materially
  - background jobs or notification dedupe rules change
