# Telegram URL Ingest + Professional `/admin/ingest` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the operator send a Facebook event link to the existing Telegram poster bot to enqueue it into `ingest_jobs`, and give `/admin/ingest` a professional Bulgarian UI (status badges, filters, search, pagination, Telegram provenance) backed by shared, tested enqueue helpers.

**Architecture:** A new pure `normalizeFacebookEventUrl.mjs` and a shared `enqueueFacebookEventIngest.ts` become the single source of truth for FB-event enqueueing, used by both `/admin/api/ingest-jobs` and the poster-bot webhook. The poster bot's `mapPosterUpdate` learns to recognize text messages containing URLs (photos still win) and the webhook routes them through the shared enqueuer with "warn-but-allow" duplicate feedback. The admin page selects provenance from `payload_json`, drops debug logging, paginates, and the panel is fully localized with colored badges and client-side filters.

**Tech Stack:** Next.js 14 App Router (route handlers, server components), Supabase service-role + admin-context clients, Node built-in test runner (`node --test`) for pure `.mjs` helpers, Tailwind, Telegram Bot API.

**Spec:** `docs/superpowers/specs/2026-06-18-telegram-url-ingest-admin-improvements-design.md`

---

## Locked decisions (from the spec — do not re-litigate)

- Extend the **existing poster bot** (no new bot/token/webhook). Photos → poster pipeline; text with a URL → ingest queue.
- **FB event links only.** Non-FB-event URLs are rejected with a friendly message.
- **Dedup = "warn but allow":** already in `ingest_jobs` → "already queued" (unique constraint); already a pending/published festival → warn but still enqueue.
- **No migration, no new env vars.** Provenance via `ingest_jobs.payload_json.submission_source="telegram"` + `telegram_user_id`. Whitelist reuses `social_repost_allowed_users`.
- Matching logic in `page.tsx` is **not** rewritten (correct at current scale).

## File structure

| File | Change | Responsibility |
|---|---|---|
| `lib/admin/ingest/normalizeFacebookEventUrl.mjs` (+ `.d.mts`, `.test.mjs`) | **new** | Pure FB-event URL validate/normalize. Unit-tested. |
| `lib/admin/ingest/enqueueFacebookEventIngest.ts` | **new** | Shared enqueue: normalize → warn-but-allow lookup → insert `ingest_jobs`. Returns a discriminated result. |
| `app/admin/api/ingest-jobs/route.ts` | modify | `facebook_event` branch uses the shared enqueuer; remove inline normalize. |
| `lib/telegram/posterBot.mjs` (+ `.d.mts`, `.test.mjs`) | modify | `extractUrlsFromMessage`, `mapPosterUpdate` → `url` action, `formatUrlResultLine`. Unit-tested. |
| `app/api/telegram/poster-bot/route.ts` | modify | Handle `action.kind === "url"`. |
| `app/admin/(protected)/ingest/page.tsx` | modify | Select `payload_json`; derive `submission_source`; remove `console.info`; paginate. |
| `components/admin/IngestJobsPanel.tsx` | modify | Full BG localization, status badges, provenance chip, filters, search, pagination controls. |
| `CLAUDE.md` | modify | Note the poster bot also accepts FB event links → `ingest_jobs`. |

**Test runner:** pure `.mjs` helpers use `node --test <path>` (Node 18+). TS modules are verified with `npx tsc --noEmit`. The webhook wiring is verified by a final manual Telegram test in prod (admin/webhook env-gated).

---

### Task 1: `normalizeFacebookEventUrl` — shared pure helper

**Files:**
- Create: `lib/admin/ingest/normalizeFacebookEventUrl.mjs`
- Create: `lib/admin/ingest/normalizeFacebookEventUrl.d.mts`
- Test: `lib/admin/ingest/normalizeFacebookEventUrl.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// lib/admin/ingest/normalizeFacebookEventUrl.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeFacebookEventUrl } from "./normalizeFacebookEventUrl.mjs";

test("valid event url: forces https, strips hash + trailing slash", () => {
  const r = normalizeFacebookEventUrl("http://www.facebook.com/events/1234567890/#x");
  assert.deepEqual(r, { value: "https://www.facebook.com/events/1234567890" });
});

test("keeps the query string", () => {
  const r = normalizeFacebookEventUrl("https://facebook.com/events/999999/?ref=a");
  assert.deepEqual(r, { value: "https://facebook.com/events/999999?ref=a" });
});

test("trims surrounding whitespace", () => {
  const r = normalizeFacebookEventUrl("  https://facebook.com/events/555/  ");
  assert.deepEqual(r, { value: "https://facebook.com/events/555" });
});

test("rejects non-facebook host", () => {
  assert.equal("error" in normalizeFacebookEventUrl("https://example.com/events/123"), true);
});

test("rejects facebook url without /events/", () => {
  assert.equal("error" in normalizeFacebookEventUrl("https://facebook.com/somepage"), true);
});

test("rejects non-http protocol", () => {
  assert.equal("error" in normalizeFacebookEventUrl("ftp://facebook.com/events/123"), true);
});

test("rejects malformed url", () => {
  assert.equal("error" in normalizeFacebookEventUrl("not a url"), true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test lib/admin/ingest/normalizeFacebookEventUrl.test.mjs`
Expected: FAIL — `Cannot find module './normalizeFacebookEventUrl.mjs'`.

- [ ] **Step 3: Write the implementation**

```js
// lib/admin/ingest/normalizeFacebookEventUrl.mjs
// Pure validate/normalize for Facebook event URLs. Single source of truth shared
// by the admin enqueue route and the Telegram poster bot's URL ingest path.

export function normalizeFacebookEventUrl(input) {
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

  if (!parsed.hostname.toLowerCase().includes("facebook.com") || !parsed.pathname.toLowerCase().includes("/events/")) {
    return { error: "URL must contain facebook.com/events/." };
  }

  parsed.protocol = "https:";
  parsed.hash = "";
  parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";

  return { value: parsed.toString().replace(/\/$/, "") };
}
```

```ts
// lib/admin/ingest/normalizeFacebookEventUrl.d.mts
export function normalizeFacebookEventUrl(input: string): { value: string } | { error: string };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test lib/admin/ingest/normalizeFacebookEventUrl.test.mjs`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/admin/ingest/normalizeFacebookEventUrl.mjs lib/admin/ingest/normalizeFacebookEventUrl.d.mts lib/admin/ingest/normalizeFacebookEventUrl.test.mjs
git commit -m "feat(ingest): extract normalizeFacebookEventUrl as shared pure helper"
```

---

### Task 2: `enqueueFacebookEventIngest` — shared enqueue helper

**Files:**
- Create: `lib/admin/ingest/enqueueFacebookEventIngest.ts`

Supabase-touching, so it is verified by `tsc` here and exercised end-to-end in Task 9. The pure URL logic it depends on is already tested (Task 1).

- [ ] **Step 1: Write the implementation**

```ts
// lib/admin/ingest/enqueueFacebookEventIngest.ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeFacebookEventUrl } from "@/lib/admin/ingest/normalizeFacebookEventUrl.mjs";
import { getSourceUrlMatchMeta } from "@/lib/admin/sourceUrlMatching";

export type EnqueueSubmissionSource = "ingest" | "telegram";

export type ExistingFestivalRef = { type: "pending" | "published"; id: string };

export type EnqueueFacebookEventResult =
  | { ok: true; kind: "queued"; jobId: string; status: string }
  | { ok: true; kind: "duplicate_warning"; jobId: string; status: string; existing: ExistingFestivalRef }
  | { ok: true; kind: "already_queued" }
  | { ok: false; kind: "error"; error: string; status: number };

/** Best-effort "is this link already a pending/published festival?" check. */
async function findExistingFestivalForUrl(
  supabase: SupabaseClient,
  sourceUrl: string,
): Promise<ExistingFestivalRef | null> {
  const eventId = getSourceUrlMatchMeta(sourceUrl)?.facebookEventId ?? null;

  // Published festivals are the stronger signal, so check them first.
  {
    let q = supabase.from("festivals").select("id").limit(1);
    q = eventId ? q.ilike("source_url", `%/events/${eventId}%`) : q.eq("source_url", sourceUrl);
    const { data } = await q.maybeSingle();
    if (data?.id) return { type: "published", id: String(data.id) };
  }
  {
    let q = supabase.from("pending_festivals").select("id").neq("status", "rejected").limit(1);
    q = eventId ? q.ilike("source_url", `%/events/${eventId}%`) : q.eq("source_url", sourceUrl);
    const { data } = await q.maybeSingle();
    if (data?.id) return { type: "pending", id: String(data.id) };
  }
  return null;
}

/**
 * Normalizes a Facebook event URL, checks for an existing record (warn-but-allow),
 * and inserts an ingest_jobs row. Shared by the admin route and the Telegram bot.
 */
export async function enqueueFacebookEventIngest(
  supabase: SupabaseClient,
  rawUrl: string,
  submissionSource: EnqueueSubmissionSource,
  opts?: { telegramUserId?: number | null },
): Promise<EnqueueFacebookEventResult> {
  const normalized = normalizeFacebookEventUrl(rawUrl);
  if ("error" in normalized) {
    return { ok: false, kind: "error", error: normalized.error, status: 400 };
  }
  const sourceUrl = normalized.value;

  const existing = await findExistingFestivalForUrl(supabase, sourceUrl);

  const payload_json: Record<string, unknown> = {
    schema_version: 1,
    submission_source: submissionSource,
  };
  if (typeof opts?.telegramUserId === "number") {
    payload_json.telegram_user_id = opts.telegramUserId;
  }

  const { data, error } = await supabase
    .from("ingest_jobs")
    .insert({
      source_url: sourceUrl,
      source_type: "facebook_event",
      status: "pending",
      payload_json,
    })
    .select("id,status")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: true, kind: "already_queued" };
    }
    return { ok: false, kind: "error", error: error.message, status: 500 };
  }
  if (!data?.id) {
    return { ok: false, kind: "error", error: "ingest_jobs insert did not return an id", status: 500 };
  }

  const jobId = String(data.id);
  const status = typeof data.status === "string" ? data.status : "pending";

  if (existing) {
    return { ok: true, kind: "duplicate_warning", jobId, status, existing };
  }
  return { ok: true, kind: "queued", jobId, status };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `enqueueFacebookEventIngest.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/admin/ingest/enqueueFacebookEventIngest.ts
git commit -m "feat(ingest): shared enqueueFacebookEventIngest with warn-but-allow dedup"
```

---

### Task 3: Refactor `/admin/api/ingest-jobs` to use the shared enqueuer

**Files:**
- Modify: `app/admin/api/ingest-jobs/route.ts`

- [ ] **Step 1: Replace the imports block**

Replace lines 1-6 (the import block) so it adds the shared enqueuer and drops nothing else:

```ts
import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { logAdminAction } from "@/lib/admin/audit-log";
import { insertDiscoveryIngestJob } from "@/lib/admin/ingest/insertDiscoveryIngestJob";
import { insertResearchIngestJob } from "@/lib/admin/ingest/insertResearchIngestJob";
import { enqueueFacebookEventIngest } from "@/lib/admin/ingest/enqueueFacebookEventIngest";
import type { ResearchEnqueueBody } from "@/lib/admin/ingest/researchPendingRowFromRequest";
```

- [ ] **Step 2: Delete the inline `normalizeFacebookEventUrl` function**

Remove the entire `function normalizeFacebookEventUrl(input: string) { ... }` block (currently lines 8-31). The shared helper replaces it.

- [ ] **Step 3: Replace the `facebook_event` enqueue tail**

Replace the final block (currently lines 116-162, from `const sourceUrl = body && typeof body.source_url === "string"...` through the final `return NextResponse.json(...)`) with:

```ts
  const sourceUrl = body && typeof body.source_url === "string" ? body.source_url : "";

  const result = await enqueueFacebookEventIngest(ctx.supabase, sourceUrl, "ingest");
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  if (result.kind === "already_queued") {
    return NextResponse.json({ error: "Already queued" }, { status: 409 });
  }

  try {
    await logAdminAction({
      actor_user_id: ctx.user.id,
      action: "ingest_job.created",
      entity_type: "ingest_job",
      entity_id: result.jobId,
      route: "/admin/api/ingest-jobs",
      method: "POST",
      details: { source_type: "facebook_event" },
    });
  } catch (auditError) {
    const message = auditError instanceof Error ? auditError.message : "unknown";
    console.error("[admin/audit] ingest_job.created failed", { message });
  }

  return NextResponse.json({ ok: true, id: result.jobId, job_id: result.jobId, status: result.status });
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: clean (no unused `normalizeFacebookEventUrl`, no missing references).

- [ ] **Step 5: Commit**

```bash
git add app/admin/api/ingest-jobs/route.ts
git commit -m "refactor(ingest): route facebook_event enqueue through shared helper"
```

---

### Task 4: posterBot — URL extraction + `url` action

**Files:**
- Modify: `lib/telegram/posterBot.mjs`
- Modify: `lib/telegram/posterBot.d.mts`
- Modify: `lib/telegram/posterBot.test.mjs`

- [ ] **Step 1: Add the failing tests**

Append to `lib/telegram/posterBot.test.mjs`:

```js
import { extractUrlsFromMessage } from "./posterBot.mjs";

test("extractUrlsFromMessage pulls a plain http(s) link from text", () => {
  const urls = extractUrlsFromMessage({ text: "виж това https://www.facebook.com/events/123456/ супер" });
  assert.deepEqual(urls, ["https://www.facebook.com/events/123456/"]);
});

test("extractUrlsFromMessage reads text_link entities and dedupes", () => {
  const urls = extractUrlsFromMessage({
    text: "клик тук и https://facebook.com/events/999/",
    entities: [{ type: "text_link", url: "https://facebook.com/events/999/" }],
  });
  assert.deepEqual(urls, ["https://facebook.com/events/999/"]);
});

test("extractUrlsFromMessage strips trailing punctuation", () => {
  const urls = extractUrlsFromMessage({ text: "(https://facebook.com/events/1/)." });
  assert.deepEqual(urls, ["https://facebook.com/events/1/"]);
});

test("mapPosterUpdate maps a text message with a URL to a url action", () => {
  const action = mapPosterUpdate({
    message: { chat: { id: 10 }, from: { id: 20 }, text: "https://facebook.com/events/123/" },
  });
  assert.deepEqual(action, {
    kind: "url",
    chatId: 10,
    userId: 20,
    url: "https://facebook.com/events/123/",
    urls: ["https://facebook.com/events/123/"],
  });
});

test("mapPosterUpdate: a photo with a link in the caption is still a photo", () => {
  const action = mapPosterUpdate({
    message: {
      chat: { id: 1 },
      from: { id: 2 },
      caption: "https://facebook.com/events/5/",
      photo: [{ file_id: "big", file_unique_id: "ub", width: 1280 }],
    },
  });
  assert.equal(action.kind, "photo");
});

test("mapPosterUpdate still ignores plain text without a URL", () => {
  assert.equal(mapPosterUpdate({ message: { chat: { id: 1 }, from: { id: 2 }, text: "здрасти" } }).kind, "ignore");
});
```

> Note: `mapPosterUpdate` and `assert`/`test` are already imported at the top of this test file from Task 3 of the poster plan — only add the `extractUrlsFromMessage` import.

- [ ] **Step 2: Run to verify failure**

Run: `node --test lib/telegram/posterBot.test.mjs`
Expected: FAIL — `extractUrlsFromMessage` is not exported and the `url` action tests fail.

- [ ] **Step 3: Add `extractUrlsFromMessage` and extend `mapPosterUpdate`**

In `lib/telegram/posterBot.mjs`, add the extractor near the top (after the imports/`buildPosterDedupeKey`):

```js
const URL_RE = /https?:\/\/[^\s<>"')]+/gi;

/** Collects HTTP(S) URLs from a message's text/caption and its text_link entities. */
export function extractUrlsFromMessage(message) {
  const urls = [];
  const seen = new Set();
  const push = (u) => {
    if (typeof u !== "string") return;
    const cleaned = u.trim().replace(/[.,)\]]+$/, "");
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      urls.push(cleaned);
    }
  };

  const text =
    typeof message?.text === "string" ? message.text : typeof message?.caption === "string" ? message.caption : "";
  const matches = text.match(URL_RE);
  if (matches) matches.forEach(push);

  const entities = Array.isArray(message?.entities)
    ? message.entities
    : Array.isArray(message?.caption_entities)
      ? message.caption_entities
      : [];
  for (const e of entities) {
    if (e && e.type === "text_link" && typeof e.url === "string") push(e.url);
  }

  return urls;
}
```

Then, in `mapPosterUpdate`, replace the photo block + final `return { kind: "ignore" }` (currently lines 42-55) with:

```js
  const msg = update?.message;
  const photo = pickLargestPhoto(msg?.photo);
  if (msg && photo) {
    return {
      kind: "photo",
      chatId: msg.chat?.id,
      userId: msg.from?.id,
      fileId: photo.file_id,
      fileUniqueId: photo.file_unique_id,
      caption: typeof msg.caption === "string" ? msg.caption.trim() : "",
    };
  }

  if (msg) {
    const urls = extractUrlsFromMessage(msg);
    if (urls.length > 0) {
      return { kind: "url", chatId: msg.chat?.id, userId: msg.from?.id, url: urls[0], urls };
    }
  }

  return { kind: "ignore" };
```

- [ ] **Step 4: Update the type declarations**

In `lib/telegram/posterBot.d.mts`, add the `url` variant to `PosterAction` and export `extractUrlsFromMessage`:

```ts
export function extractUrlsFromMessage(message: unknown): string[];

export type PosterAction =
  | { kind: "ignore" }
  | { kind: "photo"; chatId: number; userId: number; fileId: string; fileUniqueId: string; caption: string }
  | { kind: "url"; chatId: number; userId: number; url: string; urls: string[] }
  | { kind: "dup-decision"; chatId: number; userId: number; callbackQueryId: string; jobId: string; decision: "create" | "discard" };
```

- [ ] **Step 5: Run to verify it passes**

Run: `node --test lib/telegram/posterBot.test.mjs`
Expected: PASS (all prior tests + 6 new).

- [ ] **Step 6: Commit**

```bash
git add lib/telegram/posterBot.mjs lib/telegram/posterBot.d.mts lib/telegram/posterBot.test.mjs
git commit -m "feat(poster): recognize text URL messages as a url action"
```

---

### Task 5: posterBot — URL reply formatter

**Files:**
- Modify: `lib/telegram/posterBot.mjs`
- Modify: `lib/telegram/posterBot.d.mts`
- Modify: `lib/telegram/posterBot.test.mjs`

- [ ] **Step 1: Add the failing tests**

Append to `lib/telegram/posterBot.test.mjs`:

```js
import { formatUrlResultLine } from "./posterBot.mjs";

test("formatUrlResultLine: queued", () => {
  const line = formatUrlResultLine("https://facebook.com/events/1/", { ok: true, kind: "queued" }, "https://festivo.bg");
  assert.match(line, /✅/);
  assert.match(line, /опашк/i);
});

test("formatUrlResultLine: already_queued", () => {
  const line = formatUrlResultLine("https://facebook.com/events/1/", { ok: true, kind: "already_queued" }, "https://festivo.bg");
  assert.match(line, /ℹ️/);
});

test("formatUrlResultLine: duplicate_warning links to the existing record", () => {
  const line = formatUrlResultLine(
    "https://facebook.com/events/1/",
    { ok: true, kind: "duplicate_warning", jobId: "j", status: "pending", existing: { type: "published", id: "fid" } },
    "https://festivo.bg",
  );
  assert.match(line, /⚠️/);
  assert.match(line, /https:\/\/festivo\.bg\/admin\/festivals\/fid/);
});

test("formatUrlResultLine: error shows the message", () => {
  const line = formatUrlResultLine(
    "https://example.com/x",
    { ok: false, kind: "error", error: "URL must contain facebook.com/events/.", status: 400 },
    "https://festivo.bg",
  );
  assert.match(line, /❌/);
  assert.match(line, /facebook\.com\/events/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test lib/telegram/posterBot.test.mjs`
Expected: FAIL — `formatUrlResultLine` is not exported.

- [ ] **Step 3: Append the formatter to `lib/telegram/posterBot.mjs`**

```js
/** One status line per submitted URL (used by the poster-bot url action). */
export function formatUrlResultLine(url, result, baseUrl) {
  const base = String(baseUrl).replace(/\/$/, "");
  const short = url.length > 60 ? `${url.slice(0, 57)}…` : url;

  if (result?.ok && result.kind === "queued") {
    return `✅ ${short} → добавено в опашката`;
  }
  if (result?.ok && result.kind === "already_queued") {
    return `ℹ️ ${short} → вече е в опашката`;
  }
  if (result?.ok && result.kind === "duplicate_warning") {
    const href =
      result.existing?.type === "published"
        ? `${base}/admin/festivals/${result.existing.id}`
        : `${base}/admin/pending-festivals/${result.existing.id}`;
    return `⚠️ ${short} → вече има запис (${href}); добавих го пак`;
  }
  return `❌ ${short} → ${result?.error || "не е валиден Facebook event линк"}`;
}
```

- [ ] **Step 4: Add the type declaration**

Append to `lib/telegram/posterBot.d.mts`:

```ts
export function formatUrlResultLine(
  url: string,
  result:
    | { ok: true; kind: "queued" | "already_queued" }
    | { ok: true; kind: "duplicate_warning"; existing: { type: "pending" | "published"; id: string } }
    | { ok: false; kind: "error"; error: string },
  baseUrl: string,
): string;
```

- [ ] **Step 5: Run to verify it passes**

Run: `node --test lib/telegram/posterBot.test.mjs`
Expected: PASS (prior + 4 new).

- [ ] **Step 6: Commit**

```bash
git add lib/telegram/posterBot.mjs lib/telegram/posterBot.d.mts lib/telegram/posterBot.test.mjs
git commit -m "feat(poster): per-URL reply formatter for url ingest"
```

---

### Task 6: poster-bot webhook — handle the `url` action

**Files:**
- Modify: `app/api/telegram/poster-bot/route.ts`

- [ ] **Step 1: Extend the imports**

Replace the `posterBot.mjs` import (currently lines 3-10) to add `formatUrlResultLine`, and add the enqueuer import after the `processPosterJob` import:

```ts
import {
  verifyWebhookSecret,
  mapPosterUpdate,
  buildPosterDedupeKey,
  formatInserted,
  formatDuplicate,
  dupKeyboard,
  formatUrlResultLine,
} from "@/lib/telegram/posterBot.mjs";
import {
  processPosterFromFile,
  insertFromStoredExtraction,
  type ProcessResult,
} from "@/lib/admin/poster/processPosterJob";
import { enqueueFacebookEventIngest } from "@/lib/admin/ingest/enqueueFacebookEventIngest";
```

- [ ] **Step 2: Add the `url` branch**

Immediately after the whitelist gate block (after the `if (!allowed) { ... }` block, currently around line 58, before `if (action.kind === "photo")`), insert:

```ts
  if (action.kind === "url") {
    const urls = action.urls && action.urls.length > 0 ? action.urls : [action.url];
    const lines: string[] = [];
    let anyQueued = false;

    for (const url of urls) {
      const result = await enqueueFacebookEventIngest(supabase, url, "telegram", { telegramUserId: action.userId });
      lines.push(formatUrlResultLine(url, result, baseUrl));
      if (result.ok && (result.kind === "queued" || result.kind === "duplicate_warning")) {
        anyQueued = true;
      }
    }

    const footer = anyQueued ? `\n\nОпашка: ${baseUrl.replace(/\/$/, "")}/admin/ingest` : "";
    await tg("sendMessage", { chat_id: action.chatId, text: lines.join("\n") + footer });
    return NextResponse.json({ ok: true });
  }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: clean. `action.urls` / `action.url` are typed via the `url` variant added to `PosterAction` in Task 4.

- [ ] **Step 4: Commit**

```bash
git add app/api/telegram/poster-bot/route.ts
git commit -m "feat(poster): enqueue facebook event links sent as text to the bot"
```

---

### Task 7: `/admin/ingest` page — provenance, no debug log, pagination

**Files:**
- Modify: `app/admin/(protected)/ingest/page.tsx`

- [ ] **Step 1: Add `submission_source` to the row type**

In the `IngestJobRow` type, add the field (after `fb_browser_context`):

```ts
  fb_browser_context: "authenticated" | "anonymous" | null;
  submission_source: string;
```

- [ ] **Step 2: Accept `searchParams` and paginate the jobs query**

Change the function signature and the `ingest_jobs` query. Replace:

```ts
export default async function AdminIngestPage() {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect("/login?next=/admin/ingest");
  }

  const adminClient = createSupabaseAdmin();
  const { data, error } = await adminClient
    .from("ingest_jobs")
    .select("id,status,source_url,source_type,created_at,started_at,finished_at,error,fb_browser_context")
    .order("created_at", { ascending: false })
    .limit(50);
```

with:

```ts
const PAGE_SIZE = 50;

export default async function AdminIngestPage({
  searchParams,
}: {
  searchParams?: { page?: string };
}) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect("/login?next=/admin/ingest");
  }

  const page = Math.max(1, Number(searchParams?.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const adminClient = createSupabaseAdmin();
  const { data, error, count } = await adminClient
    .from("ingest_jobs")
    .select("id,status,source_url,source_type,created_at,started_at,finished_at,error,fb_browser_context,payload_json", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);
```

- [ ] **Step 3: Derive `submission_source` and delete the per-row `console.info`**

In the `rows` mapping (the `(data ?? []).map((row) => { ... })` block), remove the entire `console.info(...)` call (currently lines 200-202). Then add `submission_source` to the returned object. Replace the `return { ... }` object's tail:

```ts
      fb_browser_context,
    };
```

with:

```ts
      fb_browser_context,
      submission_source:
        row.payload_json && typeof row.payload_json === "object" && row.payload_json !== null
          ? typeof (row.payload_json as { submission_source?: unknown }).submission_source === "string"
            ? (row.payload_json as { submission_source: string }).submission_source
            : ""
          : "",
    };
```

- [ ] **Step 4: Pass pagination props to the panel**

Replace the final `return <IngestJobsPanel rows={rows} />;` with:

```ts
  return <IngestJobsPanel rows={rows} page={page} pageSize={PAGE_SIZE} total={count ?? rows.length} />;
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: one expected error — `IngestJobsPanel` does not yet accept `page`/`pageSize`/`total`. That is fixed in Task 8. Confirm there are no *other* new errors in `page.tsx` (e.g. `payload_json` selected, `console.info` gone).

- [ ] **Step 6: Commit**

```bash
git add "app/admin/(protected)/ingest/page.tsx"
git commit -m "feat(admin/ingest): paginate queue, expose provenance, drop debug log"
```

---

### Task 8: `IngestJobsPanel` — professional Bulgarian UI

**Files:**
- Modify: `components/admin/IngestJobsPanel.tsx`

Replace the **entire file** with the version below (localization + status badges + provenance chip + status/source filters + URL search + pagination controls). It preserves the existing action handlers and the `AdminEntityPageShell` structure.

- [ ] **Step 1: Replace the file contents**

```tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AdminEntityPageShell,
  AdminFieldSection,
  AdminSummaryStrip,
  ADMIN_ENTITY_SECTION,
  ADMIN_ENTITY_CONTROL_CLASS,
  buildStandardSummaryStripItems,
} from "@/components/admin/entity";
import { ADMIN_FIELD_LABEL } from "@/lib/admin/entitySchema";

type IngestJobRow = {
  id: string;
  status: "pending" | "processing" | "done" | "failed";
  source_type: string;
  source_url: string;
  pending_festival_id: string | null;
  pending_status: "pending" | "approved" | "rejected" | null;
  published_festival_id: string | null;
  moderation_action: "open_pending" | "open_festival" | "no_pending_record" | "rejected" | "approved_without_festival" | "in_progress";
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  fb_browser_context: "authenticated" | "anonymous" | null;
  submission_source: string;
};

type IngestJobsPanelProps = {
  rows: IngestJobRow[];
  page: number;
  pageSize: number;
  total: number;
};

type SourceKind = "telegram" | "facebook" | "research" | "discovery" | "other";

const SOURCE_LABEL: Record<SourceKind, string> = {
  telegram: "Telegram",
  facebook: "Facebook",
  research: "Research",
  discovery: "Discovery",
  other: "—",
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: "В опашка", className: "bg-black/[0.05] text-black/65" },
  processing: { label: "Обработва се", className: "bg-[#2563eb]/10 text-[#1d4ed8]" },
  failed: { label: "Грешка", className: "bg-[#ff4c1f]/10 text-[#b13a1a]" },
  pending_review: { label: "За преглед", className: "bg-[#d97706]/12 text-[#b45309]" },
  published: { label: "Публикуван", className: "bg-[#18a05e]/12 text-[#0e7a45]" },
  rejected: { label: "Отхвърлен", className: "bg-black/[0.06] text-black/55" },
  approved: { label: "Одобрен", className: "bg-[#18a05e]/12 text-[#0e7a45]" },
  no_pending: { label: "Няма запис", className: "bg-black/[0.05] text-black/55" },
};

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: "all", label: "Всички" },
  { value: "pending", label: "В опашка" },
  { value: "processing", label: "Обработва се" },
  { value: "failed", label: "Грешка" },
  { value: "pending_review", label: "За преглед" },
  { value: "published", label: "Публикуван" },
  { value: "rejected", label: "Отхвърлен" },
];

const SOURCE_FILTERS: Array<{ value: "all" | SourceKind; label: string }> = [
  { value: "all", label: "Всички" },
  { value: "facebook", label: "Facebook" },
  { value: "telegram", label: "Telegram" },
  { value: "research", label: "Research" },
  { value: "discovery", label: "Discovery" },
];

function workflowStateOf(row: IngestJobRow): string {
  if (row.status !== "done") return row.status; // pending | processing | failed
  switch (row.moderation_action) {
    case "open_pending":
      return "pending_review";
    case "open_festival":
      return "published";
    case "rejected":
      return "rejected";
    case "approved_without_festival":
      return "approved";
    case "no_pending_record":
      return "no_pending";
    default:
      return row.status;
  }
}

function statusBadge(state: string) {
  return STATUS_BADGE[state] ?? { label: state, className: "bg-black/[0.05] text-black/65" };
}

function sourceKindOf(row: IngestJobRow): SourceKind {
  if (row.submission_source === "telegram") return "telegram";
  if (row.source_type === "research") return "research";
  if (row.source_type === "discovery") return "discovery";
  if (row.source_type === "facebook_event") return "facebook";
  return "other";
}

function fbBrowserContextLabel(row: IngestJobRow): string {
  if (row.source_type === "research") return "—";
  if (row.status === "pending") return "—";
  if (row.status === "processing" && row.fb_browser_context == null) return "…";
  if (row.fb_browser_context === "authenticated") return "С FB сесия";
  if (row.fb_browser_context === "anonymous") return "Анонимно";
  return "—";
}

type RowAction = "retry" | "delete";

function isValidFacebookEventUrl(input: string) {
  try {
    const url = new URL(input.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return url.hostname.toLowerCase().includes("facebook.com") && url.pathname.toLowerCase().includes("/events/");
  } catch {
    return false;
  }
}

async function readErrorMessage(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error ?? fallback;
}

export default function IngestJobsPanel({ rows, page, pageSize, total }: IngestJobsPanelProps) {
  const router = useRouter();
  const [sourceUrl, setSourceUrl] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyRowId, setBusyRowId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<RowAction | null>(null);

  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | SourceKind>("all");
  const [search, setSearch] = useState("");

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!isValidFacebookEventUrl(sourceUrl)) {
      setError("Въведи валиден линк към Facebook събитие (facebook.com/events/...).");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch("/admin/api/ingest-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ source_url: sourceUrl }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Неуспешно добавяне в опашката."));
      }

      const payload = (await response.json()) as { ok: true; id: string };
      setMessage(`Добавено успешно. Job ID: ${payload.id}`);
      setSourceUrl("");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Неочаквана грешка при добавяне.");
    } finally {
      setBusy(false);
    }
  };

  const retryJob = async (row: IngestJobRow) => {
    if (busyRowId) return;

    setMessage("");
    setError("");
    setBusyRowId(row.id);
    setBusyAction("retry");

    try {
      const response = await fetch(`/admin/api/ingest-jobs/${row.id}`, {
        method: "PATCH",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Неуспешен повторен опит."));
      }

      setMessage(`Job ${row.id} е нулиран и пуснат за повторна обработка.`);
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Неочаквана грешка при повторен опит.");
    } finally {
      setBusyRowId(null);
      setBusyAction(null);
    }
  };

  const deleteJob = async (row: IngestJobRow) => {
    if (busyRowId) return;
    if (!window.confirm("Да премахна ли този job от опашката?")) return;

    setMessage("");
    setError("");
    setBusyRowId(row.id);
    setBusyAction("delete");

    try {
      const response = await fetch(`/admin/api/ingest-jobs/${row.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Неуспешно премахване."));
      }

      setMessage(`Job ${row.id} е премахнат.`);
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Неочаквана грешка при премахване.");
    } finally {
      setBusyRowId(null);
      setBusyAction(null);
    }
  };

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "all" && workflowStateOf(row) !== statusFilter) return false;
      if (sourceFilter !== "all" && sourceKindOf(row) !== sourceFilter) return false;
      if (q && !row.source_url.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, statusFilter, sourceFilter, search]);

  const summaryItems = useMemo(() => {
    const pendingReview = rows.filter((r) => r.moderation_action === "open_pending").length;
    const inFlight = rows.filter((r) => r.status === "pending" || r.status === "processing").length;
    const failed = rows.filter((r) => r.status === "failed").length;
    const statusLine = [
      inFlight > 0 ? `${inFlight} в процес` : null,
      failed > 0 ? `${failed} с грешка` : null,
      pendingReview > 0 ? `${pendingReview} за преглед` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return buildStandardSummaryStripItems({
      status: statusLine || "Опашката е спокойна",
      sourceLine: "ingest_jobs",
      city: "—",
      startDate: "—",
      organizer: "—",
      contextLabel: ADMIN_FIELD_LABEL.queue,
      contextValue: `${rows.length} ${rows.length === 1 ? "job" : "job-а"} на тази страница`,
    });
  }, [rows]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const chipBase =
    "rounded-full px-3 py-1 text-xs font-semibold transition";
  const chipOn = "bg-[#0c0e14] text-white";
  const chipOff = "bg-black/[0.04] text-black/60 hover:bg-black/[0.08]";

  return (
    <AdminEntityPageShell>
      <AdminSummaryStrip
        title="Опашка за добавяне"
        eyebrow="Админ · Ingestion"
        items={summaryItems}
        actions={
          <Link
            href="/admin/research"
            className="rounded-xl border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] hover:bg-black/[0.03]"
          >
            Research фестивал
          </Link>
        }
      />

      <AdminFieldSection
        title="Добави Facebook събитие"
        description="Facebook събитията се свалят от worker-а. Research редовете ползват source_type=research (без браузър). Discovery редовете ползват source_type=discovery. „С FB сесия“ означава, че worker-ът е ползвал запазен Facebook вход (FB_STORAGE_STATE_B64). Линкове може да се подават и през Telegram бота."
        variant={ADMIN_ENTITY_SECTION.linksSources.variant}
      >
        <form onSubmit={onSubmit} className="grid gap-2 md:grid-cols-[1fr_auto] md:items-end">
          <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-black/50">
            Линк към Facebook събитие
            <input
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://www.facebook.com/events/..."
              className={`mt-1 ${ADMIN_ENTITY_CONTROL_CLASS}`}
              required
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="h-8 rounded-lg bg-[#0c0e14] px-4 text-xs font-semibold uppercase tracking-[0.14em] text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {busy ? "Добавям..." : "Добави в опашката"}
          </button>
        </form>

        {message ? <p className="mt-2 rounded-lg bg-[#18a05e]/10 px-2.5 py-1.5 text-sm text-[#0e7a45]">{message}</p> : null}
        {error ? <p className="mt-2 rounded-lg bg-[#ff4c1f]/10 px-2.5 py-1.5 text-sm text-[#b13a1a]">{error}</p> : null}
      </AdminFieldSection>

      <AdminFieldSection
        title={ADMIN_ENTITY_SECTION.systemMeta.title}
        description="Жизнен цикъл на job-а, браузър контекст на worker-а и връзки към записите за модерация. Филтрите и търсенето важат за текущата страница."
        variant={ADMIN_ENTITY_SECTION.systemMeta.variant}
      >
        <div className="mb-3 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Статус</span>
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatusFilter(f.value)}
                className={`${chipBase} ${statusFilter === f.value ? chipOn : chipOff}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Източник</span>
            {SOURCE_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setSourceFilter(f.value)}
                className={`${chipBase} ${sourceFilter === f.value ? chipOn : chipOff}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Търси по URL…"
            className={ADMIN_ENTITY_CONTROL_CLASS}
          />
        </div>

        <div className="overflow-x-auto rounded-xl border border-black/[0.06] bg-white/80">
          <table className="min-w-full divide-y divide-black/[0.08] text-sm">
            <thead className="bg-black/[0.02] text-left text-xs uppercase tracking-[0.14em] text-black/50">
              <tr>
                <th className="px-2.5 py-2">Статус</th>
                <th className="px-2.5 py-2">Източник</th>
                <th className="px-2.5 py-2">FB браузър</th>
                <th className="px-2.5 py-2">URL</th>
                <th className="px-2.5 py-2">Създаден</th>
                <th className="px-2.5 py-2">Започнат</th>
                <th className="px-2.5 py-2">Завършен</th>
                <th className="px-2.5 py-2">Грешка</th>
                <th className="px-2.5 py-2 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06]">
              {filteredRows.length ? (
                filteredRows.map((row) => {
                  const rowBusy = busyRowId === row.id;
                  const canRetry = row.status === "failed";

                  const canReviewPending = row.status === "done" && row.moderation_action === "open_pending" && !!row.pending_festival_id;
                  const canOpenFestival = row.status === "done" && row.moderation_action === "open_festival" && !!row.published_festival_id;
                  const showNoPendingRecord = row.status === "done" && row.moderation_action === "no_pending_record";
                  const showRejected = row.status === "done" && row.moderation_action === "rejected";
                  const showApprovedNoLink = row.status === "done" && row.moderation_action === "approved_without_festival";

                  const badge = statusBadge(workflowStateOf(row));
                  const sourceKind = sourceKindOf(row);

                  return (
                    <tr key={row.id} className="hover:bg-black/[0.02]">
                      <td className="px-2.5 py-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-2.5 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-black/60">{SOURCE_LABEL[sourceKind]}</span>
                          {sourceKind === "telegram" ? (
                            <span className="inline-flex rounded-full bg-[#2563eb]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#1d4ed8]">
                              Telegram
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-2.5 py-2 text-black/65" title="Playwright: логнат FB профил или анонимно">
                        {fbBrowserContextLabel(row)}
                      </td>
                      <td className="px-2.5 py-2 text-black/75">
                        <a href={row.source_url} target="_blank" rel="noreferrer" className="break-all underline decoration-black/25 underline-offset-2">
                          {row.source_url}
                        </a>
                      </td>
                      <td className="px-2.5 py-2 text-black/65">{new Date(row.created_at).toLocaleString("bg-BG")}</td>
                      <td className="px-2.5 py-2 text-black/65">{row.started_at ? new Date(row.started_at).toLocaleString("bg-BG") : "-"}</td>
                      <td className="px-2.5 py-2 text-black/65">{row.finished_at ? new Date(row.finished_at).toLocaleString("bg-BG") : "-"}</td>
                      <td className="px-2.5 py-2 text-[#b13a1a]">{row.error ?? "-"}</td>
                      <td className="px-2.5 py-2">
                        <div className="flex flex-wrap items-center justify-end gap-2 whitespace-nowrap">
                          <a
                            href={row.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.13em] hover:bg-[#f7f6f3]"
                          >
                            Отвори URL
                          </a>
                          {canReviewPending ? (
                            <Link
                              href={`/admin/pending-festivals/${row.pending_festival_id}`}
                              className="inline-flex rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.13em] hover:bg-[#f7f6f3]"
                            >
                              Отвори чакащ
                            </Link>
                          ) : null}
                          {canOpenFestival && row.published_festival_id ? (
                            <Link
                              href={`/admin/festivals/${row.published_festival_id}`}
                              className="inline-flex rounded-lg border border-[#18a05e]/30 bg-[#18a05e]/10 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.13em] text-[#0e7a45] hover:bg-[#18a05e]/15"
                            >
                              Отвори фестивал
                            </Link>
                          ) : null}
                          {showNoPendingRecord ? <span className="text-xs text-black/45">Няма запис</span> : null}
                          {showRejected ? <span className="text-xs text-black/45">Отхвърлен при преглед</span> : null}
                          {showApprovedNoLink ? <span className="text-xs text-black/45">Одобрен</span> : null}
                          <button
                            type="button"
                            disabled={!canRetry || rowBusy}
                            onClick={() => retryJob(row)}
                            className="inline-flex rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.13em] disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            {rowBusy && busyAction === "retry" ? "Опитвам..." : "Повтори"}
                          </button>
                          <button
                            type="button"
                            disabled={rowBusy}
                            onClick={() => deleteJob(row)}
                            className="inline-flex rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.13em] text-[#b13a1a] disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            {rowBusy && busyAction === "delete" ? "Премахвам..." : "Премахни"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-sm text-black/60">
                    {rows.length ? "Няма резултати за този филтър." : "Все още няма job-ове в опашката."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-black/55">
          <span>
            Страница {page} от {totalPages} · {total} общо
          </span>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link
                href={`/admin/ingest?page=${page - 1}`}
                className="rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 font-semibold uppercase tracking-[0.13em] hover:bg-[#f7f6f3]"
              >
                ← Назад
              </Link>
            ) : (
              <span className="rounded-lg border border-black/[0.06] px-2.5 py-1.5 font-semibold uppercase tracking-[0.13em] text-black/30">
                ← Назад
              </span>
            )}
            {page < totalPages ? (
              <Link
                href={`/admin/ingest?page=${page + 1}`}
                className="rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 font-semibold uppercase tracking-[0.13em] hover:bg-[#f7f6f3]"
              >
                Напред →
              </Link>
            ) : (
              <span className="rounded-lg border border-black/[0.06] px-2.5 py-1.5 font-semibold uppercase tracking-[0.13em] text-black/30">
                Напред →
              </span>
            )}
          </div>
        </div>
      </AdminFieldSection>
    </AdminEntityPageShell>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean — `page.tsx` from Task 7 now matches the new `IngestJobsPanelProps`.

- [ ] **Step 3: Lint the touched files**

Run: `npx next lint --file components/admin/IngestJobsPanel.tsx`
Expected: no errors. (If the project lints the whole repo instead, run `npx next lint` and confirm no new warnings from this file.)

- [ ] **Step 4: Commit**

```bash
git add components/admin/IngestJobsPanel.tsx
git commit -m "feat(admin/ingest): localized UI with badges, filters, search, pagination"
```

---

### Task 9: Docs, full verification, PR

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the poster-bot section in `CLAUDE.md`**

In the "## Telegram poster ingest bot" section, add a bullet to the key-files/behavior list (right after the intro paragraph's flow block, or alongside the existing bullets):

```md
- **Also accepts FB event links:** a text message containing a `facebook.com/events/...` URL is enqueued into `ingest_jobs` (`payload_json.submission_source="telegram"`, `telegram_user_id`) via the shared `enqueueFacebookEventIngest` helper — same path as the `/admin/ingest` web form. Photos still go to the poster pipeline (photo wins over a link in the caption). Dedup is "warn but allow": already-queued → reply "вече в опашката"; already a pending/published festival → warned but still enqueued.
```

- [ ] **Step 2: Run the full pure-helper test suite**

Run: `node --test lib/admin/ingest/normalizeFacebookEventUrl.test.mjs lib/telegram/posterBot.test.mjs`
Expected: PASS (all tests green).

- [ ] **Step 3: Full type-check + lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx next lint`
Expected: no new errors/warnings from the touched files.

- [ ] **Step 4: Commit the docs**

```bash
git add CLAUDE.md
git commit -m "docs: note telegram poster bot also enqueues FB event links"
```

- [ ] **Step 5: Push + open + merge the PR**

```bash
git push -u origin feat/telegram-url-ingest
gh pr create --title "feat(ingest): Telegram URL ingest + professional /admin/ingest" --body "$(cat <<'EOF'
## Proposed Change
- Summary: The Telegram poster bot now also accepts Facebook event links (text) and enqueues them into `ingest_jobs` via a shared `enqueueFacebookEventIngest` helper. `/admin/ingest` is fully localized to Bulgarian with status badges, status/source filters, URL search, pagination, and a Telegram provenance chip.
- Why now: faster mobile queueing for the operator + a more professional admin surface.

## Impacted Docs
- docs/superpowers/specs/2026-06-18-telegram-url-ingest-admin-improvements-design.md
- CLAUDE.md (poster bot section)

## Checklist
- [x] Schema: no migration (provenance via payload_json jsonb)
- [x] API contract: backward-compatible (web form unchanged; 409 on duplicate preserved)
- [x] Background jobs: idempotent (ingest_jobs unique constraint), warn-but-allow dedup
- [x] Security: whitelist-gated webhook, service-role server-only, no new secrets
- [x] Docs updated in this PR
- [x] CLAUDE.md updated
EOF
)"
gh pr merge --merge --delete-branch
```

- [ ] **Step 6: Manual verification in prod (post-merge)**

After Vercel deploys `main`:
1. From a whitelisted Telegram account, send a `facebook.com/events/...` link to the poster bot → expect `✅ … добавено в опашката` + a link to `/admin/ingest`.
2. Open `/admin/ingest` → the new row shows the **Telegram** source chip and a colored status badge.
3. Send the same link again → expect `ℹ️ вече е в опашката`.
4. Send a non-FB link (e.g. `https://example.com`) → expect the friendly reject message.
5. Send a poster photo → confirm the poster pipeline still works unchanged.

---

## Self-review notes

- **Spec coverage:** bot URL ingest (Tasks 4-6), shared backend helpers (Tasks 1-3), provenance + pagination + debug-log removal (Task 7), full UI redesign with badges/filters/search/pagination (Task 8), docs (Task 9). All spec sections map to a task.
- **Type consistency:** `EnqueueFacebookEventResult` (Task 2) is consumed by the route (Task 3) and the bot (Task 6); the `url` `PosterAction` variant (Task 4) feeds `formatUrlResultLine` (Task 5) and the route (Task 6); `IngestJobRow.submission_source` (Task 7) is read by `sourceKindOf` (Task 8); `IngestJobsPanelProps` (Task 8) matches the props passed in Task 7.
- **No new env vars, no migration** — per spec.
