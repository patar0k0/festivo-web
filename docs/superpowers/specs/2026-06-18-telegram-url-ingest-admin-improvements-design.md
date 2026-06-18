# Telegram URL Ingest + Professional `/admin/ingest` — Design

**Date:** 2026-06-18
**Status:** Approved (ready for implementation plan)

## Goal

Two coupled improvements to the Facebook-event ingestion surface:

1. **Telegram URL ingest** — let the operator send a Facebook event link (web address) to the existing Telegram poster bot from their phone and have it enqueued into `ingest_jobs`, exactly as if it were pasted into the `/admin/ingest` form. The worker scrapes it as usual.
2. **Professional `/admin/ingest`** — full Bulgarian localization, colored status badges, filtering/search, pagination, and a provenance marker that distinguishes Telegram-submitted jobs from web-submitted ones. Backend cleaned up where it directly serves these goals.

## Background — current state

- `/admin/ingest` ([page.tsx](../../../app/admin/(protected)/ingest/page.tsx)) renders [IngestJobsPanel](../../../components/admin/IngestJobsPanel.tsx): a form to paste a `facebook.com/events/...` URL plus a table of the latest 50 `ingest_jobs`, with retry/delete and links to the matched pending/published festival.
- Enqueue goes through `POST` [/admin/api/ingest-jobs](../../../app/admin/api/ingest-jobs/route.ts), which normalizes/validates the FB event URL, inserts `ingest_jobs` (`source_type=facebook_event`, `payload_json.submission_source="ingest"`), and relies on a **unique constraint on the normalized `source_url`** (the route catches Postgres `23505` → "Already queued").
- The external `festivo-workers` repo scrapes the FB event → `pending_festivals` → admin moderation.
- A whitelist-gated Telegram **poster bot** already exists at [/api/telegram/poster-bot](../../../app/api/telegram/poster-bot/route.ts). It accepts **photos** (→ vision pipeline → `pending_festivals`) and **ignores text messages**. Helpers live in [posterBot.mjs](../../../lib/telegram/posterBot.mjs); the whitelist is the shared `social_repost_allowed_users` table.

### Problems this design addresses

- The operator must open the admin panel on a desktop to queue a link; no mobile/quick path.
- `page.tsx` logs a per-row `console.info` on every page load (noise).
- The queue is hard-capped at 50 rows with no pagination or filtering.
- UI is mixed Bulgarian/English; statuses are plain text with no visual hierarchy.
- Enqueue + URL-normalization logic is inline in the API route and cannot be reused by the bot.

## Locked decisions (do not re-litigate)

- **Extend the existing poster bot** — no new bot, token, or webhook. Photos keep going to the poster pipeline; a text message containing a URL is the new path. (Confirmed with user.)
- **FB event links only.** Non-Facebook-event URLs are rejected with a friendly message. (Confirmed.)
- **Dedup = "warn but allow."** If the link already exists as a pending/published festival, still enqueue and include a warning. If the same link is already in `ingest_jobs`, the unique constraint blocks it → reply "already queued." (Confirmed.)
- **No schema migration.** Provenance is stored in the existing `ingest_jobs.payload_json` jsonb (`submission_source="telegram"`, `telegram_user_id`). Whitelist reuses `social_repost_allowed_users`.
- **No new env vars.** Reuses `TELEGRAM_POSTER_BOT_TOKEN` / `TELEGRAM_POSTER_WEBHOOK_SECRET`.
- **Full UI redesign** including filters + pagination (user: "давай както прецениш професионално").
- **Matching logic stays.** The source_url / normalized-url / FB-event-id matching in `page.tsx` is correct and not a bottleneck at current scale (~65 festivals). Not rewritten now (YAGNI); only extended to also expose provenance.

## Architecture

```
Operator's phone
  → Telegram poster bot (FB event link as text)
      → POST /api/telegram/poster-bot  (existing webhook, secret-gated)
          → mapPosterUpdate → { kind: "url" }
          → whitelist (social_repost_allowed_users)
          → enqueueFacebookEventIngest(supabase, url, "telegram", { telegramUserId })
              → normalizeFacebookEventUrl  (shared)
              → optional pending/published lookup (warn-but-allow)
              → insert ingest_jobs (source_type=facebook_event,
                                    payload_json.submission_source="telegram")
          → Telegram reply (queued / already-queued / warn-duplicate / rejected)
  → festivo-workers scrapes → pending_festivals  (unchanged)
```

The same `enqueueFacebookEventIngest` and `normalizeFacebookEventUrl` helpers back the existing web form, so both paths behave identically.

## File structure

| File | Change | Responsibility |
|---|---|---|
| `lib/admin/ingest/normalizeFacebookEventUrl.ts` | **new** | Pure URL normalize/validate (extracted from the API route). Returns `{ value }` or `{ error }`. |
| `lib/admin/ingest/enqueueFacebookEventIngest.ts` | **new** | Shared enqueue: normalize → optional dup lookup → insert `ingest_jobs`. Used by the web route and the bot. Accepts a `SupabaseClient`, the raw URL, a `submissionSource`, and optional `telegramUserId`. Returns a discriminated result (`queued` / `already_queued` / `duplicate_warning` / `error`). |
| `app/admin/api/ingest-jobs/route.ts` | modify | Replace inline normalize + insert for the `facebook_event` branch with the shared helper. Research/discovery branches unchanged. |
| `lib/telegram/posterBot.mjs` | modify | Add `extractFacebookEventUrl(message)`; extend `mapPosterUpdate` to return `{ kind: "url", chatId, userId, url }`; add reply formatters (`formatUrlQueued`, `formatUrlAlreadyQueued`, `formatUrlDuplicateWarning`, `formatUrlRejected`). Pure + unit-tested. |
| `lib/telegram/posterBot.d.mts` | modify | Types for the `url` action variant and the new formatters. |
| `lib/telegram/posterBot.test.mjs` | modify | Tests for URL extraction, the `url` action, multi-link, and formatters. |
| `app/api/telegram/poster-bot/route.ts` | modify | Handle `action.kind === "url"`: whitelist → `enqueueFacebookEventIngest` → reply. Photo + dup-decision paths unchanged. |
| `app/admin/(protected)/ingest/page.tsx` | modify | Also select `payload_json`; derive `submission_source` per row; remove per-row `console.info`; add pagination (page-size constant + offset). |
| `components/admin/IngestJobsPanel.tsx` | modify | BG localization, status badges, status/source filters, URL search, pagination controls, Telegram provenance chip. |
| `CLAUDE.md` | modify | Update the "Telegram poster ingest bot" section to note it also accepts FB event links → `ingest_jobs`. |

No migration. No README env-var change.

## Detailed behavior

### 1. Bot — URL path

**Update mapping (`mapPosterUpdate`).** Today text → `{ kind: "ignore" }`. New: if the message has text/caption containing at least one HTTP(S) URL, return `{ kind: "url", chatId, userId, url }` using the **first** extracted URL. Photos still map to `{ kind: "photo" }` (a photo with a caption that has a link is still treated as a poster — photo wins). URL extraction reads both raw text and Telegram `entities` of type `url`/`text_link`.

**Multi-link (bonus).** If a single text message contains several URLs, the route processes each through `enqueueFacebookEventIngest` and replies with a compact per-link summary. The pure helper exposes all extracted URLs; `mapPosterUpdate` keeps the single-`url` shape for the common case and a parallel `urls[]` for the route to iterate. (Kept simple: if this complicates the helper, ship single-link first.)

**Route handling (`kind === "url"`).**
1. Whitelist check against `social_repost_allowed_users` (same as photo path).
2. Call `enqueueFacebookEventIngest(supabase, url, "telegram", { telegramUserId })`.
3. Reply based on the result:
   - `queued` → `✅ Добавено в опашката за обработка.` + link to `${baseUrl}/admin/ingest`.
   - `already_queued` → `ℹ️ Този линк вече е в опашката.`
   - `duplicate_warning` → `⚠️ Вече има запис за този линк, но го добавих пак в опашката.` + admin link to the existing pending/published record.
   - `error` (incl. invalid/non-FB URL) → friendly message, e.g. `Това не изглежда като Facebook event линк (facebook.com/events/...).`

The reply is best-effort (`tg()` never throws), matching the existing route style.

### 2. `enqueueFacebookEventIngest` — shared enqueue

```
enqueueFacebookEventIngest(supabase, rawUrl, submissionSource, opts?) →
  | { ok: true, kind: "queued", jobId }
  | { ok: true, kind: "already_queued" }
  | { ok: true, kind: "duplicate_warning", jobId, existing: { type: "pending"|"published", id } }
  | { ok: false, kind: "error", error, status }
```

- Normalizes via `normalizeFacebookEventUrl`; invalid → `{ ok:false, error, status:400 }`.
- **Warn-but-allow lookup:** query `pending_festivals` then `festivals` by the normalized `source_url` (and FB-event-id where cheap). If found, the eventual result is `duplicate_warning` (still attempts the insert).
- Insert `ingest_jobs` with `source_type=facebook_event`, `status=pending`, `payload_json={ schema_version:1, submission_source, telegram_user_id? }`.
- On unique-constraint `23505` → `already_queued`.
- On success → `queued` (or `duplicate_warning` if the lookup flagged an existing record).

The web route's `facebook_event` branch becomes a thin wrapper: call the helper, map `already_queued` → HTTP 409, keep its `logAdminAction` audit entry. The bot path stores provenance in `payload_json` and skips `admin_audit_logs` (no app-user actor; avoids a schema change).

### 3. `/admin/ingest` — UI + page

**Page (`page.tsx`):**
- Extend the `ingest_jobs` select to include `payload_json`; derive `submission_source` (`"telegram"` | `"ingest"` | `"discovery"` | fallback) onto each row type.
- Remove the per-row `console.info` debug line.
- Add pagination: `PAGE_SIZE` constant, `?page=` search param → `.range(offset, offset+PAGE_SIZE-1)` and a total count for controls. Matching lookups continue to operate over the current page's jobs.

**Panel (`IngestJobsPanel.tsx`):**
- **Localization:** all visible strings → Bulgarian ("Добави в опашката", "Статус", "Източник", "Създаден", "Няма job-ове в опашката", etc.). Code identifiers stay English.
- **Status badges:** colored chips for the workflow state already computed (`in_queue` / `processing` / `done` / `failed`; and for done jobs: `pending_review` / `published` / `rejected` / `approved` / `no_pending`). Reuse existing admin color tokens.
- **Provenance chip:** a small "Telegram" tag on rows where `submission_source==="telegram"` (web/discovery get their own subtle marker or none).
- **Filters:** status filter + source filter (всички / Facebook / Research / Discovery / Telegram) as chips; a URL **search** box filters the current page client-side. (Cross-page filtering is out of scope for v1 — see below.)
- **Pagination controls:** prev/next + page indicator wired to the `?page=` param.
- Keep the existing `AdminEntityPageShell` / `AdminSummaryStrip` / `AdminFieldSection` structure for consistency with other admin pages.

## Data & provenance

- **`ingest_jobs.payload_json`** — `submission_source`: `"ingest"` (web), `"telegram"` (bot), `"discovery"`, `"research"`. `telegram_user_id` added for bot rows. No new columns.
- **Whitelist** — `social_repost_allowed_users` (existing).
- **Dedup key** — existing unique constraint on normalized `source_url` in `ingest_jobs`.

## Edge cases & error handling

- Non-FB or malformed URL → `rejected` reply; nothing inserted.
- Photo with a link in its caption → treated as a poster (photo path), not URL ingest.
- Same link sent twice → `already_queued` (unique constraint).
- Link already a pending/published festival → `duplicate_warning`, still enqueued.
- Telegram delivery failures never fail the webhook (best-effort `tg()`).
- Non-whitelisted sender → "Нямаш достъп до този бот." (existing behavior).
- Empty queue / DB error on the page → localized states (existing error card, localized).

## Testing

- **Pure helpers (Node test runner, `node --test`):**
  - `posterBot.test.mjs` — URL extraction (raw + entities), `url` action mapping, photo-still-wins, multi-link, and each formatter's output.
  - `normalizeFacebookEventUrl` — valid/invalid/normalization cases (move/expand the cases currently implicit in the route).
- **Type-check:** `npx tsc --noEmit` for all touched `.ts`/`.tsx`.
- **Integration smoke:** post a synthetic Telegram `update` (text with a FB event link) to the webhook with the correct secret + a whitelisted user → assert an `ingest_jobs` row with `submission_source="telegram"` and a success reply.
- **UI:** verify in production-like admin (admin pages are auth + service-role gated; cannot run a local preview — verified in prod per project norms).

## Out of scope / YAGNI

- Rewriting the `page.tsx` source-url matching for efficiency (fine at current scale).
- Cross-page server-side filtering/search (v1 filters operate on the loaded page).
- A dedicated `telegram_ingest_jobs` audit table (the `ingest_jobs` row + `payload_json` is the record).
- Any change to the worker / scraping path.
- New env vars or a new bot.

## Docs to update (in the implementing PR)

- `CLAUDE.md` — "Telegram poster ingest bot" section: note it also accepts FB event links → `ingest_jobs` (`submission_source="telegram"`).
- This spec committed under `docs/superpowers/specs/`.
