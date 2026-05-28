# Festivo — Claude Development Guide

## Launch Sprint (активен)

Festivo.bg е в активен 14-дневен launch sprint. Преди ВСЯКА задача:

1. Прочети `LAUNCH_CHECKLIST.md` в root-а
2. Провери дали задачата е част от sprint-а
3. Ако е — маркирай я като `[~]` преди да започнеш
4. След като приключиш — маркирай я като `[x]` и добави бележка
5. Обнови `Sprint ден` и `Последно обновяване` в горната секция

Следвай инструкциите в секцията „🤖 Инструкции за Claude Code" в самия файл.

---

## Language

Always respond in **Bulgarian**. This applies to all messages, explanations, code comments, and commit messages. Only exception: code identifiers, API names, and technical strings stay in English as they appear in the codebase.

---

## Keeping this file current

Update `CLAUDE.md` in the same PR/commit whenever a change introduces or modifies:

- **New architectural patterns** — a new way of doing auth, data access, job scheduling, storage, etc.
- **New core modules or libraries** — add an entry to the *Key modules & locations* table
- **New job types or notification pipelines** — update the *Notification system overview* section
- **New required environment variables** — add a row to the *Environment variables* table
- **New conventions** — e.g. a new file naming rule, a new RLS pattern, a new API response shape used project-wide
- **Significant new features** — e.g. a new portal, a new public-facing surface, a new admin workflow
- **Anything that would cause a future agent to make a wrong assumption** if this file were the only thing it read

Do **not** update this file for:
- UI-only or styling changes
- Small bug fixes with no architectural impact
- Changes already fully described by an existing doc pointer (just update that doc instead)

When in doubt: if it changes how future code should be written in this project, it belongs here.

---

## Git workflow

Use feature branches for all work. Merge to `main` via PR — create the PR immediately after pushing and merge it straight away (no waiting for review).

After every completed task: **commit, push, open PR, merge**. Never leave finished work uncommitted.

### Branch naming

```
<type>/<short-description>
```

Examples: `feat/trending-notifications`, `fix/city-resolution-approve`, `docs/update-claude-md`

### Commit message format (Conventional Commits)

```
<type>(<scope>): <short description>
```

| Type | When to use |
|---|---|
| `feat` | New feature or behaviour |
| `fix` | Bug fix |
| `refactor` | Code change with no behaviour change |
| `docs` | Documentation only (CLAUDE.md, docs/, README) |
| `chore` | Config, migrations, tooling, dependency updates |
| `style` | Formatting, whitespace, no logic change |

**Scope** is optional but useful for large codebases — use the affected area: `admin`, `notifications`, `email`, `mobile`, `organizer`, `auth`, `db`, etc.

Examples:
```
feat(notifications): add trending job type and scoring logic
fix(admin): correct city resolution on pending festival approval
docs: update CLAUDE.md with git workflow section
chore(db): add migration for push_delivery_audit table
```

### Workflow steps

1. Create a feature branch off `main`: `git checkout -b <type>/<description>`
2. Complete the task and verify it works.
3. Stage only the files changed for this task (`git add <files>` — avoid blanket `git add .`).
4. Commit with a conventional message.
5. Push the branch: `git push -u origin <branch>`
6. Open a PR: `gh pr create --title "..." --body "..."` (use the PR template below)
7. Merge immediately: `gh pr merge --merge --delete-branch`

### Rules

- **One logical change per commit.** Don't bundle unrelated changes.
- **Never commit** `.env.local`, secrets, or large generated files.
- **SQL migrations go in the same commit** as the code that depends on them.
- **CLAUDE.md updates go in the same commit** as the architectural change that prompted them.

---

## Project overview

Festivo is a moderation-first Bulgarian festival catalog. New catalog entries arrive via `ingest_jobs` (workers), land in `pending_festivals`, and require admin review before becoming visible in `festivals`. Public users browse verified festivals; authenticated users plan, follow, and receive notifications.

**Stack:** Next.js 14 App Router · Supabase Postgres + Auth · TypeScript · Tailwind · Vercel · Flutter mobile app (separate repo `festivo-mobile`)

**External runtime:** `festivo-workers` is a **separate repository** (not editable here). It processes `ingest_jobs`, upserts `pending_festivals`, and rehost hero images. This repo only contains worker helper code in `workers/` for reference.

---

## Context loading

Load only what the task requires — do not preload everything for small edits.

| Task area | Read first |
|---|---|
| Any task | `PROJECT_CONTEXT.md` |
| Schema / DB / RLS | existing queries, types, `scripts/sql/` migrations — **Supabase is authoritative** |
| Architecture, middleware, security | `docs/system-architecture.md` |
| Notifications, reminders, email | `docs/notification-system.md` |
| Entity relationships | `docs/er-diagram.md` |
| General dev rules | `AI_DEVELOPER_RULES.md` |
| Architecture guardrails | `AI_SYSTEM_ARCHITECT.md` |
| Scoring / ranking / recommendation algorithms | `docs/algorithms.md` |
| Organizer pages — visual/UX language | `docs/organizer-design-system.md` |

> `docs/database-schema.md` is **not** required reading and is not guaranteed current. Never treat it as authoritative.

If a file is missing, continue with the remaining files.

---

## Database rules (non-negotiable)

- **Never modify the database schema directly.**
- **Never assume schema changes are already applied.**
- All DDL/RLS changes must be delivered as SQL migration files.
- Schema removals require **explicit user confirmation** before writing the migration.

### Migration format

```
scripts/sql/YYYYMMDD_description.sql
```

Example: `scripts/sql/20260305_user_notification_preferences.sql`

Every migration must include: tables · indexes · constraints · RLS policies.

### Important tables

`cities` · `festivals` · `pending_festivals` · `ingest_jobs` · `festival_days` · `festival_schedule_items` · `festival_media` · `festival_organizers` · `organizers` · `organizer_members` · `organizer_promotion_credits` · `user_plan_festivals` · `user_plan_items` · `user_plan_reminders` · `user_notification_settings` · `user_email_preferences` · `user_followed_cities` · `user_followed_organizers` · `notification_jobs` · `notification_logs` · `push_delivery_audit` · `email_jobs` · `email_events` · `device_tokens` · `location_cache` · `discovery_sources` · `cron_locks` · `admin_audit_logs` · `user_sweep_retry_queue`

### Table naming conventions

- Plural snake_case: `user_plan_festivals`, `festival_schedule_items`
- `user_*` prefix for user-owned state tables
- Join/state tables are explicit — avoid reusing existing table names for new concerns
- Do not create duplicate tables; always check for existing tables that serve the same purpose

---

## Architecture principles (non-negotiable)

1. **Supabase is the single source of truth** for all persistent app state.
2. **Platform split is intentional:** Web = discovery + admin + organizer portal; Flutter mobile app = native planning + notifications experience.
3. **Background work must be idempotent** and guarded by dedupe keys.
4. **Privileged actions are server-only.** Never trust client input for authorization-sensitive operations.
5. **RLS-first for user-owned data.** Policies are mandatory, not optional.
6. **Service role keys are server-side only.** Never expose them to clients. Never log secrets or tokens.
7. **API contracts are stable interfaces.** Avoid breaking response shapes; version or provide a compatibility window when unavoidable.

---

## Safety rules

AI must never:
- Drop tables or columns automatically
- Delete data automatically
- Skip or weaken RLS policies
- Expose service role credentials client-side
- Introduce N+1 query patterns in jobs (prefetch or batch instead)
- Batch inserts larger than **500 rows**
- Construct Supabase Storage paths manually (use `lib/storage/paths.ts` helpers)

---

## Coding rules

- Prefer **minimal, incremental changes**. Don't refactor surrounding code unless the task requires it.
- Reuse existing API patterns in `app/api/` and `app/admin/api/`.
- Use `@supabase/supabase-js` compatible queries. No raw SQL outside migrations.
- Respect existing TypeScript types. Don't introduce `any` casts.
- Avoid introducing new dependencies unless genuinely required.
- Add indexes for all new lookup/filter/sort paths.
- Use pagination for admin lists and unbounded datasets.
- For AI extraction endpoints: strict-first extraction + additive fill-null-only enrichment. Never overwrite already-accepted values.
- When adding a new email type: register it in **both** `lib/email/emailRegistry.ts` and `lib/email/emailSchemas.ts` before using it.

---

## API route conventions

- All App Router API handlers live in `app/api/**/route.ts` (or `app/admin/api/**/route.ts` for admin-only).
- **User endpoints:** use a server-authenticated Supabase client (from `lib/supabase/server.ts`); validate session with `requireActiveUser` or `requireActiveUserWithSupabase`.
- **Admin endpoints:** use service-role client (`lib/supabaseAdmin.ts`) after verifying admin role (`resolveAdminAccessOrRedirect` / `hasAdminRole`).
- **Job/cron endpoints:** use `isAuthorizedJobRequest` from `lib/jobs/auth.ts` (checks `x-job-secret: JOBS_SECRET` or `vercel-cron` User-Agent).
- **Organizer portal endpoints:** use `requireOrganizerOwnerPortalSession` / `getPortalSessionUser` from `lib/organizer/portal.ts`.

---

## Supabase client usage

| Client | File | Use for |
|---|---|---|
| Server (RSC / route handlers) | `lib/supabase/server.ts` → `createServerClient()` | User-authenticated server code; reads session cookies |
| Admin (service role) | `lib/supabaseAdmin.ts` → `supabaseAdmin` | Privileged server-only operations; bypasses RLS |
| Browser | `lib/supabaseBrowser.ts` or `lib/supabase/client.ts` | Client components only |

Never use the service-role client in code that can be reached from the browser. Never use the browser client in server route handlers.

---

## Festival dates system

Festivals support two date models — always check which applies before writing date logic:

- **Continuous range:** `start_date` / `end_date` (most festivals). `occurrence_dates` is null/empty.
- **Discrete days:** `occurrence_dates` jsonb array of ISO date strings (non-consecutive festivals). `start_date`/`end_date` are derived min/max.

For listing/calendar/filter window queries, use the `festivals_intersecting_range(from, to)` Postgres RPC — do not write ad-hoc date range conditions. Optional `start_time` / `end_time` (`Postgres time`, Europe/Sofia) refine wall-clock scheduling for reminders and the "is past" check (see TODO in `lib/festival/isFestivalPast.ts`).

---

## Documentation sync rule

When a change affects **schema, API contracts, background jobs, notification pipelines, or security/middleware**, update the relevant docs **in the same PR**. Code and docs must land together.

| Change type | Update |
|---|---|
| Schema / RLS | `scripts/sql/` migration (required) · `docs/er-diagram.md` (if relationships change) · `PROJECT_CONTEXT.md` |
| Architecture / flows | `docs/system-architecture.md` · `PROJECT_CONTEXT.md` |
| Security / edge middleware / rate limits | `docs/system-architecture.md` · `README.md` (new env vars) |
| Notification / email pipelines | `docs/notification-system.md` · `PROJECT_CONTEXT.md` |
| New env vars for operators | `README.md` |

Do **not** update docs for UI-only changes, styling, or small bug fixes.

---

## Key modules & locations

### Routes

| Area | Path |
|---|---|
| Public pages (festivals, map, calendar, plan, profile…) | `app/` (no route group — pages are at top level) |
| Admin pages (protected) | `app/admin/(protected)/` |
| Admin API routes | `app/admin/api/` |
| Public API routes | `app/api/` |
| Mobile JSON APIs | `app/api/mobile/` |
| Background job endpoints | `app/api/jobs/` · `app/api/notifications/` · `app/api/cron/` |
| Organizer portal (pages + API) | `app/organizer/` · `app/api/organizer/` |
| Outbound click redirect | `app/out/` |
| Email unsubscribe | `app/unsubscribe/` |

### Components

Reusable UI and feature components live in `components/`. Subdirectories mirror concern: `components/admin/`, `components/organizer/`, `components/festivals/`, `components/plan/`, `components/map/`, etc.

### Libraries

| Module | Path |
|---|---|
| Supabase server client | `lib/supabase/server.ts` |
| Supabase service-role client | `lib/supabaseAdmin.ts` |
| Auth session helpers | `lib/auth/requireActiveUser.ts` · `lib/authUser.ts` (getOptionalUser) |
| Organizer portal session | `lib/organizer/portal.ts` (getPortalSessionUser) |
| Festival queries | `lib/queries.ts` |
| Festival date helpers | `lib/festival/` (occurrenceDates, listingDates, isFestivalPast…) |
| Settlement / city labels | `lib/settlements/` |
| Location / geocoding | `lib/location/` |
| Notification scheduling | `lib/notifications/scheduler.ts` · `lib/notifications/processDueJobs.ts` |
| Push sending | `lib/push/sendPush.ts` |
| Email queue, registry, schemas | `lib/email/` |
| Admin research pipeline | `lib/admin/research/` |
| Admin helpers (moderation, audit) | `lib/admin/` |
| Mobile recommendations | `lib/recommendations/` |
| Mobile API helpers | `lib/mobile/` |
| Plan helpers | `lib/plan/server.ts` |
| Rate limiting | `lib/rateLimit.ts` |
| Edge middleware | `middleware.ts` |
| Storage path helpers | `lib/storage/paths.ts` |
| SEO / base URL | `lib/seo.ts` · `lib/config/baseUrl.ts` |
| Accommodation (stub) | `lib/accommodation/` |
| Job auth | `lib/jobs/auth.ts` |

### Admin role

Stored in `public.user_roles`. Admin JWT claim is synced via `syncUserRoleToJwt` on role change. Use `resolveAdminAccessOrRedirect` / `hasAdminRole` for gate checks in server layouts; use service-role client for data mutations.

---

## Notification system overview

Two compatible layers — **use the MVP queue for all new work**. Details in `docs/notification-system.md`.

**MVP queue (primary):**
```
notification_jobs
  → GET /api/notifications/run (lib/notifications/processDueJobs.ts)
      → push: lib/push/sendPush.ts → device_tokens (FCM or Expo)
      → email: email_jobs → GET /api/jobs/email → Resend
```

**Legacy (unchanged, do not extend):**
```
user_plan_reminders → GET /api/jobs/reminders → user_notifications → GET /api/jobs/push
```

**Job types:** `reminder` · `update` · `weekend` · `new_city` · `followed_organizer` · `trending`

**Email type registration:** before using a new `email_jobs.type`, register it in `lib/email/emailRegistry.ts` AND `lib/email/emailSchemas.ts`.

**Email preference gating:** required transactional emails (`organizer-claim-*`, `festival-approved/rejected`, etc.) are **fail-open** on prefs lookup. Optional reminder emails are **fail-closed** — missing prefs or lookup failure → skip send, log reason, no retry.

**Cron:** single entry in `vercel.json` → `GET /api/cron/worker` every 5 minutes. Runs notification batching, email jobs, reminder/push jobs, weekend digest scheduling, and user sweep retry. All job endpoints accept `x-job-secret: JOBS_SECRET`. Overlap prevented by `cron_locks`.

**Push providers:** `PUSH_PROVIDER=fcm` (default, legacy HTTP) or `expo`. Controlled by `PUSH_ENABLED`. Missing FCM key does not abort the runner — push is optional within a job run.

**Push audit:** every send attempt is written to `push_delivery_audit`. Mobile inbox reads from `GET /api/notifications/inbox`. Open events: `POST /api/push/open`.

---

## Content moderation flow

```
ingest_jobs (admin enqueue or discovery worker)
  → festivo-workers (external repo) → pending_festivals
  → admin review at /admin/pending-festivals/[id]
      → approve → festivals row (status=verified, is_verified=true)
               → festival_days + festival_schedule_items (from program_draft)
               → festival_media (from gallery_image_urls)
               → triggers notification_jobs for followers
      → reject  → pending row status=rejected
```

**Research path:** Gemini pipeline (`lib/admin/research/`) → `ingest_jobs` with `source_type=research` → worker inserts `pending_festivals` from `payload_json.pending_row` (no scraping; snapshot pre-built by web app including geocode + hero rehost).

**AI values on `pending_festivals` are advisory only** — shown as hints, applied only by explicit admin action. Core moderated fields are always authoritative at approve time.

---

## Organizer portal

Users link to organizers via `organizer_members` (`owner/admin/editor`, `pending/active/revoked`). Active owners access `/organizer/dashboard`. Submissions use `submission_source=organizer_portal` and still require admin approval. Admin reviews claims at `/admin/organizer-claims`. See `docs/system-architecture.md` — *Organizer portal* section.

---

## Monetization layer

- `organizers.plan`: `free` / `vip` (active during `plan_started_at` → `plan_expires_at` window)
- `festivals.promotion_status`: `normal` / `promoted` + `promotion_rank`
- Credits: `organizer_promotion_credits` (one row per organizer/year, lazy-created; credit consumed only on `normal → promoted` transition)
- Public listing order: promoted → higher `promotion_rank` → VIP organizers → higher `organizer_rank` → `start_date` asc

---

## Environment variables (key)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client (public, used in browser and server) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only privileged access |
| `JOBS_SECRET` | Job endpoint auth header (`x-job-secret`) |
| `NEXT_PUBLIC_SITE_URL` | Canonical base URL — used in emails, SEO, origin guard |
| `FESTIVO_PUBLIC_MODE` | `live` or `coming-soon` |
| `FESTIVO_PREVIEW_SECRET` | Preview mode unlock token |
| `RESEND_API_KEY` · `RESEND_WEBHOOK_SECRET` | Email queue + webhook verification (Svix) |
| `EMAIL_ADMIN` | Admin alert inbox (optional; omit to skip admin-only email types) |
| `EMAIL_REPLY_TO` | Reply-To header for Resend (optional) |
| `EMAIL_ENABLED` | Set to `false` to queue emails without sending (dev/staging) |
| `FCM_SERVER_KEY` | Push — FCM legacy HTTP |
| `PUSH_ENABLED` · `PUSH_PROVIDER` | Push control (`fcm` or `expo`) |
| `GEMINI_API_KEY` / `GOOGLE_AI_API_KEY` | AI research pipeline (Gemini) |
| `GEMINI_RESEARCH_MODEL` | Override Gemini model (default `gemini-2.0-flash`) |
| `PERPLEXITY_API_KEY` | URL discovery in admin research |
| `UPSTASH_REDIS_REST_URL` · `UPSTASH_REDIS_REST_TOKEN` | Rate limiting (optional; skipped if absent) |
| `CSRF_ALLOWED_HOSTS` | Extra comma-separated POST origin allowlist |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` · `TURNSTILE_SECRET_KEY` | Bot protection on public forms |
| `SUPABASE_HERO_IMAGES_BUCKET` | Storage bucket for festival hero images (default `festival-hero-images`) |
| `SUPABASE_ORGANIZER_LOGOS_BUCKET` | Storage bucket for organizer logos (default `organizer-logos`) |
| `FESTIVO_SETTLEMENT_UNKNOWNS_LOG` | Set to `1` to log unclassified settlement names to `settlement_unknowns` |
| `WEB_RESEARCH_PROVIDER` | Alternative research backend: `tavily` or `serpapi` (used by `lib/admin/research/web-provider.ts`) |
| `WEB_RESEARCH_SEARCH_URL` · `WEB_RESEARCH_API_KEY` | Search endpoint + key for the web research provider above |
| `TAVILY_API_KEY` · `SERPAPI_KEY` | Provider-specific keys for Tavily / SerpAPI URL discovery |
| `OPENAI_API_KEY` | OpenAI key for `lib/admin/research/openai-extract.ts` (gpt-4o-mini field extraction, alternative to Gemini) |

Full list with descriptions: `README.md`.

---

## Deployment

**Проектът е свързан с Vercel** (`patar0k0s-projects/festivo-web`, project ID `prj_1G3NDM87gFdYUfUwqDdHs9msSi8a`) чрез GitHub интеграция.

### Как работи автоматичният деплой

| Събитие | Резултат |
|---|---|
| Push / merge към `main` | Production деплой (автоматично) |
| Push на feature branch | Preview деплой (автоматично) |

**Не е нужно да се изпълнява ръчен деплой след всеки merge** — Vercel засича промените в GitHub и деплойва сам.

### `/deploy` команда

Когато потребителят напише `/deploy`:

1. Увери се, че всички промени са commit-нати и push-нати към `main`.
2. Провери статуса на последния деплой:
   ```
   vercel ls --scope patar0k0s-projects
   ```
3. Ако деплоят е `● Ready` — готово. Докладвай URL-а на production деплоя.
4. Ако деплоят е `● Error` или `● Building` — провери логовете:
   ```
   vercel inspect <deployment-url> --logs
   ```
5. При нужда от принудителен ръчен деплой:
   ```
   cd C:\Project\festivo-web && vercel --prod
   ```

### Полезни Vercel CLI команди

```bash
vercel ls                          # последни деплои
vercel inspect <url> --logs        # build логове на конкретен деплой
vercel rollback                    # връщане към предишен production деплой
vercel env ls                      # преглед на env vars в Vercel
vercel env add <NAME> production   # добавяне на env var
```

### Важно за env vars

Vercel production env vars се управляват от Vercel dashboard или CLI — **не** от локалния `.env.local`. При добавяне на нова задължителна env var:
1. Добави я в `C:\Project\festivo-web\.env.local` (за локална разработка).
2. Добави я в Vercel: `vercel env add <NAME> production`.
3. Документирай я в таблицата с env vars в CLAUDE.md.

---

## PR change template

Include this in PR descriptions for any non-trivial change:

```md
## Proposed Change
- Summary:
- Why now:

## Impacted Docs
- docs/...

## Checklist
- [ ] Schema: migration in scripts/sql/ with indexes + RLS
- [ ] API contract: backward-compatible or versioned
- [ ] Background jobs: idempotent, dedupe key, batch ≤500
- [ ] Security: service role server-only, RLS validated
- [ ] SEO: canonical URLs, metadata complete (if public page)
- [ ] Mobile sync: retry-safe, server-authoritative (if mobile-facing)
- [ ] Docs updated in this PR
- [ ] CLAUDE.md updated (if architectural change)
```
