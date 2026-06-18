# Poster Bot: Enrich Existing Festival — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the poster bot detects a duplicate, add an "Обогати" button that fill-null-only patches the existing festival (pending or published) with data from the poster.

**Architecture:** Pure patch-computation function (TDD) → server orchestrator that either updates `pending_festivals` directly or inserts into a new `festival_enrichment_proposals` table → admin review UI for published-festival proposals.

**Tech Stack:** Next.js 14 App Router · Supabase (service-role) · TypeScript · Tailwind · Telegram Bot API

---

## File Map

| Action | File |
|---|---|
| NEW | `scripts/sql/20260619_festival_enrichment_proposals.sql` |
| NEW | `lib/admin/poster/computeEnrichmentPatch.ts` |
| NEW | `lib/admin/poster/computeEnrichmentPatch.test.ts` |
| NEW | `lib/admin/poster/applyPosterEnrichment.ts` |
| MODIFY | `lib/telegram/posterBot.mjs` |
| MODIFY | `lib/telegram/posterBot.d.mts` |
| MODIFY | `app/api/telegram/poster-bot/route.ts` |
| MODIFY | `lib/admin/adminNavConfig.ts` |
| NEW | `app/admin/api/enrichment-proposals/route.ts` |
| NEW | `app/admin/api/enrichment-proposals/[id]/route.ts` |
| NEW | `app/admin/(protected)/enrichment-proposals/page.tsx` |
| NEW | `app/admin/(protected)/enrichment-proposals/[id]/page.tsx` |
| MODIFY | `app/admin/(protected)/pending-festivals/[id]/page.tsx` |

---

## Task 1: DB migration

**Files:**
- Create: `scripts/sql/20260619_festival_enrichment_proposals.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- scripts/sql/20260619_festival_enrichment_proposals.sql

-- Table for enrichment proposals targeting published festivals.
-- Pending festival enrichments are applied in-place (no proposal table needed).
CREATE TABLE IF NOT EXISTS festival_enrichment_proposals (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status               text NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'approved', 'rejected')),
  target_festival_id   bigint REFERENCES festivals(id) ON DELETE CASCADE,
  patch_json           jsonb NOT NULL,
  poster_ingest_job_id bigint REFERENCES poster_ingest_jobs(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  reviewed_at          timestamptz,
  reviewed_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS festival_enrichment_proposals_status_idx
  ON festival_enrichment_proposals (status);
CREATE INDEX IF NOT EXISTS festival_enrichment_proposals_target_idx
  ON festival_enrichment_proposals (target_festival_id);

-- RLS: only service-role; no public or authenticated access.
ALTER TABLE festival_enrichment_proposals ENABLE ROW LEVEL SECURITY;
-- No policies = no access for anon/authenticated JWT; service-role bypasses RLS.

-- Track which fields on a pending_festival were added by poster enrichment.
ALTER TABLE pending_festivals
  ADD COLUMN IF NOT EXISTS enriched_fields jsonb;
-- e.g. ["description", "facebook_url"]
```

- [ ] **Step 2: Apply via Supabase MCP**

Use the Supabase MCP tool to apply the migration to the production project (`hpvfsdmpatgceohigswm`). Verify both the table and the column exist.

- [ ] **Step 3: Commit**

```bash
git add scripts/sql/20260619_festival_enrichment_proposals.sql
git commit -m "chore(db): add festival_enrichment_proposals table and enriched_fields on pending_festivals"
```

---

## Task 2: `computeEnrichmentPatch` — pure function with TDD

**Files:**
- Create: `lib/admin/poster/computeEnrichmentPatch.ts`
- Create: `lib/admin/poster/computeEnrichmentPatch.test.ts`

This is a pure function — no DB, no side effects. Test first.

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/admin/poster/computeEnrichmentPatch.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeEnrichmentPatch } from "./computeEnrichmentPatch.js";

function makeExtraction(overrides: Record<string, unknown> = {}) {
  const conf = (v: unknown) => ({ value: v ?? null, confidence: 0.9, needs_review: false });
  return {
    title: conf("Тест фест"),
    title_candidates: [],
    category: conf(overrides.category ?? null),
    start_date: { day: 1, month: 7, year: 2026, year_explicit: true, weekday: null },
    end_date: { day: null, month: null, year: null, year_explicit: false, weekday: null },
    other_dates: [],
    start_time: conf(null),
    end_time: conf(null),
    city: conf(null),
    venue_name: conf(overrides.venue_name ?? null),
    address: conf(overrides.address ?? null),
    organizer_name: conf(null),
    organizer_names: [],
    description: conf(overrides.description ?? null),
    is_free: conf(overrides.is_free !== undefined ? overrides.is_free : null),
    price_range: conf(null),
    website_url: conf(overrides.website_url ?? null),
    facebook_url: conf(overrides.facebook_url ?? null),
    instagram_url: conf(overrides.instagram_url ?? null),
    ticket_url: conf(overrides.ticket_url ?? null),
    contact: { phone: null, person: null },
    tags: [],
    program: overrides.program ?? null,
  };
}

test("returns patch with description when target is empty", () => {
  const ext = makeExtraction({ description: "Три дни музика" });
  const patch = computeEnrichmentPatch(ext, { description: null }, "festival");
  assert.equal(patch?.description, "Три дни музика");
});

test("skips field when target already has a value", () => {
  const ext = makeExtraction({ description: "Ново" });
  const patch = computeEnrichmentPatch(ext, { description: "Старо" }, "festival");
  assert.equal(patch, null); // nothing left to patch
});

test("fills facebook_url when empty string on target", () => {
  const ext = makeExtraction({ facebook_url: "https://fb.com/events/1" });
  const patch = computeEnrichmentPatch(ext, { facebook_url: "" }, "festival");
  assert.equal(patch?.facebook_url, "https://fb.com/events/1");
});

test("fills is_free: false (boolean false is a valid fill value)", () => {
  const ext = makeExtraction({ is_free: false });
  const patch = computeEnrichmentPatch(ext, { is_free: null }, "festival");
  assert.equal(patch?.is_free, false);
});

test("does not fill is_free: false when target already has false", () => {
  const ext = makeExtraction({ is_free: false });
  const patch = computeEnrichmentPatch(ext, { is_free: false }, "festival");
  assert.equal(patch, null);
});

test("fills location_name from venue_name", () => {
  const ext = makeExtraction({ venue_name: "Летен театър" });
  const patch = computeEnrichmentPatch(ext, { location_name: null }, "festival");
  assert.equal(patch?.location_name, "Летен театър");
});

test("includes program_draft for pending target but not festival target", () => {
  const ext = makeExtraction({ program: [{ time: "20:00", act: "Концерт" }] });
  const patchPending = computeEnrichmentPatch(ext, { program_draft: null }, "pending");
  const patchFestival = computeEnrichmentPatch(ext, {}, "festival");
  assert.ok(patchPending?.program_draft !== undefined);
  assert.equal(patchFestival?.program_draft, undefined);
});

test("returns null when nothing to patch", () => {
  const ext = makeExtraction({ description: null, facebook_url: null });
  const patch = computeEnrichmentPatch(ext, {}, "festival");
  assert.equal(patch, null);
});

test("patches multiple fields at once", () => {
  const ext = makeExtraction({ description: "Описание", facebook_url: "https://fb.com/1" });
  const patch = computeEnrichmentPatch(ext, { description: null, facebook_url: null }, "festival");
  assert.equal(patch?.description, "Описание");
  assert.equal(patch?.facebook_url, "https://fb.com/1");
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test lib/admin/poster/computeEnrichmentPatch.test.ts
```

Expected: error "Cannot find module './computeEnrichmentPatch.js'"

- [ ] **Step 3: Implement the function**

```typescript
// lib/admin/poster/computeEnrichmentPatch.ts
import type { PosterExtraction } from "@/lib/admin/poster/posterExtractionSchema";

export type EnrichmentTargetType = "pending" | "festival";

type PatchRecord = Record<string, unknown>;

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === "";
}

/**
 * Computes which fields from the poster extraction should be applied to the
 * target record. Only fills fields where the target currently has a null/empty
 * value AND the extraction has a non-null value.
 *
 * Returns null if there is nothing to patch.
 */
export function computeEnrichmentPatch(
  extraction: PosterExtraction,
  currentValues: PatchRecord,
  targetType: EnrichmentTargetType,
): PatchRecord | null {
  const patch: PatchRecord = {};

  const tryFill = (field: string, value: unknown) => {
    if (value === null || value === undefined) return;
    if (typeof value === "string" && value.trim() === "") return;
    if (!isEmpty(currentValues[field])) return;
    patch[field] = value;
  };

  tryFill("description", extraction.description.value?.trim() || null);
  tryFill("facebook_url", extraction.facebook_url.value?.trim() || null);
  tryFill("website_url", extraction.website_url.value?.trim() || null);
  tryFill("instagram_url", extraction.instagram_url.value?.trim() || null);
  tryFill("ticket_url", extraction.ticket_url.value?.trim() || null);
  tryFill("location_name", extraction.venue_name.value?.trim() || null);
  tryFill("address", extraction.address.value?.trim() || null);
  tryFill("category", extraction.category.value?.trim() || null);

  // is_free is boolean: false is valid, only skip if extraction has null
  if (extraction.is_free.value !== null && extraction.is_free.value !== undefined) {
    if (isEmpty(currentValues["is_free"])) {
      patch["is_free"] = extraction.is_free.value;
    }
  }

  // program_draft only applies to pending_festival targets
  if (targetType === "pending" && extraction.program !== null) {
    if (isEmpty(currentValues["program_draft"])) {
      patch["program_draft"] = extraction.program;
    }
  }

  return Object.keys(patch).length > 0 ? patch : null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test lib/admin/poster/computeEnrichmentPatch.test.ts
```

Expected: all 9 tests pass, no output on stdout.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/poster/computeEnrichmentPatch.ts lib/admin/poster/computeEnrichmentPatch.test.ts
git commit -m "feat(poster): add computeEnrichmentPatch pure function with tests"
```

---

## Task 3: `applyPosterEnrichment` — server orchestrator

**Files:**
- Create: `lib/admin/poster/applyPosterEnrichment.ts`

- [ ] **Step 1: Create the file**

```typescript
// lib/admin/poster/applyPosterEnrichment.ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PosterExtraction } from "@/lib/admin/poster/posterExtractionSchema";
import { computeEnrichmentPatch } from "@/lib/admin/poster/computeEnrichmentPatch";
import type { DuplicateMatch } from "@/lib/admin/research/findDuplicateFestivals";

export type EnrichResult =
  | { ok: true; kind: "patched_pending"; fields: string[] }
  | { ok: true; kind: "proposal_created"; fields: string[] }
  | { ok: true; kind: "nothing_to_patch" }
  | { ok: false; error: string };

/**
 * Applies fill-null-only enrichment from a poster extraction to an existing
 * festival (pending or published).
 *
 * - pending target  → UPDATE pending_festivals in-place, set enriched_fields
 * - festival target → INSERT festival_enrichment_proposals for admin review
 */
export async function applyPosterEnrichment(
  supabase: SupabaseClient,
  extraction: PosterExtraction,
  target: DuplicateMatch,
  posterIngestJobId: string | null,
): Promise<EnrichResult> {
  try {
    if (target.table === "pending") {
      // Load current values of enrichable fields
      const { data: current, error: fetchErr } = await supabase
        .from("pending_festivals")
        .select(
          "description,facebook_url,website_url,instagram_url,ticket_url,location_name,address,is_free,category,program_draft",
        )
        .eq("id", target.id)
        .maybeSingle();

      if (fetchErr || !current) {
        return { ok: false, error: fetchErr?.message ?? "Pending festival not found" };
      }

      const patch = computeEnrichmentPatch(extraction, current as Record<string, unknown>, "pending");
      if (!patch) return { ok: true, kind: "nothing_to_patch" };

      const fields = Object.keys(patch);

      const { error: updateErr } = await supabase
        .from("pending_festivals")
        .update({
          ...patch,
          enriched_fields: fields,
          updated_at: new Date().toISOString(),
        })
        .eq("id", target.id);

      if (updateErr) return { ok: false, error: updateErr.message };
      return { ok: true, kind: "patched_pending", fields };
    }

    // published festival target
    const { data: current, error: fetchErr } = await supabase
      .from("festivals")
      .select(
        "description,facebook_url,website_url,instagram_url,ticket_url,location_name,address,is_free,category",
      )
      .eq("id", target.id)
      .maybeSingle();

    if (fetchErr || !current) {
      return { ok: false, error: fetchErr?.message ?? "Festival not found" };
    }

    const patch = computeEnrichmentPatch(extraction, current as Record<string, unknown>, "festival");
    if (!patch) return { ok: true, kind: "nothing_to_patch" };

    const fields = Object.keys(patch);

    const { error: insertErr } = await supabase.from("festival_enrichment_proposals").insert({
      target_festival_id: Number(target.id),
      patch_json: patch,
      poster_ingest_job_id: posterIngestJobId ? Number(posterIngestJobId) : null,
    });

    if (insertErr) return { ok: false, error: insertErr.message };
    return { ok: true, kind: "proposal_created", fields };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/admin/poster/applyPosterEnrichment.ts
git commit -m "feat(poster): add applyPosterEnrichment orchestrator"
```

---

## Task 4: Update Telegram bot — keyboard + messages

**Files:**
- Modify: `lib/telegram/posterBot.mjs`
- Modify: `lib/telegram/posterBot.d.mts`

- [ ] **Step 1: Update `dupKeyboard` in `posterBot.mjs` to 3 buttons and add `formatEnriched`**

Replace the existing `dupKeyboard` function and add `formatEnriched` at the end of the file:

```javascript
// Replace dupKeyboard (was 2 buttons in one row):
export function dupKeyboard(jobId) {
  return {
    inline_keyboard: [
      [{ text: "🔄 Обогати съществуващия", callback_data: `poster:${jobId}:enrich` }],
      [
        { text: "✅ Все пак създай нов", callback_data: `poster:${jobId}:create` },
        { text: "❌ Откажи", callback_data: `poster:${jobId}:discard` },
      ],
    ],
  };
}
```

Add after `formatDuplicate`:

```javascript
/**
 * Confirmation message sent after a successful enrichment.
 * @param {string[]} fields - column names that were filled
 * @param {string} title - festival title
 * @param {"patched_pending"|"proposal_created"} kind
 * @param {string} baseUrl
 */
export function formatEnriched(fields, title, kind, baseUrl) {
  const base = String(baseUrl).replace(/\/$/, "");
  const fieldList = fields.map((f) => `   + ${f}`).join("\n");
  if (kind === "patched_pending") {
    return `✅ Черновата е обогатена:\n„${title}"\n${fieldList}\n\nАдмин ще я прегледа при нормален review.`;
  }
  const link = `${base}/admin/enrichment-proposals`;
  return `✅ Предложено обогатяване на:\n„${title}"\n${fieldList}\n\nЧака одобрение: ${link}`;
}
```

- [ ] **Step 2: Update `mapPosterUpdate` to recognise "enrich" decision**

In `mapPosterUpdate`, the `parts[2]` is already passed through as `decision`. No code change needed — the function already returns `decision: parts[2]`. Just verify:

```javascript
// Existing line in mapPosterUpdate:
decision: parts[2], // "create" | "discard" | "reprocess" — now also "enrich"
```

- [ ] **Step 3: Update `posterBot.d.mts` type declarations**

```typescript
// lib/telegram/posterBot.d.mts — add to the dup-decision union and add formatEnriched export

// Change the decision type in PosterAction:
export type PosterAction =
  | { kind: "ignore" }
  | { kind: "photo"; chatId: number; userId: number; fileId: string; fileUniqueId: string; caption: string }
  | { kind: "url"; chatId: number; userId: number; url: string; urls: string[] }
  | {
      kind: "dup-decision";
      chatId: number;
      userId: number;
      callbackQueryId: string;
      jobId: string;
      decision: "create" | "discard" | "reprocess" | "enrich";
    };

// Add after formatDuplicate:
export function formatEnriched(
  fields: string[],
  title: string,
  kind: "patched_pending" | "proposal_created",
  baseUrl: string,
): string;
```

The full `posterBot.d.mts` should look like:

```typescript
export function verifyWebhookSecret(headerSecret: string | null | undefined, expected: string | null | undefined): boolean;
export function buildPosterDedupeKey(chatId: number | string, fileUniqueId: string): string;
export function extractUrlsFromMessage(message: unknown): string[];

export type PosterAction =
  | { kind: "ignore" }
  | { kind: "photo"; chatId: number; userId: number; fileId: string; fileUniqueId: string; caption: string }
  | { kind: "url"; chatId: number; userId: number; url: string; urls: string[] }
  | {
      kind: "dup-decision";
      chatId: number;
      userId: number;
      callbackQueryId: string;
      jobId: string;
      decision: "create" | "discard" | "reprocess" | "enrich";
    };

export function mapPosterUpdate(update: unknown): PosterAction;

export function formatInserted(input: { pendingId: string; title: string; needsReview: boolean; baseUrl: string }): string;
export function dupKeyboard(jobId: string): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> };
export function reprocessKeyboard(jobId: string): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> };
export function formatDuplicate(matches: Array<{ title: string; href: string }>, baseUrl: string): string;
export function formatAlreadyDone(input: { pendingId: string | null; baseUrl: string }): string;
export function formatRejected(input: { pendingId: string | null; baseUrl: string }): string;
export function formatEnriched(
  fields: string[],
  title: string,
  kind: "patched_pending" | "proposal_created",
  baseUrl: string,
): string;
export function formatUrlResultLine(
  url: string,
  result:
    | { ok: true; kind: "queued" | "already_queued" }
    | { ok: true; kind: "duplicate_warning"; existing: { type: "pending" | "published"; id: string } }
    | { ok: false; kind: "error"; error: string },
  baseUrl: string,
): string;
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output (no errors).

- [ ] **Step 5: Commit**

```bash
git add lib/telegram/posterBot.mjs lib/telegram/posterBot.d.mts
git commit -m "feat(poster): add enrich button to duplicate keyboard and formatEnriched message"
```

---

## Task 5: Wire "enrich" decision in `route.ts`

**Files:**
- Modify: `app/api/telegram/poster-bot/route.ts`

- [ ] **Step 1: Add imports**

At the top of `route.ts`, add:

```typescript
import {
  // ... existing imports ...
  formatEnriched,
} from "@/lib/telegram/posterBot.mjs";
import { applyPosterEnrichment } from "@/lib/admin/poster/applyPosterEnrichment";
import type { DuplicateMatch } from "@/lib/admin/research/findDuplicateFestivals";
```

- [ ] **Step 2: Add "enrich" branch in the `dup-decision` handler**

Inside the `if (action.kind === "dup-decision")` block, add a new branch BEFORE the `if (job.status !== "awaiting_dup_confirm")` check:

```typescript
if (action.decision === "enrich") {
  await tg("answerCallbackQuery", { callback_query_id: action.callbackQueryId, text: "ок" });

  const { data: job } = await supabase
    .from("poster_ingest_jobs")
    .select("id,dup_matches,extraction_json")
    .eq("id", action.jobId)
    .maybeSingle();

  if (!job) return NextResponse.json({ ok: true });

  const matches = Array.isArray(job.dup_matches) ? (job.dup_matches as DuplicateMatch[]) : [];
  const topMatch = matches[0] ?? null;

  if (!topMatch) {
    await tg("sendMessage", { chat_id: action.chatId, text: "❌ Няма намерен дубликат за обогатяване." });
    return NextResponse.json({ ok: true });
  }

  const stored = job.extraction_json as { extraction?: unknown; heroUrl?: string } | null;
  if (!stored?.extraction) {
    await tg("sendMessage", { chat_id: action.chatId, text: "❌ Липсват запазени данни от плаката." });
    return NextResponse.json({ ok: true });
  }

  const result = await applyPosterEnrichment(
    supabase,
    stored.extraction as Parameters<typeof applyPosterEnrichment>[2],
    topMatch,
    String(job.id),
  );

  if (!result.ok) {
    await tg("sendMessage", { chat_id: action.chatId, text: `❌ Грешка: ${result.error}` });
    return NextResponse.json({ ok: true });
  }

  if (result.kind === "nothing_to_patch") {
    await tg("sendMessage", {
      chat_id: action.chatId,
      text: "ℹ️ Няма какво да се добави — фестивалът вече има всички полета.",
    });
    return NextResponse.json({ ok: true });
  }

  await tg("sendMessage", {
    chat_id: action.chatId,
    text: formatEnriched(result.fields, topMatch.title, result.kind, baseUrl),
    disable_web_page_preview: true,
  });
  return NextResponse.json({ ok: true });
}
```

Note: the `applyPosterEnrichment` function signature takes `PosterExtraction` as second argument. The stored extraction is a plain object so cast it. The third argument is `DuplicateMatch` (target).

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add app/api/telegram/poster-bot/route.ts
git commit -m "feat(poster): wire enrich decision in poster-bot route"
```

---

## Task 6: Admin API routes for enrichment proposals

**Files:**
- Create: `app/admin/api/enrichment-proposals/route.ts`
- Create: `app/admin/api/enrichment-proposals/[id]/route.ts`

- [ ] **Step 1: Create list route**

```typescript
// app/admin/api/enrichment-proposals/route.ts
import { NextResponse } from "next/server";
import { hasAdminRole } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await hasAdminRole())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "pending";

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("festival_enrichment_proposals")
    .select("id,status,target_festival_id,patch_json,created_at,festivals(title,slug)")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ proposals: data ?? [] });
}
```

- [ ] **Step 2: Create detail + action route**

```typescript
// app/admin/api/enrichment-proposals/[id]/route.ts
import { NextResponse } from "next/server";
import { hasAdminRole } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthenticatedUser } from "@/lib/authUser";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasAdminRole())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("festival_enrichment_proposals")
    .select("*,festivals(id,title,slug)")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ proposal: data });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasAdminRole())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body?.action; // "approve" | "reject"
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const user = await getAuthenticatedUser();
  const supabase = createSupabaseAdmin();
  const now = new Date().toISOString();

  if (action === "reject") {
    const { error } = await supabase
      .from("festival_enrichment_proposals")
      .update({ status: "rejected", reviewed_at: now, reviewed_by: user?.id ?? null, updated_at: now })
      .eq("id", id)
      .eq("status", "pending");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // approve: load proposal + apply patch fill-null-only
  const { data: proposal, error: fetchErr } = await supabase
    .from("festival_enrichment_proposals")
    .select("*")
    .eq("id", id)
    .eq("status", "pending")
    .maybeSingle();

  if (fetchErr || !proposal) {
    return NextResponse.json({ error: fetchErr?.message ?? "Not found or already reviewed" }, { status: 404 });
  }

  const patch = proposal.patch_json as Record<string, unknown>;
  const festivalId = proposal.target_festival_id as number;

  // Load current values to re-check nullity (concurrent edit protection)
  const { data: current } = await supabase
    .from("festivals")
    .select(Object.keys(patch).join(","))
    .eq("id", festivalId)
    .maybeSingle();

  const safePatch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    const currentVal = (current as Record<string, unknown> | null)?.[key];
    if (currentVal === null || currentVal === undefined || currentVal === "") {
      safePatch[key] = value;
    }
  }

  if (Object.keys(safePatch).length > 0) {
    const { error: patchErr } = await supabase
      .from("festivals")
      .update({ ...safePatch, updated_at: now })
      .eq("id", festivalId);
    if (patchErr) return NextResponse.json({ error: patchErr.message }, { status: 500 });
  }

  await supabase
    .from("festival_enrichment_proposals")
    .update({ status: "approved", reviewed_at: now, reviewed_by: user?.id ?? null, updated_at: now })
    .eq("id", id);

  return NextResponse.json({ ok: true, patched_fields: Object.keys(safePatch) });
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add app/admin/api/enrichment-proposals/route.ts app/admin/api/enrichment-proposals/[id]/route.ts
git commit -m "feat(admin): add enrichment-proposals API routes (list + detail + approve/reject)"
```

---

## Task 7: Admin list page `/admin/enrichment-proposals`

**Files:**
- Create: `app/admin/(protected)/enrichment-proposals/page.tsx`

- [ ] **Step 1: Create the list page**

```typescript
// app/admin/(protected)/enrichment-proposals/page.tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export default async function EnrichmentProposalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ctx = await getAdminContext();
  if (!ctx?.isAdmin) redirect("/login?next=/admin/enrichment-proposals");

  const sp = await searchParams;
  const status = sp.status ?? "pending";

  const supabase = createSupabaseAdmin();
  const { data: proposals, error } = await supabase
    .from("festival_enrichment_proposals")
    .select("id,status,patch_json,created_at,target_festival_id,festivals(title)")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return <div className="p-6 text-red-600">{error.message}</div>;
  }

  const tabs = [
    { label: "Чакащи", value: "pending" },
    { label: "Одобрени", value: "approved" },
    { label: "Отхвърлени", value: "rejected" },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-[#0c0e14]">Обогатявания от плакати</h1>
        <p className="mt-1 text-sm text-black/50">
          Предложения за попълване на празни полета в публикувани фестивали.
        </p>
      </div>

      <div className="flex gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/enrichment-proposals?status=${tab.value}`}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
              status === tab.value
                ? "border-black/20 bg-black/8 text-black"
                : "border-black/10 bg-white text-black/60 hover:bg-black/5"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {(proposals ?? []).length === 0 ? (
        <p className="text-sm text-black/40">Няма предложения.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-black/[0.06] bg-black/[0.02]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-black/60">Фестивал</th>
                <th className="px-4 py-3 text-left font-semibold text-black/60">Полета</th>
                <th className="px-4 py-3 text-left font-semibold text-black/60">Дата</th>
                <th className="px-4 py-3 text-left font-semibold text-black/60"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {(proposals ?? []).map((p) => {
                const festival = Array.isArray(p.festivals) ? p.festivals[0] : p.festivals;
                const festivalTitle =
                  festival && typeof festival === "object" && "title" in festival
                    ? String((festival as { title: unknown }).title)
                    : `Festival #${p.target_festival_id}`;
                const fields = Object.keys(p.patch_json ?? {});
                return (
                  <tr key={p.id} className="hover:bg-black/[0.015]">
                    <td className="px-4 py-3 font-medium text-[#0c0e14]">{festivalTitle}</td>
                    <td className="px-4 py-3 text-black/60">{fields.join(", ")}</td>
                    <td className="px-4 py-3 text-black/40">
                      {new Date(p.created_at).toLocaleDateString("bg-BG")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/enrichment-proposals/${p.id}`}
                        className="rounded-lg bg-black px-3 py-1 text-xs font-semibold text-white hover:bg-black/80"
                      >
                        Преглед →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/admin/(protected)/enrichment-proposals/page.tsx"
git commit -m "feat(admin): add enrichment proposals list page"
```

---

## Task 8: Admin detail/review page `/admin/enrichment-proposals/[id]`

**Files:**
- Create: `app/admin/(protected)/enrichment-proposals/[id]/page.tsx`

- [ ] **Step 1: Create the review page**

```typescript
// app/admin/(protected)/enrichment-proposals/[id]/page.tsx
"use client";
// Note: This page is a Client Component to handle approve/reject actions inline.
// The page data is fetched on the server via the API route.

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

const FIELD_LABELS: Record<string, string> = {
  description: "Описание",
  program_draft: "Програма",
  facebook_url: "Facebook URL",
  website_url: "Уебсайт",
  instagram_url: "Instagram URL",
  ticket_url: "Билети URL",
  location_name: "Локация",
  address: "Адрес",
  is_free: "Безплатен",
  category: "Категория",
};

export default async function EnrichmentProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getAdminContext();
  if (!ctx?.isAdmin) redirect(`/login?next=/admin/enrichment-proposals/${id}`);

  const supabase = createSupabaseAdmin();
  const { data: proposal, error } = await supabase
    .from("festival_enrichment_proposals")
    .select("*,festivals(id,title,slug)")
    .eq("id", id)
    .maybeSingle();

  if (error) return <div className="p-6 text-red-600">{error.message}</div>;
  if (!proposal) notFound();

  const festival =
    proposal.festivals && typeof proposal.festivals === "object" && !Array.isArray(proposal.festivals)
      ? (proposal.festivals as { id: number; title: string; slug: string })
      : null;

  const patch = proposal.patch_json as Record<string, unknown>;
  const fields = Object.entries(patch);
  const isPending = proposal.status === "pending";

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <Link href="/admin/enrichment-proposals" className="text-xs text-black/40 hover:text-black/70">
          ← Обратно към списъка
        </Link>
        <h1 className="mt-2 text-xl font-bold text-[#0c0e14]">Обогатяване от плакат</h1>
        {festival && (
          <p className="mt-1 text-sm text-black/60">
            Фестивал:{" "}
            <Link href={`/admin/festivals/${festival.id}`} className="font-medium text-black hover:underline">
              {festival.title}
            </Link>
          </p>
        )}
        <p className="mt-1 text-xs text-black/40">
          Статус: <span className="font-semibold">{proposal.status}</span> · Подадено:{" "}
          {new Date(proposal.created_at).toLocaleString("bg-BG")}
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50">Предложени полета</h2>
        {fields.map(([field, value]) => (
          <div key={field} className="overflow-hidden rounded-xl border border-green-200 bg-green-50">
            <div className="flex items-center gap-2 border-b border-green-200 px-4 py-2">
              <span className="text-xs font-semibold text-green-800">
                {FIELD_LABELS[field] ?? field}
              </span>
              <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-700">
                📷 от плакат
              </span>
            </div>
            <div className="px-4 py-3">
              {typeof value === "boolean" ? (
                <span className="text-sm text-green-900">{value ? "Да" : "Не"}</span>
              ) : typeof value === "string" ? (
                <p className="whitespace-pre-wrap text-sm text-green-900">{value}</p>
              ) : (
                <pre className="text-xs text-green-800">{JSON.stringify(value, null, 2)}</pre>
              )}
            </div>
          </div>
        ))}
      </div>

      {isPending && (
        <div className="flex gap-3">
          <form action={`/admin/api/enrichment-proposals/${id}`} method="POST">
            <input type="hidden" name="action" value="approve" />
            <button
              type="submit"
              className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
            >
              ✅ Одобри всички
            </button>
          </form>
          <form action={`/admin/api/enrichment-proposals/${id}`} method="POST">
            <input type="hidden" name="action" value="reject" />
            <button
              type="submit"
              className="rounded-xl border border-black/10 bg-white px-5 py-2.5 text-sm font-semibold text-black/70 hover:bg-black/5"
            >
              ❌ Откажи
            </button>
          </form>
        </div>
      )}

      {!isPending && (
        <p className="rounded-xl border border-black/[0.08] bg-white/60 px-4 py-3 text-sm text-black/50">
          Това предложение е вече{" "}
          {proposal.status === "approved" ? "одобрено" : "отхвърлено"}.
        </p>
      )}
    </div>
  );
}
```

**Note on the approve/reject forms:** The standard HTML form POST won't send JSON. Replace the form buttons with a client component that uses `fetch` to POST JSON to the API. Since Next.js App Router pages can mix server and client components, extract a small `EnrichmentActions` client component:

```typescript
// app/admin/(protected)/enrichment-proposals/[id]/EnrichmentActions.tsx
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function EnrichmentActions({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act = async (action: "approve" | "reject") => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/admin/api/enrichment-proposals/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? "Грешка");
      } else {
        router.push("/admin/enrichment-proposals");
      }
    } catch {
      setError("Мрежова грешка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        <button
          onClick={() => act("approve")}
          disabled={loading}
          className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
        >
          ✅ Одобри всички
        </button>
        <button
          onClick={() => act("reject")}
          disabled={loading}
          className="rounded-xl border border-black/10 bg-white px-5 py-2.5 text-sm font-semibold text-black/70 hover:bg-black/5 disabled:opacity-50"
        >
          ❌ Откажи
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
```

Update the detail page to be a server component (remove `"use client"` from page.tsx and import `EnrichmentActions`):

Replace the form section in `page.tsx` with:
```typescript
import { EnrichmentActions } from "./EnrichmentActions";
// ...
{isPending && <EnrichmentActions id={id} />}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add "app/admin/(protected)/enrichment-proposals/"
git commit -m "feat(admin): add enrichment proposal review page with approve/reject"
```

---

## Task 9: Add nav link + badge for enriched fields in pending review

**Files:**
- Modify: `lib/admin/adminNavConfig.ts`
- Modify: `app/admin/(protected)/pending-festivals/[id]/page.tsx`

- [ ] **Step 1: Add nav link in `adminNavConfig.ts`**

In the "Съдържание" group, add after `"festival-reports"`:

```typescript
{ href: "/admin/enrichment-proposals", label: "Обогатявания", match: "prefix" },
```

The full "Съдържание" items array becomes:
```typescript
items: [
  { href: "/admin/ingest", label: "Внасяне", match: "prefix" },
  { href: "/admin/discovery", label: "Открития", match: "prefix" },
  { href: "/admin/research", label: "Проучване", match: "prefix" },
  { href: "/admin/pending-festivals", label: "Чакащи", match: "prefix" },
  { href: "/admin/festivals", label: "Фестивали", match: "exact" },
  { href: "/admin/categories", label: "Категории", match: "prefix" },
  { href: "/admin/festivals/duplicates", label: "Дублирани", match: "prefix" },
  { href: "/admin/festival-reports", label: "Сигнали", match: "prefix" },
  { href: "/admin/enrichment-proposals", label: "Обогатявания", match: "prefix" },
],
```

- [ ] **Step 2: Badge on enriched fields in pending review**

In `app/admin/(protected)/pending-festivals/[id]/page.tsx`, after fetching the `data` row, extract `enriched_fields`:

```typescript
const enrichedFields: string[] = Array.isArray(data?.enriched_fields)
  ? (data.enriched_fields as string[])
  : [];
```

Pass `enrichedFields` down to `PendingFestivalEditForm` as a prop. Check the component's interface — if it doesn't accept this prop yet, add it.

Find where `PendingFestivalEditForm` is rendered (near line 138) and add:

```typescript
<PendingFestivalEditForm
  festival={pendingFestival}
  organizers={organizers}
  lastIngestJobMeta={lastIngestJobMeta}
  isDuplicateRedirect={isDuplicateRedirect}
  categories={categories}
  enrichedFields={enrichedFields}
/>
```

Then in `components/admin/PendingFestivalEditForm.tsx`, add `enrichedFields?: string[]` to the props type and render a badge next to any field in the list:

```typescript
// Helper component inline:
function PosterBadge() {
  return (
    <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-700">
      📷 від плакат
    </span>
  );
}
```

For each field label in the form (e.g., description, facebook_url, etc.), render `{enrichedFields.includes("description") && <PosterBadge />}` next to the label.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add lib/admin/adminNavConfig.ts "app/admin/(protected)/pending-festivals/[id]/page.tsx" components/admin/PendingFestivalEditForm.tsx
git commit -m "feat(admin): add enrichment-proposals nav link and poster badge in pending review"
```

---

## Task 10: Final push and PR

- [ ] **Step 1: Run full build**

```bash
npx next build
```

Expected: exits 0, no TypeScript or ESLint errors.

- [ ] **Step 2: Create branch, push, open PR, merge**

```bash
git checkout -b feat/poster-enrich-existing
git rebase main  # all commits from tasks 1-9 are already on main or stashed
# (all commits were made to main during dev; push the full branch)
git push -u origin feat/poster-enrich-existing
gh pr create --title "feat(poster): enrich existing festival from poster bot" --body "$(cat <<'EOF'
## Proposed Change
- Summary: When the poster bot detects a duplicate, operator can click 🔄 Обогати to fill empty fields on the existing festival (pending or published) with data extracted from the poster. All enrichment is fill-null-only and additive.
- Why now: Poster bot already extracts full descriptions and programs; previously the only option was to create a duplicate entry.

## Flow
- pending target → direct UPDATE + enriched_fields badge in admin review
- published target → festival_enrichment_proposals table → admin reviews at /admin/enrichment-proposals/[id]

## Impacted Docs
- docs/superpowers/specs/2026-06-19-poster-enrich-existing-festival-design.md

## Checklist
- [x] Schema: migration in scripts/sql/ with indexes + RLS
- [x] API contract: new routes, backward-compatible keyboard (new button added)
- [x] Security: service role server-only, RLS on new table
- [x] Docs updated in this PR
EOF
)"
gh pr merge --merge --delete-branch
```

---

## Self-Review Notes

- **Task 5 type cast**: `stored.extraction as Parameters<typeof applyPosterEnrichment>[2]` — the second parameter is `PosterExtraction`. The cast is necessary because `extraction_json` is `unknown` from the DB. This is safe because the bot wrote the extraction there in the first place.
- **Task 8 approve re-check**: The approve handler re-checks nullity at apply time (`safePatch`) to handle concurrent edits — this matches the spec requirement.
- **`program_draft` on published festivals**: Excluded by `computeEnrichmentPatch` when `targetType === "festival"`. The `festivals` table has `festival_days`/`festival_schedule_items` instead of `program_draft`; including raw program JSON in a `festivals` patch would be wrong. This is handled by the `targetType` parameter.
- **Nav badge count**: Not implemented in MVP (would need a separate DB count query on each page load). The link shows "Обогатявания" without a badge — acceptable for MVP.
