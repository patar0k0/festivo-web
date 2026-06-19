# Facebook Post Ingest (poster-bot) — Design

**Status:** Approved by user, ready for implementation planning.

## Problem

The Telegram poster-bot only accepts Facebook **Event** links
(`facebook.com/events/...`). Many organizers announce festivals as a plain
**post or story** (`m.facebook.com/story.php?story_fbid=...`,
`facebook.com/{page}/posts/...`, `facebook.com/groups/{id}/posts/...`,
`/permalink.php?...`) without ever creating a formal Event. Today the bot
rejects these with "URL must contain facebook.com/events/." and there is no
path to ingest them.

These URLs are also frequently **login-walled** — Telegram's own link
preview shows "Log in or sign up to view" for them — so a plain unauthenticated
`fetch()` cannot read the content.

## Existing building blocks (discovered during research)

- `festivo-workers` already has an **opt-in, not-yet-deployed** v2 ingest
  worker (`workers/fb_ingest_v2_worker.js`, `npm run start:fb-v2`) that:
  - Uses **authenticated Playwright** (`fetchSnapshotWithPlaywright`, via
    `workers/lib/fb_session_context.js` + `FB_STORAGE_STATE_B64` — an
    exported logged-in FB session) to load login-walled pages.
  - Already recognizes `facebook.com/posts/`, `/permalink/`,
    `/groups/*/posts/` as valid child URLs (`isLikelyFacebookChildUrl`).
  - Polls `ingest_jobs` for `job_type IN ('discover_source','discover_url',
    'extract_url','verify_candidate')` and extracts via generic DOM text +
    gpt-4o-mini AI normalization (`runAiNormalizationForPendingFestival`).
  - This worker is **not currently deployed** (no Railway cron service runs
    `start:fb-v2`); production cron still runs only v1
    (`workers/ingest_fb_event.js`, Events-only).
- `festivo-web`'s poster-bot pipeline (`lib/admin/poster/`) already has a
  complete, working Gemini-vision extraction → web-enrichment → dedup →
  insert pipeline (`processPosterFromFile` in
  `lib/admin/poster/processPosterJob.ts`), plus the Telegram dup-confirm
  UX (`lib/telegram/posterBot.mjs`: `formatDuplicate`, `dupKeyboard`,
  `formatEnriched`, the `dup-decision` callback handler in
  `app/api/telegram/poster-bot/route.ts`). This UX and dedup logic should be
  reused as-is rather than duplicated.

## Decision

Reuse the authenticated scraper from `festivo-workers`, but route the
scraped content through `festivo-web`'s **existing Gemini extraction
pipeline** instead of the v2 worker's generic AI-normalization path. This
follows the architectural split already established for the research
pipeline (per `CLAUDE.md`): `festivo-web` owns AI/extraction logic;
workers are mechanical executors (scrape, fetch, hand off).

This means:
- **No** new Gemini integration in `festivo-workers` — it stays a "dumb"
  scraper.
- **No** dependency on the v2 worker's `extract_url`/`verify_candidate`
  job types or its `pending_festivals` insert path — those stay
  untouched/unused by this feature.
- A **new, dedicated** job type (`scrape_facebook_post`) and a **new**
  `festivo-web` job endpoint own the FB-post-specific flow end to end,
  reusing `poster_ingest_jobs` (not `pending_festivals` directly) as the
  state/UX table, exactly like the existing photo flow.

## Data flow

```
Telegram text message containing a FB post/permalink/story link
  → app/api/telegram/poster-bot/route.ts (action.kind === "url")
      → new URL classifier (lib/telegram/posterBot.mjs):
            contains "/events/"                          → existing flow (facebook_event)
            facebook.com + one of posts/permalink/story.php/groups *too*/posts → new flow
            anything else                                 → existing reject message
      → upsert poster_ingest_jobs
            (status="queued_scrape", telegram_chat_id, telegram_user_id,
             tg_file_id=null, dedupe_key=sha256(chatId::normalizedUrl))
      → insert ingest_jobs
            (source_type="facebook_post", job_type="scrape_facebook_post",
             source_url=normalizedUrl, status="queued",
             payload_json={ poster_ingest_job_id })
      → Telegram: "⏳ В опашката за извличане на поста…"

festivo-workers: workers/fb_ingest_v2_worker.js
  → claimJobs(): job_type list extended with "scrape_facebook_post"
  → new handleScrapeFacebookPostJob(job):
        snapshot = await fetchSnapshotWithPlaywright(job.source_url)   // reused 1:1
        POST {WEB_BASE_URL}/api/jobs/facebook-post-extract
            headers: x-job-secret: JOBS_SECRET
            body: { posterIngestJobId, sourceUrl, text: snapshot.bodyText,
                     imageUrls: snapshot.images }
        on 2xx  → markJobStatus(job, "done")
        on error → markJobStatus / handleJobError (existing retry logic, reused 1:1)

festivo-web: POST /api/jobs/facebook-post-extract  (new)
  auth: isAuthorizedJobRequest (lib/jobs/auth.ts) — same pattern as other job endpoints
  → load poster_ingest_jobs row by id (for telegram_chat_id/user_id)
  → update status="processing"; send Telegram progress messages (reuse the
    PosterProgress callback convention from processPosterJob.ts):
        "🖼 Качвам плаката…" / "🔍 Анализирам поста (Gemini)…" /
        "🌐 Търся допълнителна информация…" / "📍 Геокодиране и проверка за дублати…"
  → pick best image from imageUrls (first og:image-shaped URL, else first),
    fetch its bytes, uploadPosterImage() — reused 1:1; if no images, hero
    stays null and buildPosterPendingRow must tolerate that (see Open
    Question below)
  → extractFestivalFromFacebookPost({ text, image? }) — NEW extractor,
    sibling to extractFestivalFromPoster, reusing posterExtractionSchema +
    geminiExtractJsonWithImages (or a text-only Gemini call when there is
    no image)
  → enrichPosterFromWeb() — reused 1:1
  → buildPosterPendingRow() — reused 1:1
  → findDuplicateFestivals() — reused 1:1
  → duplicate found → update poster_ingest_jobs(status="awaiting_dup_confirm",
    dup_matches, extraction_json) + Telegram formatDuplicate + dupKeyboard
    (the existing "create"/"discard"/"enrich" callback handlers in
    route.ts work unchanged — they key off poster_ingest_jobs.id)
  → no duplicate → insertPosterRow() — reused 1:1 → Telegram formatInserted
```

## Components

### New files

| File | Responsibility |
|---|---|
| `app/api/jobs/facebook-post-extract/route.ts` | Job endpoint: receives scraped text/images, runs extraction → dedup → insert, drives the same Telegram UX as the photo flow. |
| `lib/admin/poster/extractFestivalFromFacebookPost.ts` | Gemini extraction from raw post text + optional image, returns `PosterExtraction` (same schema as the photo extractor). |

### Modified files (festivo-web)

| File | Change |
|---|---|
| `lib/telegram/posterBot.mjs` | New URL classifier function distinguishing event vs. post/permalink/story links; `mapPosterUpdate`'s `"url"` kind stays the same (still returns raw URLs) — classification happens in the route handler. |
| `app/api/telegram/poster-bot/route.ts` | In the `action.kind === "url"` branch, route each URL through the classifier: event → existing `enqueueFacebookEventIngest`; post-shaped → new `enqueueFacebookPostScrape` helper (mirrors `enqueueFacebookEventIngest`'s shape: upsert `poster_ingest_jobs` + insert `ingest_jobs`). |
| `lib/admin/poster/processPosterJob.ts` | No change to `processPosterFromFile`; the new job endpoint composes the same downstream helpers (`enrichPosterFromWeb`, `buildPosterPendingRow`, `findDuplicateFestivals`, `insertPosterRow`) directly rather than going through this function (which is photo-specific from the top). |

### Modified files (festivo-workers — separate repo, same machine at `C:\Projects\festivo-workers`)

| File | Change |
|---|---|
| `workers/fb_ingest_v2_worker.js` | Add `"scrape_facebook_post"` to the `job_type` filter in `claimJobs()`; add `handleScrapeFacebookPostJob`; dispatch it from `processJob`. |
| new migration in `scripts/sql/` | `ALTER ... ingest_jobs_job_type_check` to add `'scrape_facebook_post'` to the allowed list (current constraint only allows the 4 v2-discovery job types; verified live). |

### Database

- `ingest_jobs.source_type` already allows `'facebook_post'` on the live DB
  (verified via `pg_get_constraintdef`) — no migration needed there.
- `ingest_jobs.job_type` constraint must be widened — migration needed
  (delivered as a `festivo-web/scripts/sql/` file per this repo's
  convention, applied via Supabase MCP to the shared live DB; the
  `festivo-workers` repo's own `scripts/sql/` copy should also be updated
  for documentation parity but is not authoritative).
- No `poster_ingest_jobs` schema change needed — `tg_file_id`/`tg_file_unique_id`
  are already nullable (used for the URL-based flow's dedupe key, not file
  identity).

## URL classification rules

A URL is **event-shaped** if its path contains `/events/` (existing rule,
unchanged).

A URL is **post-shaped** if it is a `facebook.com` (or `*.facebook.com`)
host AND its path matches one of:
- `/story.php` (story_fbid query param)
- `/permalink.php`
- `/posts/`
- `/groups/{id}/posts/`

Anything else (a bare profile/page URL, a non-Facebook URL, etc.) keeps the
existing rejection message, but its wording should be updated since it
currently claims only `/events/` is valid — it should now mention both
accepted shapes.

## Error handling

- Worker scrape failure (page doesn't load, FB blocks the authenticated
  session, timeout) → existing `handleJobError`/retry-with-backoff logic
  (3 attempts, 15 min apart) — reused unchanged. After max attempts, the
  `poster_ingest_jobs` row is left at `queued_scrape` indefinitely; the job
  endpoint is what would set it to `error`, but it never got that far. The
  implementation plan should add a small worker-side step: on final
  failure (`attempts >= maxAttempts`), POST a failure notice to a tiny new
  festivo-web endpoint (or directly send a Telegram message, since the
  worker doesn't have the bot token) — **simplest fix: pass
  `telegram_chat_id` in `ingest_jobs.payload_json` and have the worker call
  `TELEGRAM_POSTER_BOT_TOKEN`'s `sendMessage` directly on final failure**,
  since `festivo-workers` already sends Telegram messages from other
  workers (`social_repost_worker.js`).
- `POST /api/jobs/facebook-post-extract` failures (Gemini error, dedup
  error, insert error) → same pattern as `processPosterFromFile`: catch,
  update `poster_ingest_jobs.status="error"`, send
  `❌ Грешка при обработка: ...` to Telegram. Reuses the existing
  stale-`processing`-job recovery (6-minute window) added earlier this
  session, so a stuck row here doesn't block retries either.
- Text-only posts (no images) are valid — `extractFestivalFromFacebookPost`
  must work with `image: null`, doing a text-only Gemini call instead of
  vision. `buildPosterPendingRow` currently assumes a `heroUrl: string`
  (required) — **open question, see below**.

## Resolved: text-only posts (no image)

Checked `buildPosterPendingRow` → `buildResearchPendingRowFromRequest`:
`ai_result.hero_image: null` is already a handled path
(`resolveHeroImageFieldForInsert` returns `{ hero_image: null }` when there's
nothing to resolve). So `buildPosterPendingRow`'s `heroPublicUrl` parameter
should become `string | null`, and the new job endpoint passes `null` when
`imageUrls` is empty (skipping the fetch/`uploadPosterImage` step entirely).
No schema or fallback-image work needed.

## Ops prerequisite (outside this repo's code, tracked here for visibility)

For this feature to function at all in production:
1. `FB_STORAGE_STATE_B64` must be set on the Railway service running
   `fb_ingest_v2_worker.js` — a real, currently-logged-in FB session
   exported as Playwright storage state. This is a manual one-time export
   (open FB in a real browser, log in, export cookies/localStorage via
   Playwright's `context.storageState()`).
2. A new Railway cron service (or piggyback into `cron_combo.js`, matching
   the pattern other workers use to share Railway's free-tier slot) must
   run `npm run start:fb-v2` on a schedule.
3. `OPENAI_API_KEY` is referenced by `runAiNormalizationForPendingFestival`
   but that function is **not** called by the new `scrape_facebook_post`
   path — not required for this feature.

These are infra/ops steps, not code changes, and should be called out
explicitly to the user before this feature is considered "done."
