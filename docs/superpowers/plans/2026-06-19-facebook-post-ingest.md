# Facebook Post Ingest (poster-bot) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the Telegram poster-bot accept Facebook post/permalink/story links (not just `facebook.com/events/...`), queueing them for a (separately planned) `festivo-workers` scraper that hands scraped text/images back to a new `festivo-web` job endpoint, which runs them through the existing Gemini extraction → dedup → `pending_festivals` pipeline.

**Architecture:** A new URL classifier in the Telegram webhook routes post-shaped links to a new `enqueueFacebookPostScrape` helper (mirrors the existing `enqueueFacebookEventIngest`), which writes a `poster_ingest_jobs` row (UX/state) plus an `ingest_jobs` row (`job_type="scrape_facebook_post"`) for the worker to claim. A new `POST /api/jobs/facebook-post-extract` endpoint receives the worker's scraped payload and reuses the existing poster pipeline's extraction-adjacent helpers (`enrichPosterFromWeb`, `buildPosterPendingRow`, `findDuplicateFestivals`, `insertPosterRow`) plus a new Gemini extractor adapted for post text instead of poster images.

**Tech Stack:** Next.js 14 App Router route handlers, Supabase (Postgres + Storage), Zod, Google Gemini (`@google/generative-ai` via `lib/admin/research/gemini-provider.ts`), `node:test` + `vitest` for tests.

**Scope note:** This plan covers `festivo-web` only. The `festivo-workers` side (the actual Playwright scrape + the worker handler that POSTs to the new endpoint) is a **separate plan, separate repo** (`C:\Projects\festivo-workers`) — not part of this plan. The new job endpoint built here can be fully verified with a synthetic `curl` request before that worker exists (see Task 11).

**Reference spec:** `docs/superpowers/specs/2026-06-19-facebook-post-ingest-design.md`

---

## Task 1: Database migration

**Files:**
- Create: `scripts/sql/20260619_facebook_post_ingest.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Allow the new dedicated job type used by the Telegram poster-bot's
-- Facebook-post scrape flow (festivo-workers will claim jobs with this type).
alter table public.ingest_jobs drop constraint if exists ingest_jobs_job_type_check;
alter table public.ingest_jobs
  add constraint ingest_jobs_job_type_check
  check (job_type is null or job_type in ('discover_source','discover_url','extract_url','verify_candidate','scrape_facebook_post'));

-- poster_ingest_jobs rows created from a submitted link (not a Telegram photo)
-- have no Telegram file identity.
alter table public.poster_ingest_jobs alter column tg_file_id drop not null;
alter table public.poster_ingest_jobs alter column tg_file_unique_id drop not null;
```

- [ ] **Step 2: Apply it to the live database via the Supabase MCP**

Use the `apply_migration` MCP tool (project id `hpvfsdmpatgceohigswm`) with the SQL
above as the migration body and name `20260619_facebook_post_ingest`.

- [ ] **Step 3: Verify the constraint and nullability changed**

Run this query via the Supabase MCP `execute_sql` tool:

```sql
select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.ingest_jobs'::regclass and conname = 'ingest_jobs_job_type_check';
select column_name, is_nullable from information_schema.columns where table_name = 'poster_ingest_jobs' and column_name in ('tg_file_id','tg_file_unique_id');
```

Expected: the constraint definition includes `'scrape_facebook_post'`; both columns show `is_nullable = YES`.

- [ ] **Step 4: Commit**

```bash
git add scripts/sql/20260619_facebook_post_ingest.sql
git commit -m "chore(db): allow scrape_facebook_post job type, nullable poster job file fields"
```

---

## Task 2: URL normalizer for Facebook post/permalink/story links

**Files:**
- Create: `lib/admin/ingest/normalizeFacebookPostUrl.mjs`
- Test: `lib/admin/ingest/normalizeFacebookPostUrl.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeFacebookPostUrl } from "./normalizeFacebookPostUrl.mjs";

test("accepts a story.php link", () => {
  const result = normalizeFacebookPostUrl("https://m.facebook.com/story.php?story_fbid=pfbid0sr2L6LPzrCCwPziPgT98K6Ng7kAynUNbYGADpkTHrkFbaNfJxzHmjLCRfLEAnQx9l&id=100063998893885");
  assert.deepEqual(result, { value: "https://m.facebook.com/story.php?story_fbid=pfbid0sr2L6LPzrCCwPziPgT98K6Ng7kAynUNbYGADpkTHrkFbaNfJxzHmjLCRfLEAnQx9l&id=100063998893885" });
});

test("accepts a page post link", () => {
  const result = normalizeFacebookPostUrl("https://www.facebook.com/SomePage/posts/123456789/");
  assert.deepEqual(result, { value: "https://www.facebook.com/SomePage/posts/123456789" });
});

test("accepts a group post link", () => {
  const result = normalizeFacebookPostUrl("https://facebook.com/groups/987654/posts/123456/");
  assert.deepEqual(result, { value: "https://facebook.com/groups/987654/posts/123456" });
});

test("accepts a permalink link", () => {
  const result = normalizeFacebookPostUrl("https://facebook.com/permalink.php?story_fbid=1&id=2");
  assert.deepEqual(result, { value: "https://facebook.com/permalink.php?story_fbid=1&id=2" });
});

test("rejects an event link", () => {
  const result = normalizeFacebookPostUrl("https://facebook.com/events/123/");
  assert.deepEqual(result, { error: "URL must be a facebook.com post, permalink, or story link." });
});

test("rejects a non-facebook URL", () => {
  const result = normalizeFacebookPostUrl("https://example.com/posts/1");
  assert.deepEqual(result, { error: "URL must be a facebook.com post, permalink, or story link." });
});

test("rejects an invalid URL", () => {
  assert.deepEqual(normalizeFacebookPostUrl("not a url"), { error: "Invalid URL." });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test lib/admin/ingest/normalizeFacebookPostUrl.test.mjs`
Expected: FAIL — `Cannot find module './normalizeFacebookPostUrl.mjs'`

- [ ] **Step 3: Write the implementation**

```js
const POST_PATH_PATTERNS = [/\/story\.php/i, /\/permalink\.php/i, /\/posts\//i, /\/groups\/[^/]+\/posts\//i];

export function normalizeFacebookPostUrl(input) {
  const trimmed = String(input ?? "").trim();

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { error: "Invalid URL." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { error: "URL must start with http or https." };
  }

  const host = parsed.hostname.toLowerCase();
  if (host !== "facebook.com" && !host.endsWith(".facebook.com")) {
    return { error: "URL must be a facebook.com post, permalink, or story link." };
  }

  const path = parsed.pathname.toLowerCase();
  if (!POST_PATH_PATTERNS.some((re) => re.test(path))) {
    return { error: "URL must be a facebook.com post, permalink, or story link." };
  }

  parsed.protocol = "https:";
  parsed.hash = "";
  parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";

  return { value: parsed.toString() };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test lib/admin/ingest/normalizeFacebookPostUrl.test.mjs`
Expected: all 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/admin/ingest/normalizeFacebookPostUrl.mjs lib/admin/ingest/normalizeFacebookPostUrl.test.mjs
git commit -m "feat(poster): add URL normalizer for Facebook post/permalink/story links"
```

---

## Task 3: URL-based dedupe key for poster_ingest_jobs

**Files:**
- Modify: `lib/telegram/posterBot.mjs`
- Modify: `lib/telegram/posterBot.test.mjs`

- [ ] **Step 1: Write the failing test**

Add to `lib/telegram/posterBot.test.mjs` (after the existing `buildPosterDedupeKey` test):

```js
import { buildPosterUrlDedupeKey } from "./posterBot.mjs";

test("buildPosterUrlDedupeKey is stable, 32 hex chars, and differs from the photo dedupe key for the same chat", () => {
  const k1 = buildPosterUrlDedupeKey(10, "https://facebook.com/SomePage/posts/1");
  const k2 = buildPosterUrlDedupeKey(10, "https://facebook.com/SomePage/posts/1");
  assert.equal(k1, k2);
  assert.match(k1, /^[0-9a-f]{32}$/);
  assert.notEqual(k1, buildPosterDedupeKey(10, "https://facebook.com/SomePage/posts/1"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test lib/telegram/posterBot.test.mjs`
Expected: FAIL — `buildPosterUrlDedupeKey is not a function`

- [ ] **Step 3: Add the implementation**

In `lib/telegram/posterBot.mjs`, immediately after `buildPosterDedupeKey`:

```js
export function buildPosterUrlDedupeKey(chatId, normalizedUrl) {
  const raw = `${chatId}::url::${String(normalizedUrl).trim()}`;
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test lib/telegram/posterBot.test.mjs`
Expected: all tests PASS (including the new one)

- [ ] **Step 5: Commit**

```bash
git add lib/telegram/posterBot.mjs lib/telegram/posterBot.test.mjs
git commit -m "feat(poster): add URL-based dedupe key for link-submitted poster jobs"
```

---

## Task 4: Extract shared Telegram-send + result-apply helpers (no behavior change)

The webhook route (`app/api/telegram/poster-bot/route.ts`) currently has a
private `tg()` sender and a private `applyResult()` function. The new job
endpoint (Task 11) needs both, so extract them into shared modules first —
this is a pure refactor, verified by the fact that the webhook route keeps
working identically.

**Files:**
- Create: `lib/telegram/sendPosterBotMessage.ts`
- Create: `lib/admin/poster/applyProcessResult.ts`
- Modify: `app/api/telegram/poster-bot/route.ts`

- [ ] **Step 1: Create the sender module**

```typescript
import "server-only";

const TG = (m: string) => `https://api.telegram.org/bot${process.env.TELEGRAM_POSTER_BOT_TOKEN}/${m}`;

/** Best-effort Telegram Bot API call for the poster bot; never throws. */
export async function sendPosterBotMessage(method: string, payload: unknown): Promise<void> {
  try {
    await fetch(TG(method), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // best-effort; never fail the caller on delivery errors
  }
}
```

- [ ] **Step 2: Create the result-apply module**

Move the existing `applyResult` function (currently the last function in
`app/api/telegram/poster-bot/route.ts`) into this new file verbatim, renamed
and with its `tg` parameter typed against the new sender's signature:

```typescript
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatInserted, formatDuplicate, dupKeyboard } from "@/lib/telegram/posterBot.mjs";
import type { ProcessResult } from "@/lib/admin/poster/processPosterJob";

export async function applyPosterProcessResult(
  supabase: SupabaseClient,
  tg: (method: string, payload: unknown) => Promise<void>,
  baseUrl: string,
  chatId: number,
  jobId: string | null,
  result: ProcessResult,
) {
  const now = new Date().toISOString();
  if (result.kind === "inserted") {
    if (jobId) {
      await supabase
        .from("poster_ingest_jobs")
        .update({ status: "done", pending_festival_id: result.pendingId, updated_at: now })
        .eq("id", jobId);
    }
    await tg("sendMessage", {
      chat_id: chatId,
      text: formatInserted({ pendingId: result.pendingId, title: result.title, needsReview: result.needsReview, baseUrl }),
      disable_web_page_preview: true,
    });
    return;
  }
  if (result.kind === "duplicate") {
    if (jobId) {
      await supabase
        .from("poster_ingest_jobs")
        .update({
          status: "awaiting_dup_confirm",
          dup_matches: result.matches,
          extraction_json: { extraction: result.extraction, heroUrl: result.heroUrl },
          updated_at: now,
        })
        .eq("id", jobId);
    }
    await tg("sendMessage", {
      chat_id: chatId,
      text: formatDuplicate(result.matches, baseUrl),
      reply_markup: jobId ? dupKeyboard(jobId, "0") : undefined,
    });
    return;
  }
  // error
  if (jobId) {
    await supabase.from("poster_ingest_jobs").update({ status: "error", error: result.message, updated_at: now }).eq("id", jobId);
  }
  await tg("sendMessage", { chat_id: chatId, text: `❌ Грешка при обработка: ${result.message}` });
}
```

- [ ] **Step 3: Update the webhook route to use the extracted modules**

In `app/api/telegram/poster-bot/route.ts`:

1. Delete the local `TG`, `tg`, and `applyResult` definitions.
2. Add imports:

```typescript
import { sendPosterBotMessage as tg } from "@/lib/telegram/sendPosterBotMessage";
import { applyPosterProcessResult as applyResult } from "@/lib/admin/poster/applyProcessResult";
```

Every existing call site (`tg("sendMessage", ...)`, `applyResult(supabase, tg, baseUrl, ...)`) stays textually identical — only the import changes.

- [ ] **Step 4: Verify no behavior change**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `node --test lib/telegram/posterBot.test.mjs`
Expected: all tests still PASS (this file doesn't import from route.ts, so this just confirms nothing else broke).

- [ ] **Step 5: Commit**

```bash
git add lib/telegram/sendPosterBotMessage.ts lib/admin/poster/applyProcessResult.ts app/api/telegram/poster-bot/route.ts
git commit -m "refactor(poster): extract Telegram sender + result-apply helpers for reuse"
```

---

## Task 5: Extract poster-job idempotency check (refactor + reuse)

The webhook route's photo branch has inline logic to look up an existing
`poster_ingest_jobs` row by `dedupe_key` and decide whether it's still
processing, already done, or safe to proceed (including treating a
`processing` row older than 6 minutes as dead — added in an earlier session
to fix jobs getting stuck forever). The new link-based flow (Task 6) needs
the exact same decision logic, so extract it now.

**Files:**
- Create: `lib/admin/poster/posterJobIdempotency.ts`
- Test: `lib/admin/poster/posterJobIdempotency.test.ts`
- Modify: `app/api/telegram/poster-bot/route.ts`

- [ ] **Step 1: Write the failing test (using a fake Supabase client)**

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkExistingPosterJob } from "./posterJobIdempotency";

function fakeSupabase(rows: { poster_ingest_jobs?: unknown; pending_festivals?: unknown }) {
  return {
    from(table: string) {
      const row = table === "poster_ingest_jobs" ? rows.poster_ingest_jobs : rows.pending_festivals;
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        maybeSingle: async () => ({ data: row ?? null }),
      };
    },
  } as never;
}

test("no existing row -> proceed", async () => {
  const result = await checkExistingPosterJob(fakeSupabase({}), "key1");
  assert.deepEqual(result, { existingId: null, decision: { action: "proceed" } });
});

test("recent processing row -> still_processing", async () => {
  const result = await checkExistingPosterJob(
    fakeSupabase({ poster_ingest_jobs: { id: "j1", status: "processing", pending_festival_id: null, updated_at: new Date().toISOString() } }),
    "key1",
  );
  assert.equal(result.existingId, "j1");
  assert.deepEqual(result.decision, { action: "still_processing" });
});

test("stale processing row (>6 min old) -> proceed", async () => {
  const staleIso = new Date(Date.now() - 7 * 60 * 1000).toISOString();
  const result = await checkExistingPosterJob(
    fakeSupabase({ poster_ingest_jobs: { id: "j1", status: "processing", pending_festival_id: null, updated_at: staleIso } }),
    "key1",
  );
  assert.deepEqual(result.decision, { action: "proceed" });
});

test("done row with accepted pending festival -> already_done, not rejected", async () => {
  const result = await checkExistingPosterJob(
    fakeSupabase({
      poster_ingest_jobs: { id: "j1", status: "done", pending_festival_id: "p1", updated_at: new Date().toISOString() },
      pending_festivals: { status: "needs_review" },
    }),
    "key1",
  );
  assert.deepEqual(result, { existingId: "j1", decision: { action: "already_done", pendingId: "p1", rejected: false } });
});

test("done row with rejected pending festival -> already_done, rejected", async () => {
  const result = await checkExistingPosterJob(
    fakeSupabase({
      poster_ingest_jobs: { id: "j1", status: "done", pending_festival_id: "p1", updated_at: new Date().toISOString() },
      pending_festivals: { status: "rejected" },
    }),
    "key1",
  );
  assert.deepEqual(result, { existingId: "j1", decision: { action: "already_done", pendingId: "p1", rejected: true } });
});

test("any other status (e.g. error, cancelled) -> proceed", async () => {
  const result = await checkExistingPosterJob(
    fakeSupabase({ poster_ingest_jobs: { id: "j1", status: "error", pending_festival_id: null, updated_at: new Date().toISOString() } }),
    "key1",
  );
  assert.deepEqual(result, { existingId: "j1", decision: { action: "proceed" } });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test lib/admin/poster/posterJobIdempotency.test.ts`
Expected: FAIL — `Cannot find module './posterJobIdempotency'`

- [ ] **Step 3: Write the implementation**

```typescript
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ExistingJobDecision =
  | { action: "still_processing" }
  | { action: "already_done"; pendingId: string | null; rejected: boolean }
  | { action: "proceed" };

export type ExistingJobCheck = { existingId: string | null; decision: ExistingJobDecision };

// Longer than maxDuration=300s on the webhook/job routes — a "processing"
// row past this is a dead invocation (crash/timeout), not a live one.
const STALE_PROCESSING_MS = 6 * 60 * 1000;

/** Looks up a poster_ingest_jobs row by dedupe_key and decides what the caller should do. */
export async function checkExistingPosterJob(supabase: SupabaseClient, dedupeKey: string): Promise<ExistingJobCheck> {
  const { data: existing } = await supabase
    .from("poster_ingest_jobs")
    .select("id,status,pending_festival_id,updated_at")
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();

  if (!existing) return { existingId: null, decision: { action: "proceed" } };

  const existingId = String(existing.id);
  const isStale = existing.updated_at ? Date.now() - new Date(existing.updated_at).getTime() > STALE_PROCESSING_MS : true;

  if (existing.status === "processing" && !isStale) {
    return { existingId, decision: { action: "still_processing" } };
  }

  if (existing.status === "done") {
    let rejected = false;
    if (existing.pending_festival_id) {
      const { data: pf } = await supabase
        .from("pending_festivals")
        .select("status")
        .eq("id", existing.pending_festival_id)
        .maybeSingle();
      rejected = pf?.status === "rejected";
    }
    return { existingId, decision: { action: "already_done", pendingId: existing.pending_festival_id ?? null, rejected } };
  }

  return { existingId, decision: { action: "proceed" } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test lib/admin/poster/posterJobIdempotency.test.ts`
Expected: all 6 tests PASS

- [ ] **Step 5: Refactor the webhook route's photo branch to use it**

In `app/api/telegram/poster-bot/route.ts`, replace this block:

```typescript
  if (action.kind === "photo") {
    const dedupe_key = buildPosterDedupeKey(action.chatId, action.fileUniqueId);

    // Idempotency: skip if this exact poster was already processed to a result.
    const { data: existing } = await supabase
      .from("poster_ingest_jobs")
      .select("id,status,pending_festival_id,updated_at")
      .eq("dedupe_key", dedupe_key)
      .maybeSingle();
    const STALE_PROCESSING_MS = 6 * 60 * 1000; // longer than maxDuration=300s — a still-"processing" row past this is a dead invocation, not a live one
    const isStale = existing?.updated_at ? Date.now() - new Date(existing.updated_at).getTime() > STALE_PROCESSING_MS : true;
    if (existing?.status === "processing" && !isStale) {
      await tg("sendMessage", { chat_id: action.chatId, text: "⏳ Плакатът се обработва в момента — изчакай малко." });
      return NextResponse.json({ ok: true });
    }
    if (existing?.status === "done") {
      let isRejected = false;
      if (existing.pending_festival_id) {
        const { data: pf } = await supabase
          .from("pending_festivals")
          .select("status")
          .eq("id", existing.pending_festival_id)
          .maybeSingle();
        isRejected = pf?.status === "rejected";
      }
      const text = isRejected
        ? formatRejected({ pendingId: existing.pending_festival_id ?? null, baseUrl })
        : formatAlreadyDone({ pendingId: existing.pending_festival_id ?? null, baseUrl });
      await tg("sendMessage", {
        chat_id: action.chatId,
        text,
        reply_markup: reprocessKeyboard(String(existing.id)),
        disable_web_page_preview: true,
      });
      return NextResponse.json({ ok: true });
    }
```

with:

```typescript
  if (action.kind === "photo") {
    const dedupe_key = buildPosterDedupeKey(action.chatId, action.fileUniqueId);

    // Idempotency: skip if this exact poster was already processed to a result.
    const { existingId, decision } = await checkExistingPosterJob(supabase, dedupe_key);
    if (decision.action === "still_processing") {
      await tg("sendMessage", { chat_id: action.chatId, text: "⏳ Плакатът се обработва в момента — изчакай малко." });
      return NextResponse.json({ ok: true });
    }
    if (decision.action === "already_done") {
      const text = decision.rejected
        ? formatRejected({ pendingId: decision.pendingId, baseUrl })
        : formatAlreadyDone({ pendingId: decision.pendingId, baseUrl });
      await tg("sendMessage", {
        chat_id: action.chatId,
        text,
        reply_markup: reprocessKeyboard(String(existingId)),
        disable_web_page_preview: true,
      });
      return NextResponse.json({ ok: true });
    }
```

Add the import:

```typescript
import { checkExistingPosterJob } from "@/lib/admin/poster/posterJobIdempotency";
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add lib/admin/poster/posterJobIdempotency.ts lib/admin/poster/posterJobIdempotency.test.ts app/api/telegram/poster-bot/route.ts
git commit -m "refactor(poster): extract poster-job idempotency check for reuse by the link flow"
```

---

## Task 6: Enqueue helper for Facebook post links

**Files:**
- Create: `lib/admin/ingest/enqueueFacebookPostScrape.ts`
- Test: `lib/admin/ingest/enqueueFacebookPostScrape.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { enqueueFacebookPostScrape } from "./enqueueFacebookPostScrape";

function fakeSupabase(opts: { existingPosterJob?: unknown; insertIngestJobError?: { code?: string; message: string } }) {
  return {
    from(table: string) {
      if (table === "poster_ingest_jobs") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle: async () => ({ data: opts.existingPosterJob ?? null }),
          upsert() {
            return this;
          },
          single: async () => ({ data: { id: "job-1" } }),
        };
      }
      if (table === "ingest_jobs") {
        return {
          insert: async () => ({ error: opts.insertIngestJobError ?? null }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as never;
}

test("rejects a non-post URL", async () => {
  const result = await enqueueFacebookPostScrape(fakeSupabase({}), "https://facebook.com/events/1/", {
    telegramChatId: 10,
    telegramUserId: 20,
  });
  assert.deepEqual(result, { ok: false, kind: "error", error: "URL must be a facebook.com post, permalink, or story link.", status: 400 });
});

test("queues a new post link", async () => {
  const result = await enqueueFacebookPostScrape(fakeSupabase({}), "https://facebook.com/SomePage/posts/1", {
    telegramChatId: 10,
    telegramUserId: 20,
  });
  assert.deepEqual(result, { ok: true, kind: "queued" });
});

test("a still-processing duplicate submission reports already_queued", async () => {
  const result = await enqueueFacebookPostScrape(
    fakeSupabase({ existingPosterJob: { id: "j1", status: "processing", pending_festival_id: null, updated_at: new Date().toISOString() } }),
    "https://facebook.com/SomePage/posts/1",
    { telegramChatId: 10, telegramUserId: 20 },
  );
  assert.deepEqual(result, { ok: true, kind: "already_queued" });
});

test("a done duplicate submission reports duplicate_warning with a link", async () => {
  const result = await enqueueFacebookPostScrape(
    fakeSupabase({ existingPosterJob: { id: "j1", status: "done", pending_festival_id: "p1", updated_at: new Date().toISOString() } }),
    "https://facebook.com/SomePage/posts/1",
    { telegramChatId: 10, telegramUserId: 20 },
  );
  assert.deepEqual(result, { ok: true, kind: "duplicate_warning", jobId: "j1", status: "done", existing: { type: "pending", id: "p1" } });
});

test("a unique-constraint clash on ingest_jobs.source_url reports already_queued", async () => {
  const result = await enqueueFacebookPostScrape(
    fakeSupabase({ insertIngestJobError: { code: "23505", message: "duplicate key" } }),
    "https://facebook.com/SomePage/posts/1",
    { telegramChatId: 10, telegramUserId: 20 },
  );
  assert.deepEqual(result, { ok: true, kind: "already_queued" });
});
```

Note: the `pending_festivals` lookup inside `checkExistingPosterJob` is only
reached when `existing.pending_festival_id` is set; the fourth test above
relies on that early-return path in `fakeSupabase` not being hit for the
`pending_festivals` table (it isn't, since `fakeSupabase` doesn't define a
branch for it and the "done" test case sets `pending_festival_id: "p1"` —
add a `pending_festivals` branch to `fakeSupabase` returning
`{ data: { status: "needs_review" } }` so that test doesn't throw):

```typescript
      if (table === "pending_festivals") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle: async () => ({ data: { status: "needs_review" } }),
        };
      }
```

Add this branch into `fakeSupabase` alongside the other two.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test lib/admin/ingest/enqueueFacebookPostScrape.test.ts`
Expected: FAIL — `Cannot find module './enqueueFacebookPostScrape'`

- [ ] **Step 3: Write the implementation**

```typescript
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeFacebookPostUrl } from "@/lib/admin/ingest/normalizeFacebookPostUrl.mjs";
import { buildPosterUrlDedupeKey } from "@/lib/telegram/posterBot.mjs";
import { checkExistingPosterJob } from "@/lib/admin/poster/posterJobIdempotency";
import type { EnqueueFacebookEventResult } from "@/lib/admin/ingest/enqueueFacebookEventIngest";

/**
 * Normalizes a Facebook post/permalink/story URL, checks for an in-flight or
 * already-resolved submission via poster_ingest_jobs, and — if new — writes
 * both a poster_ingest_jobs row (UX/state) and an ingest_jobs row for
 * festivo-workers to scrape.
 */
export async function enqueueFacebookPostScrape(
  supabase: SupabaseClient,
  rawUrl: string,
  opts: { telegramChatId: number; telegramUserId: number },
): Promise<EnqueueFacebookEventResult> {
  const normalized = normalizeFacebookPostUrl(rawUrl);
  if ("error" in normalized) {
    return { ok: false, kind: "error", error: normalized.error, status: 400 };
  }
  const sourceUrl = normalized.value;
  const dedupeKey = buildPosterUrlDedupeKey(opts.telegramChatId, sourceUrl);

  const { existingId, decision } = await checkExistingPosterJob(supabase, dedupeKey);
  if (decision.action === "still_processing") {
    return { ok: true, kind: "already_queued" };
  }
  if (decision.action === "already_done") {
    if (!decision.pendingId || !existingId) return { ok: true, kind: "already_queued" };
    // poster_ingest_jobs.pending_festival_id only ever points at pending_festivals
    // (set by applyPosterProcessResult's "inserted" branch via insertPosterRow).
    return {
      ok: true,
      kind: "duplicate_warning",
      jobId: existingId,
      status: "done",
      existing: { type: "pending", id: decision.pendingId },
    };
  }

  const { data: job, error: upsertErr } = await supabase
    .from("poster_ingest_jobs")
    .upsert(
      {
        telegram_chat_id: opts.telegramChatId,
        telegram_user_id: opts.telegramUserId,
        status: "queued_scrape",
        dedupe_key: dedupeKey,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "dedupe_key" },
    )
    .select("id")
    .single();

  if (upsertErr || !job?.id) {
    return { ok: false, kind: "error", error: upsertErr?.message ?? "poster_ingest_jobs upsert failed", status: 500 };
  }
  const posterIngestJobId = String(job.id);

  const { error: ingestErr } = await supabase.from("ingest_jobs").insert({
    source_url: sourceUrl,
    source_type: "facebook_post",
    job_type: "scrape_facebook_post",
    status: "queued",
    payload_json: {
      poster_ingest_job_id: posterIngestJobId,
      telegram_chat_id: opts.telegramChatId,
      telegram_user_id: opts.telegramUserId,
      submission_source: "telegram",
    },
  });

  if (ingestErr) {
    if (ingestErr.code === "23505") {
      return { ok: true, kind: "already_queued" };
    }
    return { ok: false, kind: "error", error: ingestErr.message, status: 500 };
  }

  return { ok: true, kind: "queued" };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test lib/admin/ingest/enqueueFacebookPostScrape.test.ts`
Expected: all 5 tests PASS

- [ ] **Step 5: Run the full TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/admin/ingest/enqueueFacebookPostScrape.ts lib/admin/ingest/enqueueFacebookPostScrape.test.ts
git commit -m "feat(poster): add enqueue helper for Facebook post/permalink/story links"
```

---

## Task 7: Wire the webhook's URL branch to classify event vs. post links

**Files:**
- Modify: `app/api/telegram/poster-bot/route.ts`
- Modify: `lib/telegram/posterBot.mjs` (one-line wording fix)

- [ ] **Step 1: Update the fallback error wording**

In `lib/telegram/posterBot.mjs`, inside `formatUrlResultLine`, change:

```js
  return `❌ ${short} → ${result?.error || "не е валиден Facebook event линк"}`;
```

to:

```js
  return `❌ ${short} → ${result?.error || "не е валиден Facebook event/пост линк"}`;
```

- [ ] **Step 2: Replace the URL-handling block in the webhook route**

In `app/api/telegram/poster-bot/route.ts`, replace:

```typescript
  if (action.kind === "url") {
    const urls = "urls" in action && Array.isArray(action.urls) && action.urls.length > 0 ? action.urls : [action.url];
    const lines: string[] = [];
    let anyQueued = false;

    for (const url of urls) {
      const result = await enqueueFacebookEventIngest(supabase, url, "telegram", { telegramUserId: action.userId });
      lines.push(formatUrlResultLine(url, result, baseUrl));
      if (result.ok && (result.kind === "queued" || result.kind === "duplicate_warning")) {
        anyQueued = true;
      }
    }

    if (anyQueued) lines.push("\n⏳ Работниците ще обработят линка скоро.");
    await tg("sendMessage", { chat_id: action.chatId, text: lines.join("\n") });
    return NextResponse.json({ ok: true });
  }
```

with:

```typescript
  if (action.kind === "url") {
    const urls = "urls" in action && Array.isArray(action.urls) && action.urls.length > 0 ? action.urls : [action.url];
    const lines: string[] = [];
    let anyQueued = false;

    for (const url of urls) {
      const isEvent = !("error" in normalizeFacebookEventUrl(url));
      const result = isEvent
        ? await enqueueFacebookEventIngest(supabase, url, "telegram", { telegramUserId: action.userId })
        : await enqueueFacebookPostScrape(supabase, url, { telegramChatId: action.chatId, telegramUserId: action.userId });
      lines.push(formatUrlResultLine(url, result, baseUrl));
      if (result.ok && (result.kind === "queued" || result.kind === "duplicate_warning")) {
        anyQueued = true;
      }
    }

    if (anyQueued) lines.push("\n⏳ Работниците ще обработят линка скоро.");
    await tg("sendMessage", { chat_id: action.chatId, text: lines.join("\n") });
    return NextResponse.json({ ok: true });
  }
```

Note `enqueueFacebookPostScrape` already calls `normalizeFacebookPostUrl`
internally and returns a proper `error` result for anything that's neither
an event nor a post link — so no separate "invalid" branch is needed here.

- [ ] **Step 3: Add the imports**

```typescript
import { normalizeFacebookEventUrl } from "@/lib/admin/ingest/normalizeFacebookEventUrl.mjs";
import { enqueueFacebookPostScrape } from "@/lib/admin/ingest/enqueueFacebookPostScrape";
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `node --test lib/telegram/posterBot.test.mjs`
Expected: all tests PASS.

- [ ] **Step 5: Manual verification**

Run the dev server (`npm run dev`) and use `curl` to simulate a Telegram
update hitting the webhook with a post-shaped URL (replace the secret with
the local `.env.local` value of `TELEGRAM_POSTER_WEBHOOK_SECRET`, and the
`telegram_user_id` with a row that exists in `social_repost_allowed_users`):

```bash
curl -s -X POST http://localhost:3000/api/telegram/poster-bot \
  -H "Content-Type: application/json" \
  -H "x-telegram-bot-api-secret-token: <TELEGRAM_POSTER_WEBHOOK_SECRET>" \
  -d '{"message":{"chat":{"id":1825820545},"from":{"id":1825820545},"text":"https://www.facebook.com/SomePage/posts/123456789/"}}'
```

Expected: `{"ok":true}` response, and a Telegram message "✅ ... → добавено
в опашката" sent to the chat. Check `ingest_jobs` for a new row with
`source_type='facebook_post'`, `job_type='scrape_facebook_post'`, and
`poster_ingest_jobs` for a new row with `status='queued_scrape'`.

- [ ] **Step 6: Commit**

```bash
git add app/api/telegram/poster-bot/route.ts lib/telegram/posterBot.mjs
git commit -m "feat(poster): route Facebook post/permalink/story links to the scrape queue"
```

---

## Task 8: Allow a null hero image through the poster pending-row builder

Text-only Facebook posts may have no image at all. `buildPosterPendingRow`
currently requires a `string` hero URL; widen it to `string | null` end to
end. (Verified earlier: `buildResearchPendingRowFromRequest` already
handles `hero_image: null` — see `resolveHeroImageFieldForInsert`.)

**Files:**
- Modify: `lib/admin/poster/posterPendingRowBuilder.ts`
- Modify: `lib/admin/poster/processPosterJob.ts`
- Modify: `app/api/telegram/poster-bot/route.ts`

- [ ] **Step 1: Widen `buildPosterPendingRow`'s parameter type**

In `lib/admin/poster/posterPendingRowBuilder.ts`, change the signature:

```typescript
export async function buildPosterPendingRow(
  ext: PosterExtraction,
  heroPublicUrl: string,
  now: Date = new Date(),
): Promise<BuildPosterRowResult> {
```

to:

```typescript
export async function buildPosterPendingRow(
  ext: PosterExtraction,
  heroPublicUrl: string | null,
  now: Date = new Date(),
): Promise<BuildPosterRowResult> {
```

- [ ] **Step 2: Widen `ProcessResult`'s duplicate variant and `insertFromStoredExtraction`**

In `lib/admin/poster/processPosterJob.ts`, change:

```typescript
export type ProcessResult =
  | { kind: "inserted"; pendingId: string; title: string; needsReview: boolean }
  | { kind: "duplicate"; matches: DuplicateMatch[]; extraction: PosterExtraction; heroUrl: string; title: string }
  | { kind: "error"; message: string };
```

to:

```typescript
export type ProcessResult =
  | { kind: "inserted"; pendingId: string; title: string; needsReview: boolean }
  | { kind: "duplicate"; matches: DuplicateMatch[]; extraction: PosterExtraction; heroUrl: string | null; title: string }
  | { kind: "error"; message: string };
```

and change `insertFromStoredExtraction`'s signature:

```typescript
export async function insertFromStoredExtraction(
  supabase: SupabaseClient,
  extraction: PosterExtraction,
  heroUrl: string,
): Promise<ProcessResult> {
```

to:

```typescript
export async function insertFromStoredExtraction(
  supabase: SupabaseClient,
  extraction: PosterExtraction,
  heroUrl: string | null,
): Promise<ProcessResult> {
```

- [ ] **Step 3: Relax the webhook route's "create anyway" guard**

In `app/api/telegram/poster-bot/route.ts`, find:

```typescript
    // create anyway, from the stored extraction
    const stored = job.extraction_json as { extraction?: unknown; heroUrl?: string } | null;
    if (!stored?.extraction || !stored.heroUrl) {
      await tg("sendMessage", { chat_id: action.chatId, text: "❌ Липсват запазени данни за повторно създаване." });
      return NextResponse.json({ ok: true });
    }
```

and change it to:

```typescript
    // create anyway, from the stored extraction
    const stored = job.extraction_json as { extraction?: unknown; heroUrl?: string | null } | null;
    if (!stored?.extraction) {
      await tg("sendMessage", { chat_id: action.chatId, text: "❌ Липсват запазени данни за повторно създаване." });
      return NextResponse.json({ ok: true });
    }
```

(the `insertFromStoredExtraction` call two lines below already passes
`stored.heroUrl` through unchanged, which now type-checks as `string | null`)

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/poster/posterPendingRowBuilder.ts lib/admin/poster/processPosterJob.ts app/api/telegram/poster-bot/route.ts
git commit -m "fix(poster): allow a null hero image for text-only Facebook post submissions"
```

---

## Task 9: System prompt for Facebook-post extraction

**Files:**
- Create: `lib/admin/poster/facebookPostSystemPrompt.ts`

- [ ] **Step 1: Write the implementation**

```typescript
export const DEFAULT_FACEBOOK_POST_CATEGORIES = [
  "фолклорен фестивал",
  "събор",
  "кулинарен фестивал",
  "музикален фестивал",
  "танцов фестивал",
  "културен фестивал",
  "арт фестивал",
];

export function buildFacebookPostSystemPrompt(categories: string[] = DEFAULT_FACEBOOK_POST_CATEGORIES): string {
  const catLines = (categories.length ? categories : DEFAULT_FACEBOOK_POST_CATEGORIES).map((c) => `  "${c}"`).join("\n");
  return `Ти извличаш структурирани данни за български фестивал от ТЕКСТА на този Facebook пост (и от приложена снимка, ако има такава).
Връщай само валиден JSON по подадената схема. Без преамбюл, без обяснения, без markdown.

ОБЩИ ПРАВИЛА
- Използвай само информация от текста на поста (и снимката, ако има). Каквото не е споменато → null. Не измисляй.
- За всяко "soft" поле задай confidence (0..1) и needs_review=true, ако си несигурен (confidence < 0.6) или стойността е изведена, а не директно изписана.
- Часове само като "HH:mm" (24ч), само ако са изрично споменати; иначе null. НЕ измисляй часове.
- Кратко описание на български (до 4 изречения), само от текста на поста.

ЗАГЛАВИЕ (title)
- title = пълното официално име на фестивала, както е спомената в поста.
- НЕ включвай: "ПОКАНА", "Второ издание"/"N-то издание", пореден номер, "юбилейно", "международен" ако не е част от името.
- Ако постът смесва ПОВОД ("по случай празника на …") и КОНКРЕТНО СЪБИТИЕ ("Концерт на самодейците"):
  * primary title = по-общото име на празника/фестивала;
  * сложи и двата варианта в title_candidates[];
  * вдигни needs_review=true за title.

ДАТИ (start_date, end_date) — връщай КОМПОНЕНТИ, не ISO низ
- За всяка дата върни { day, month, year, year_explicit, weekday }.
- year: попълни само ако годината е ИЗПИСАНА в текста; тогава year_explicit=true. Ако липсва → year=null, year_explicit=false (кодът ще я изведе).
- weekday: ако до датата има изписан ден от седмицата ("събота", "(петък)"), върни го — служи за проверка.
- Едноднев фестивал → start_date и end_date с еднакви day/month.
- Диапазон "25.06.26 – 28.06.26" → start_date=25.06, end_date=28.06; year=2026 (двуцифрена "26" → 2026).
- КАПАН: година вътре в име ("СЕЛО С ИСТОРИЯ – 1570 г.") е историческа, НЕ е дата на събитие. Игнорирай я за датите.
- КАПАН: "Срок за записване", "краен срок", deadline НЕ са дата на събитието. Сложи ги в other_dates[] с label, никога в start_date/end_date.

ЧАСОВЕ (start_time, end_time)
- Само ако са изрично споменати (напр. "16.00 ч." → "16:00"). Иначе null + needs_review.

ЛОКАЦИЯ (city, venue_name, address)
- city = населеното място на ФЕСТИВАЛА.
- КАПАН: споменати "родни места" на изпълнители/гости НЕ са локацията на фестивала.
- venue_name = конкретното място, ако е дадено.
- address = пълната селищна/адресна линия, ако е спомената — нужно е за геокодиране.

ОРГАНИЗАТОР (organizer_name, organizer_names)
- Попълни само ясно посочен организатор/домакин.
- КАПАН: изпълняващи групи/състави в програмата НЕ са организатори.
- КАПАН: контактно лице ("Председател: …", "За информация: …") НЕ е организатор — то отива в contact.person.
- Ако организаторът не е ясен → null + needs_review.

КОНТАКТ (contact)
- contact.phone = телефон, ако е споменат в поста; contact.person = контактно лице. null ако липсват.

ВХОД/ЦЕНИ (is_free, price_range)
- is_free=true само при изричен "ВХОД СВОБОДЕН"/"вход свободен"/"безплатно".
- Ако има платени точки → is_free=false и price_range със стойността + валута.
- Ако нищо не е казано → is_free=null + needs_review.

ПРОГРАМА (program)
- Попълни program САМО ако постът съдържа ТАЙМИРАНА програма (часове + точки/изпълнители).
- Ако няма таймирана програма → program=null.

КАТЕГОРИЯ (category)
- Избери ТОЧНО една (lowercase) от:
${catLines}
- Ако съчетава типове, избери доминиращия. Несигурен → best guess + needs_review.

ТАГОВЕ (tags)
- 4–12 тага на български, малки букви: тип, жанр/стил, дейности/тема, характеристика, локация (града).
- Без години, без "бг", без "събитие".`;
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors. (No test file — `posterSystemPrompt.ts`, the sibling this mirrors, has none either; it's a static string template.)

- [ ] **Step 3: Commit**

```bash
git add lib/admin/poster/facebookPostSystemPrompt.ts
git commit -m "feat(poster): add Gemini system prompt for Facebook-post extraction"
```

---

## Task 10: Gemini extractor for Facebook post text + optional image

**Files:**
- Create: `lib/admin/poster/extractFestivalFromFacebookPost.ts`
- Test: `lib/admin/poster/extractFestivalFromFacebookPost.test.ts`

- [ ] **Step 1: Write the failing test (injecting a fake extractor)**

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractFestivalFromFacebookPost } from "./extractFestivalFromFacebookPost";
import type { PosterExtraction } from "./posterExtractionSchema";

function blankExtraction(title: string): PosterExtraction {
  const conf = (v: unknown) => ({ value: v, confidence: 0.9, needs_review: false });
  return {
    title: conf(title),
    title_candidates: [],
    category: conf(null),
    start_date: { day: null, month: null, year: null, year_explicit: false, weekday: null },
    end_date: { day: null, month: null, year: null, year_explicit: false, weekday: null },
    other_dates: [],
    start_time: conf(null),
    end_time: conf(null),
    city: conf(null),
    venue_name: conf(null),
    address: conf(null),
    organizer_name: conf(null),
    organizer_names: [],
    description: conf(null),
    is_free: conf(null),
    price_range: conf(null),
    website_url: conf(null),
    facebook_url: conf(null),
    instagram_url: conf(null),
    ticket_url: conf(null),
    contact: { phone: null, person: null },
    tags: [],
    program: null,
  } as unknown as PosterExtraction;
}

test("delegates to the injected extractor and returns its result", async () => {
  const fake = blankExtraction("Тестов фестивал");
  const result = await extractFestivalFromFacebookPost({
    text: "някакъв текст",
    image: null,
    extractor: async (input) => {
      assert.equal(input.text, "някакъв текст");
      assert.equal(input.image, null);
      return fake;
    },
  });
  assert.equal(result, fake);
});

test("defaults to the Gemini extractor when none is injected", async () => {
  assert.equal(typeof (await import("./extractFestivalFromFacebookPost")).geminiFacebookPostExtractor, "function");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test lib/admin/poster/extractFestivalFromFacebookPost.test.ts`
Expected: FAIL — `Cannot find module './extractFestivalFromFacebookPost'`

- [ ] **Step 3: Write the implementation**

```typescript
import "server-only";
import { geminiExtractJsonWithImages } from "@/lib/admin/research/gemini-provider";
import { buildFacebookPostSystemPrompt } from "@/lib/admin/poster/facebookPostSystemPrompt";
import { posterExtractionSchema, type PosterExtraction } from "@/lib/admin/poster/posterExtractionSchema";
import type { InlineImage } from "@/lib/admin/poster/posterImageToInline";

export type FacebookPostExtractor = (input: {
  text: string;
  image: InlineImage | null;
  categories?: string[];
}) => Promise<PosterExtraction>;

const USER_TEXT_PREFIX = 'Текст на Facebook поста (извлечи структурираните данни по схемата, само JSON):\n\n"""';
const USER_TEXT_SUFFIX = '"""';
const MAX_TEXT_LENGTH = 6000;

/** Default extractor: Gemini text+optional-image extraction + Zod validation. */
export const geminiFacebookPostExtractor: FacebookPostExtractor = async ({ text, image, categories }) => {
  const userText = `${USER_TEXT_PREFIX}${text.slice(0, MAX_TEXT_LENGTH)}${USER_TEXT_SUFFIX}`;

  const raw = await geminiExtractJsonWithImages<unknown>({
    systemInstruction: buildFacebookPostSystemPrompt(categories),
    userText,
    images: image ? [{ mimeType: image.mimeType, data: image.data }] : [],
  });

  const parsed = posterExtractionSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Facebook post extraction did not match schema: ${parsed.error.issues[0]?.message ?? "unknown"}`);
  }
  return parsed.data;
};

export async function extractFestivalFromFacebookPost(input: {
  text: string;
  image: InlineImage | null;
  categories?: string[];
  extractor?: FacebookPostExtractor;
}): Promise<PosterExtraction> {
  const run = input.extractor ?? geminiFacebookPostExtractor;
  return run(input);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test lib/admin/poster/extractFestivalFromFacebookPost.test.ts`
Expected: both tests PASS

- [ ] **Step 5: Verify the full TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/admin/poster/extractFestivalFromFacebookPost.ts lib/admin/poster/extractFestivalFromFacebookPost.test.ts
git commit -m "feat(poster): add Gemini extractor for Facebook post text + optional image"
```

---

## Task 11: Job endpoint that turns scraped post content into a pending festival

This is the integration point the (separately planned) `festivo-workers`
scraper will call. It can be fully exercised with `curl` before that worker
exists.

**Files:**
- Create: `app/api/jobs/facebook-post-extract/route.ts`

- [ ] **Step 1: Write the implementation**

```typescript
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isAuthorizedJobRequest } from "@/lib/jobs/auth";
import { sendPosterBotMessage } from "@/lib/telegram/sendPosterBotMessage";
import { applyPosterProcessResult } from "@/lib/admin/poster/applyProcessResult";
import { posterBufferToInline, type InlineImage } from "@/lib/admin/poster/posterImageToInline";
import { uploadPosterImage } from "@/lib/admin/poster/uploadPosterImage";
import { extractFestivalFromFacebookPost } from "@/lib/admin/poster/extractFestivalFromFacebookPost";
import { enrichPosterFromWeb } from "@/lib/admin/poster/enrichPosterFromWeb";
import { buildPosterPendingRow } from "@/lib/admin/poster/posterPendingRowBuilder";
import { findDuplicateFestivals } from "@/lib/admin/research/findDuplicateFestivals";
import { insertPosterRow } from "@/lib/admin/poster/processPosterJob";
import { getBaseUrl } from "@/lib/config/baseUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DUP_BLOCK_SCORE = 0.5;

type Body = {
  posterIngestJobId?: string;
  sourceUrl?: string;
  text?: string;
  imageUrls?: string[];
};

export async function POST(req: Request) {
  if (!isAuthorizedJobRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.posterIngestJobId || !body?.sourceUrl || typeof body.text !== "string") {
    return NextResponse.json({ error: "posterIngestJobId, sourceUrl and text are required" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const baseUrl = getBaseUrl();
  const jobId = body.posterIngestJobId;
  const imageUrls = Array.isArray(body.imageUrls) ? body.imageUrls : [];

  const { data: job } = await supabase
    .from("poster_ingest_jobs")
    .select("id,telegram_chat_id")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) {
    return NextResponse.json({ error: "poster_ingest_jobs row not found" }, { status: 404 });
  }
  const chatId = job.telegram_chat_id as number;

  await supabase.from("poster_ingest_jobs").update({ status: "processing", updated_at: new Date().toISOString() }).eq("id", jobId);

  try {
    let heroUrl: string | null = null;
    let inlineImage: InlineImage | null = null;

    if (imageUrls.length > 0) {
      await sendPosterBotMessage("sendMessage", { chat_id: chatId, text: "🖼 Качвам снимка от поста…" });
      const res = await fetch(imageUrls[0]);
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
        inlineImage = await posterBufferToInline(buffer);
        heroUrl = await uploadPosterImage(supabase, buffer, mimeType);
      }
    }

    await sendPosterBotMessage("sendMessage", { chat_id: chatId, text: "🔍 Анализирам поста (Gemini)…" });
    const rawExtraction = await extractFestivalFromFacebookPost({ text: body.text, image: inlineImage });

    await sendPosterBotMessage("sendMessage", { chat_id: chatId, text: "🌐 Търся допълнителна информация в интернет…" });
    const extraction = await enrichPosterFromWeb(rawExtraction, rawExtraction.title.value ?? "");

    await sendPosterBotMessage("sendMessage", { chat_id: chatId, text: "📍 Геокодиране и проверка за дублати…" });
    const built = await buildPosterPendingRow(extraction, heroUrl);
    if (!built.ok) {
      await applyPosterProcessResult(supabase, sendPosterBotMessage, baseUrl, chatId, jobId, { kind: "error", message: built.error });
      return NextResponse.json({ ok: true });
    }

    const matches = await findDuplicateFestivals({ title: built.title, startDate: built.startDate });
    const strong = matches.filter((m) => m.score >= DUP_BLOCK_SCORE && m.same_year);
    if (strong.length > 0) {
      await applyPosterProcessResult(supabase, sendPosterBotMessage, baseUrl, chatId, jobId, {
        kind: "duplicate",
        matches: strong,
        extraction,
        heroUrl,
        title: built.title,
      });
      return NextResponse.json({ ok: true });
    }

    await sendPosterBotMessage("sendMessage", { chat_id: chatId, text: "💾 Записвам чернова…" });
    const result = await insertPosterRow(supabase, built.row, built.title);
    await applyPosterProcessResult(supabase, sendPosterBotMessage, baseUrl, chatId, jobId, result);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Facebook post processing failed";
    await applyPosterProcessResult(supabase, sendPosterBotMessage, baseUrl, chatId, jobId, { kind: "error", message });
    return NextResponse.json({ ok: true });
  }
}
```

- [ ] **Step 2: Verify the full TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual end-to-end verification (no worker needed)**

First, manually insert a `poster_ingest_jobs` row to act as the target (use
the Supabase MCP `execute_sql` tool, project `hpvfsdmpatgceohigswm`):

```sql
insert into poster_ingest_jobs (telegram_chat_id, telegram_user_id, status, dedupe_key)
values (1825820545, 1825820545, 'queued_scrape', 'manual-test-key-001')
returning id;
```

Note the returned `id`. With the dev server running (`npm run dev`), call
the new endpoint with a synthetic scraped payload (replace `<id>` and
`<JOBS_SECRET>` with the local `.env.local` value):

```bash
curl -s -X POST http://localhost:3000/api/jobs/facebook-post-extract \
  -H "Content-Type: application/json" \
  -H "x-job-secret: <JOBS_SECRET>" \
  -d '{
    "posterIngestJobId": "<id>",
    "sourceUrl": "https://www.facebook.com/SomePage/posts/123",
    "text": "Поканени сте на Фестивал на лавандулата в Чирпан на 19-21 юни 2026 г. Вход свободен.",
    "imageUrls": []
  }'
```

Expected: `{"ok":true}` response. Check Telegram chat `1825820545` for the
progress messages ("🔍 Анализирам поста…", etc.) and a final result message
(inserted/duplicate/error). Check the `poster_ingest_jobs` row's `status`
updated away from `queued_scrape`.

Clean up the manual test row afterward:

```sql
delete from poster_ingest_jobs where dedupe_key = 'manual-test-key-001';
```

(If the run produced a `pending_festivals` row, decide with the user
whether to keep or delete it — do not delete festival data without
confirmation.)

- [ ] **Step 4: Commit**

```bash
git add app/api/jobs/facebook-post-extract/route.ts
git commit -m "feat(poster): add job endpoint to extract+insert from scraped Facebook post content"
```

---

## Task 12: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Extend the "Telegram poster ingest bot" section**

In `CLAUDE.md`, find the line:

```
- **Also accepts FB event links:** a text message containing a `facebook.com/events/...` URL is enqueued into `ingest_jobs` (`payload_json.submission_source="telegram"`, `telegram_user_id`) via the shared `enqueueFacebookEventIngest` helper — same path as the `/admin/ingest` web form. Photos still go to the poster pipeline (photo wins over a link in the caption). Dedup is "warn but allow": already-queued → reply "вече в опашката"; already a pending/published festival → warned but still enqueued.
```

Add immediately after it:

```
- **Also accepts FB post/permalink/story links:** a text message containing a `facebook.com/{posts,permalink.php,story.php,groups/*/posts}/...` URL (not `/events/`) is classified by `normalizeFacebookPostUrl.mjs` and enqueued via `enqueueFacebookPostScrape` into both `poster_ingest_jobs` (`status="queued_scrape"`) and `ingest_jobs` (`source_type="facebook_post"`, `job_type="scrape_facebook_post"`). A `festivo-workers` cron service (separate repo, separate plan) scrapes the link with an authenticated Playwright session and POSTs the raw text/images to `POST /api/jobs/facebook-post-extract`, which runs the same Gemini extraction → web enrichment → dedup → `pending_festivals` pipeline as the poster-photo flow (sharing `applyPosterProcessResult` / `checkExistingPosterJob`), driving the same Telegram dup-confirm UX. As of this writing the `festivo-workers` side is **not yet deployed** — submitted post links will queue indefinitely until that worker ships.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document Facebook post/permalink/story ingest path in CLAUDE.md"
```

---

## Task 13: Final verification sweep + PR

**Files:** none (verification only)

- [ ] **Step 1: Full TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Full vitest run**

Run: `npm test`
Expected: existing `.test.ts` suite passes (vitest only collects `lib/**/*.test.ts` per `vitest.config.ts` — the new `.test.ts` files from Tasks 5, 6, 10 are included; the `.mjs` test files from Tasks 2 and 3 are not part of this run, matching the existing convention where `.mjs` tests run separately).

- [ ] **Step 3: Run every new/changed `.mjs` test file directly**

```bash
node --test lib/admin/ingest/normalizeFacebookPostUrl.test.mjs
node --test lib/telegram/posterBot.test.mjs
```

Expected: all PASS.

- [ ] **Step 4: Confirm the branch, push, open PR, merge**

Per `CLAUDE.md`'s git workflow — if work so far happened directly on a
feature branch (e.g. `feat/poster-fb-post-ingest`), push and open the PR
now:

```bash
git push -u origin feat/poster-fb-post-ingest
gh pr create --title "feat(poster): accept Facebook post/permalink/story links" --body "$(cat <<'EOF'
## Proposed Change
- Summary: Lets the Telegram poster-bot queue Facebook post/permalink/story links (not just Events) for scraping by a separately-planned festivo-workers worker, then runs the scraped content through the existing Gemini poster-extraction/dedup pipeline via a new job endpoint.
- Why now: Organizers frequently announce festivals as a plain post/story without creating a formal FB Event; these links were previously rejected outright.

## Impacted Docs
- CLAUDE.md (Telegram poster ingest bot section)
- docs/superpowers/specs/2026-06-19-facebook-post-ingest-design.md

## Checklist
- [x] Schema: migration in scripts/sql/ with indexes + RLS (no new RLS surface; existing service-role-only tables)
- [x] API contract: new endpoint, no breaking changes to existing ones
- [x] Background jobs: idempotent (dedupe_key + ingest_jobs unique source_url), no batch inserts
- [x] Security: service role server-only, job endpoint gated by isAuthorizedJobRequest
- [ ] SEO: n/a (admin/ops surface only)
- [ ] Mobile sync: n/a
- [x] Docs updated in this PR
- [x] CLAUDE.md updated
EOF
)"
gh pr merge --merge --delete-branch
```

If work happened directly on `main` (matching this session's established
pattern for the earlier poster-bot fixes), skip this step — there is
nothing to merge.

---

## Spec coverage check (self-review)

- URL classification rules (event vs. post-shaped) → Tasks 2, 7.
- `poster_ingest_jobs` reused as state/UX table, `ingest_jobs` for the
  worker handoff → Tasks 1, 6.
- Job endpoint contract (`posterIngestJobId`, `sourceUrl`, `text`,
  `imageUrls`) → Task 11 (this is the exact contract the separate
  `festivo-workers` plan must implement against).
- Reuse of `enrichPosterFromWeb`, `buildPosterPendingRow`,
  `findDuplicateFestivals`, `insertPosterRow`, dup-confirm UX → Task 11
  (all imported unchanged, no duplicated logic).
- Text-only posts (no image) → Task 8 (nullable hero) + Task 11 (skips the
  fetch/upload step when `imageUrls` is empty).
- DB migration for `job_type` constraint + nullable `tg_file_*` columns →
  Task 1.
- Ops prerequisites (`FB_STORAGE_STATE_B64`, Railway cron deploy) → called
  out in the plan header as explicitly out of scope (separate repo, separate
  plan) and restated in Task 12's CLAUDE.md addition so it isn't forgotten.
