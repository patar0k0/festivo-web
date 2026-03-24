# AI_SYSTEM_ARCHITECT

## Purpose
Non-negotiable architecture and scaling guardrails for Festivo. Follow this file plus the source-of-truth docs below.

## Context loading (required before any task)
Read in this order:
1. `AI_CONTEXT.md`
2. `AI_DEVELOPER_RULES.md`
3. `docs/database-schema.md`
4. `docs/system-architecture.md`
5. `docs/notification-system.md`
6. `docs/er-diagram.md`

If any item is missing or conflicts appear, stop and ask for clarification before implementation.

## Core architecture principles
1. **Supabase is the single source of truth** for persistent app state.
2. **Platform split is intentional:** Web = discovery; Mobile = planning + notifications.
3. **Background work must be idempotent** and use dedupe keys.
4. **Privileged actions are server-only:** never trust client input for authorization-sensitive operations.
5. **RLS-first for user-owned data:** policies are mandatory, not optional.

## Decision rules (must apply)
### 1) Schema changes
- Change schema only when required by a concrete product requirement.
- For every new lookup/filter/sort path, add supporting indexes.
- Validate RLS impact for every new/changed table, column, relation.
- Keep migrations forward-safe; do not ship breaking schema changes without transition steps.

### 2) API contracts
- Treat API contracts as stable interfaces; avoid breaking response shapes.
- If a breaking change is unavoidable, version it or provide compatibility window.
- Privileged/business-critical logic must run in server routes/functions only.

### 3) Background jobs
- Jobs must be idempotent and guarded by dedupe keys.
- Job triggers must require cron/secret auth.
- Avoid N+1 access patterns; prefetch or batch reads/writes.
- Batch inserts/updates with a maximum chunk size of **500**.

### 4) Caching
- Cache only derived/read-heavy data; never cache secrets.
- Define invalidation at design time (event, TTL, or both).
- Cache keys must be deterministic and scoped to tenant/user context where relevant.

### 5) SEO
- Every indexable page must use canonical URLs.
- Prevent duplicate content across festival/city variants.
- Ensure complete metadata (title/description/open graph where applicable) for festival and city pages.

### 6) Mobile sync
- Mobile planning + notification data must reconcile against Supabase source-of-truth records.
- Sync flows must be retry-safe and idempotent.
- Do not introduce mobile-only data authority that diverges from server truth.

### 7) Security
- Service role keys are server-side only.
- Never expose service role credentials to clients.
- Never log secrets, tokens, or raw credential material.
- Enforce least-privilege access and RLS for user-owned data paths.

## Performance rules (non-optional)
- Add indexes for all new lookup patterns.
- Eliminate N+1 queries, especially inside jobs.
- Batch inserts in chunks of **<= 500**.
- Use pagination for admin lists and other unbounded datasets.

## Documentation sync rule
If a change affects **schema, API, jobs, or architecture**, update related docs in the **same PR**. Code and docs must land together.

**Security and edge behavior** (middleware, rate limiting, Origin/Referer checks, session refresh at the edge): document in `docs/system-architecture.md` and list any new production env vars in `README.md` in the same change.

## Before you change anything (checklist)
- [ ] I read all required context files listed above.
- [ ] I identified which source-of-truth docs are impacted.
- [ ] I evaluated schema/API/job/security/SEO/mobile-sync impact.
- [ ] I confirmed RLS and server-only privilege boundaries.
- [ ] I identified indexes, pagination, batching, and N+1 risks.
- [ ] I prepared matching documentation updates for this PR.

## How to propose changes (required format)
Use this template in PR description or design note:

```md
## Proposed Change
- Summary:
- Why now:

## Impacted Source-of-Truth Docs
- `docs/...`
- `docs/...`

## Decision Rules Check
- Schema:
- API contract:
- Background jobs:
- Caching:
- SEO:
- Mobile sync:
- Security:

## Performance Review
- Indexes added/verified:
- N+1 risk assessment:
- Batch plan (<=500):
- Pagination plan:

## Rollout + Backward Compatibility
- Migration/transition plan:
- Failure/rollback plan:

## Documentation Sync
- Docs updated in this PR:
```
