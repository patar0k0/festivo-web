# Festival Duplicates: Fuzzy Detection + Merge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect near-duplicate festivals via token-based title matching and let an admin merge a duplicate pair (winner keeps its data + absorbs the loser's media/followers/empty fields; loser is archived, not deleted).

**Architecture:** Pure, unit-tested helpers in `lib/admin/` (duplicate detection + fill-null patch). A new admin service-role API route performs the merge (fill-null fields, additive transfer of media/organizers/followers/likes with dedup, repoint of stats, archive of loser). The duplicates page renders a client-side merge panel. One SQL migration adds `festivals.merged_into_festival_id`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (service-role client), Vitest (new, dev-only, for pure helpers), Tailwind.

---

## File Structure

**Create:**
- `vitest.config.ts` — minimal Vitest config (node env, `lib/**/*.test.ts`).
- `lib/admin/festivalDuplicates.ts` — pure: types + normalization + token containment + `buildDuplicateRows` (exact + fuzzy). Moved out of the page.
- `lib/admin/festivalMerge.ts` — pure: `MERGE_FILL_NULL_FIELDS`, `isEmpty`, `mergeTags`, `computeFillNullPatch`.
- `lib/admin/__tests__/festivalDuplicates.test.ts`
- `lib/admin/__tests__/festivalMerge.test.ts`
- `scripts/sql/20260618_festivals_merged_into.sql` — migration.
- `app/admin/api/festivals/merge/route.ts` — merge endpoint.

**Modify:**
- `package.json` — add `vitest` devDependency + `"test"` script.
- `app/admin/(protected)/festivals/duplicates/page.tsx` — import detection from `lib/admin/festivalDuplicates`; drop inlined logic.
- `components/admin/FestivalDuplicatesTable.tsx` — add merge panel (client) calling the new route.
- `CLAUDE.md` — note merge workflow + new column.

---

## Task 1: Vitest setup

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install vitest (dev-only)**

Run: `npm install -D vitest`
Expected: `vitest` appears under `devDependencies` in `package.json`.

- [ ] **Step 2: Add test script**

In `package.json`, inside `"scripts"`, add the `test` entry alongside the existing scripts:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start:prod": "next build && next start",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run"
  },
```

- [ ] **Step 3: Create vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 4: Verify the runner works (no tests yet)**

Run: `npm test`
Expected: Vitest runs and reports "No test files found" (exit may be non-zero); this only confirms the binary is wired up. Proceed to Task 2.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore(test): add vitest for pure helper unit tests"
```

---

## Task 2: Fuzzy duplicate detection (pure module + page refactor)

**Files:**
- Create: `lib/admin/festivalDuplicates.ts`
- Test: `lib/admin/__tests__/festivalDuplicates.test.ts`
- Modify: `app/admin/(protected)/festivals/duplicates/page.tsx`

- [ ] **Step 1: Write the failing test**

Create `lib/admin/__tests__/festivalDuplicates.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { titleContainment, buildDuplicateRows, type FestivalRow } from "../festivalDuplicates";

const A = 'Фолклорен танцов фестивал „С танците на дедите ни" 2026';
const B = 'Фолклорен фестивал „С танците на дедите ни" 2026';

describe("titleContainment", () => {
  it("matches near-duplicate with one extra word", () => {
    expect(titleContainment(A, B)).toBeGreaterThanOrEqual(0.8);
  });
  it("rejects unrelated titles", () => {
    expect(titleContainment("Бирен фест Варна", "Розобер Казанлък")).toBeLessThan(0.8);
  });
});

describe("buildDuplicateRows fuzzy", () => {
  const mk = (id: string, title: string): FestivalRow => ({
    id, title, slug: null, start_date: "2026-06-19", city_id: 5, city_name: "Димитровград", status: "verified",
  });

  it("finds the near-duplicate pair when city matches", () => {
    const pairs = buildDuplicateRows([mk("1", A), mk("2", B)]);
    expect(pairs.length).toBe(1);
    expect(pairs[0].reasons).toContain("близко заглавие");
  });

  it("does not pair near-titles in different cities with different dates", () => {
    const r1 = { ...mk("1", A), city_id: 5, start_date: "2026-06-19" };
    const r2 = { ...mk("2", B), city_id: 99, start_date: "2027-01-01" };
    expect(buildDuplicateRows([r1, r2]).length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `../festivalDuplicates`.

- [ ] **Step 3: Create the pure module**

Create `lib/admin/festivalDuplicates.ts`:

```ts
export type FestivalRow = {
  id: string;
  title: string | null;
  slug: string | null;
  start_date: string | null;
  city_id: number | null;
  city_name: string | null;
  status: string | null;
};

export type FestivalDuplicateRow = {
  left: FestivalRow;
  right: FestivalRow;
  reasons: string[];
};

const STOPWORDS = new Set(["на", "и", "за", "с", "в", "от", "до"]);

function pairKey(a: string, b: string) {
  return [a, b].sort().join(":");
}

/** Normalize title for matching: trim, strip quotes, collapse spaces, lowercase. */
export function normalizeTitleForMatch(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const clean = value
    .trim()
    .toLowerCase()
    .replace(/[„"'"«»]/g, "")
    .replace(/\s+/g, " ");
  return clean || null;
}

function tokenizeTitle(value: string | null | undefined): string[] {
  const norm = normalizeTitleForMatch(value);
  if (!norm) return [];
  return norm
    .split(" ")
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

/** Containment = |A ∩ B| / min(|A|, |B|); 0 unless both have >= 2 tokens. */
export function titleContainment(a: string | null | undefined, b: string | null | undefined): number {
  const ta = new Set(tokenizeTitle(a));
  const tb = new Set(tokenizeTitle(b));
  if (ta.size < 2 || tb.size < 2) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / Math.min(ta.size, tb.size);
}

export function buildDuplicateRows(rows: FestivalRow[]): FestivalDuplicateRow[] {
  const byPair = new Map<string, FestivalDuplicateRow>();

  const add = (left: FestivalRow, right: FestivalRow, reason: string) => {
    if (left.id === right.id) return;
    const key = pairKey(left.id, right.id);
    const existing = byPair.get(key);
    if (existing) {
      if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
      return;
    }
    const [a, b] = left.id < right.id ? [left, right] : [right, left];
    byPair.set(key, { left: a, right: b, reasons: [reason] });
  };

  type BucketKeyFn = (row: FestivalRow) => string | null;

  const bucketize = (keyFn: BucketKeyFn, reason: string) => {
    const buckets = new Map<string, FestivalRow[]>();
    for (const row of rows) {
      const key = keyFn(row);
      if (!key) continue;
      const list = buckets.get(key) ?? [];
      list.push(row);
      buckets.set(key, list);
    }
    for (const bucketRows of buckets.values()) {
      if (bucketRows.length < 2) continue;
      for (let i = 0; i < bucketRows.length; i++) {
        for (let j = i + 1; j < bucketRows.length; j++) {
          add(bucketRows[i], bucketRows[j], reason);
        }
      }
    }
  };

  // Exact signals (unchanged behavior).
  bucketize((row) => normalizeTitleForMatch(row.title), "еднакво заглавие");
  bucketize((row) => (row.slug ? row.slug.trim().toLowerCase() : null), "еднакъв slug");
  bucketize((row) => {
    const t = normalizeTitleForMatch(row.title);
    return t && row.start_date ? `${t}|${row.start_date}` : null;
  }, "еднакво заглавие + начална дата");
  bucketize((row) => {
    const t = normalizeTitleForMatch(row.title);
    return t && row.city_id ? `${t}|${row.city_id}` : null;
  }, "еднакво заглавие + град");
  bucketize((row) => {
    const t = normalizeTitleForMatch(row.title);
    return t && row.start_date && row.city_id ? `${t}|${row.start_date}|${row.city_id}` : null;
  }, "еднакво заглавие + дата + град");

  // Fuzzy pass: pairwise, gated by same city OR same start_date to bound cost/false positives.
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i];
      const b = rows[j];
      const na = normalizeTitleForMatch(a.title);
      const nb = normalizeTitleForMatch(b.title);
      if (na && nb && na === nb) continue; // already covered by exact signals
      const sameGate =
        (a.city_id != null && a.city_id === b.city_id) ||
        (!!a.start_date && a.start_date === b.start_date);
      if (!sameGate) continue;
      if (titleContainment(a.title, b.title) >= 0.8) add(a, b, "близко заглавие");
    }
  }

  return Array.from(byPair.values()).sort((a, b) => {
    if (b.reasons.length !== a.reasons.length) return b.reasons.length - a.reasons.length;
    return (a.left.title ?? "").localeCompare(b.left.title ?? "", "bg-BG");
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all tests in `festivalDuplicates.test.ts` green.

- [ ] **Step 5: Refactor the page to use the module**

In `app/admin/(protected)/festivals/duplicates/page.tsx`:

Replace the block from the `type FestivalRow = {` declaration (line ~7) through the end of `buildDuplicateRows` (line ~114) with a single import at the top of the file (after the existing imports):

```ts
import { buildDuplicateRows, type FestivalRow, type FestivalDuplicateRow } from "@/lib/admin/festivalDuplicates";
```

Keep the rest of the page (the `FestivalDuplicatesPage` component) unchanged — it already calls `buildDuplicateRows(rows)` and maps the query into `FestivalRow[]`. Update the export used by the table component: the table imports `FestivalDuplicateRow` from the page; change that import in the next task. For now, re-export the type from the page so nothing breaks:

```ts
export type { FestivalDuplicateRow } from "@/lib/admin/festivalDuplicates";
```

- [ ] **Step 6: Verify build/types**

Run: `npx tsc --noEmit`
Expected: No new type errors from these files.

- [ ] **Step 7: Commit**

```bash
git add lib/admin/festivalDuplicates.ts lib/admin/__tests__/festivalDuplicates.test.ts "app/admin/(protected)/festivals/duplicates/page.tsx"
git commit -m "feat(admin): fuzzy (token-containment) festival duplicate detection"
```

---

## Task 3: Fill-null merge helpers (pure)

**Files:**
- Create: `lib/admin/festivalMerge.ts`
- Test: `lib/admin/__tests__/festivalMerge.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/admin/__tests__/festivalMerge.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeFillNullPatch, mergeTags } from "../festivalMerge";

describe("mergeTags", () => {
  it("unions preserving winner order then new loser tags", () => {
    expect(mergeTags(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
  });
  it("ignores non-arrays", () => {
    expect(mergeTags(null, ["a"])).toEqual(["a"]);
  });
});

describe("computeFillNullPatch", () => {
  it("fills empty winner fields from loser, never overwrites", () => {
    const winner = { description: "", website_url: null, ticket_url: "http://w", tags: ["a"] };
    const loser = { description: "desc", website_url: "http://l", ticket_url: "http://l2", tags: ["a", "b"] };
    const patch = computeFillNullPatch(winner, loser);
    expect(patch.description).toBe("desc");
    expect(patch.website_url).toBe("http://l");
    expect(patch.ticket_url).toBeUndefined();
    expect(patch.tags).toEqual(["a", "b"]);
  });
  it("omits tags when loser adds nothing new", () => {
    const patch = computeFillNullPatch({ tags: ["a", "b"] }, { tags: ["a"] });
    expect(patch.tags).toBeUndefined();
  });
  it("omits a field when loser is also empty", () => {
    const patch = computeFillNullPatch({ description: "" }, { description: "  " });
    expect(patch.description).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `../festivalMerge`.

- [ ] **Step 3: Implement the helpers**

Create `lib/admin/festivalMerge.ts`:

```ts
/**
 * Winner-authoritative festival columns that may be back-filled from the loser
 * when empty on the winner. Excludes identity/moderation fields
 * (title, slug, city_id, category, start_date, status, source_url, verification_*).
 */
export const MERGE_FILL_NULL_FIELDS = [
  "description",
  "website_url",
  "ticket_url",
  "price_range",
  "hero_image",
  "image_url",
  "video_url",
  "latitude",
  "longitude",
  "place_id",
  "geocode_provider",
  "address",
  "organizer_name",
  "end_date",
  "start_time",
  "end_time",
  "occurrence_dates",
] as const;

export type FestivalLike = Record<string, unknown>;

export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function mergeTags(winnerTags: unknown, loserTags: unknown): string[] {
  const w = Array.isArray(winnerTags) ? winnerTags.filter((t): t is string => typeof t === "string") : [];
  const l = Array.isArray(loserTags) ? loserTags.filter((t): t is string => typeof t === "string") : [];
  const out = [...w];
  for (const t of l) if (!out.includes(t)) out.push(t);
  return out;
}

/** Returns only the columns to update on the winner (fill-null + tag union). */
export function computeFillNullPatch(winner: FestivalLike, loser: FestivalLike): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const field of MERGE_FILL_NULL_FIELDS) {
    if (isEmpty(winner[field]) && !isEmpty(loser[field])) {
      patch[field] = loser[field];
    }
  }
  const mergedTags = mergeTags(winner.tags, loser.tags);
  const winnerTagCount = Array.isArray(winner.tags) ? winner.tags.length : 0;
  if (mergedTags.length > winnerTagCount) patch.tags = mergedTags;
  return patch;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/festivalMerge.ts lib/admin/__tests__/festivalMerge.test.ts
git commit -m "feat(admin): fill-null merge patch helpers for festival merge"
```

---

## Task 4: Migration — `merged_into_festival_id`

**Files:**
- Create: `scripts/sql/20260618_festivals_merged_into.sql`

- [ ] **Step 1: Write the migration**

Create `scripts/sql/20260618_festivals_merged_into.sql`:

```sql
-- Festival merge: archived loser points to the winner it was merged into.
-- Audit + future 301 redirect from the archived slug.

alter table public.festivals
  add column if not exists merged_into_festival_id uuid
  references public.festivals(id) on delete set null;

create index if not exists festivals_merged_into_idx
  on public.festivals (merged_into_festival_id)
  where merged_into_festival_id is not null;

comment on column public.festivals.merged_into_festival_id is
  'When set: this festival was merged into the referenced festival and archived.';
```

- [ ] **Step 2: Apply the migration to Supabase**

Apply via the Supabase MCP `apply_migration` tool (name `festivals_merged_into`) or paste the SQL in the Supabase SQL editor. Do not assume it is auto-applied.
Expected: `festivals.merged_into_festival_id` exists; `festivals_merged_into_idx` created.

- [ ] **Step 3: Commit**

```bash
git add scripts/sql/20260618_festivals_merged_into.sql
git commit -m "chore(db): add festivals.merged_into_festival_id for merge"
```

---

## Task 5: Merge API route

**Files:**
- Create: `app/admin/api/festivals/merge/route.ts`

- [ ] **Step 1: Implement the route**

Create `app/admin/api/festivals/merge/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction } from "@/lib/admin/audit-log";
import { computeFillNullPatch, MERGE_FILL_NULL_FIELDS } from "@/lib/admin/festivalMerge";
import type { SupabaseClient } from "@supabase/supabase-js";

type MergeBody = { winnerId?: unknown; loserId?: unknown };

// Columns needed to compute the fill-null patch.
const MERGE_SELECT = `id,status,merged_into_festival_id,tags,${MERGE_FILL_NULL_FIELDS.join(",")}`;

/** Move loser rows of a (user_id, festival_id) PK table to winner, dedup on user_id. */
async function transferUserScoped(
  svc: SupabaseClient,
  table: string,
  winnerId: string,
  loserId: string,
) {
  const { data: winnerRows } = await svc.from(table).select("user_id").eq("festival_id", winnerId);
  const winnerUsers = new Set((winnerRows ?? []).map((r) => (r as { user_id: string }).user_id));
  const { data: loserRows } = await svc.from(table).select("user_id").eq("festival_id", loserId);
  for (const row of loserRows ?? []) {
    const userId = (row as { user_id: string }).user_id;
    if (winnerUsers.has(userId)) {
      await svc.from(table).delete().eq("festival_id", loserId).eq("user_id", userId);
    } else {
      await svc.from(table).update({ festival_id: winnerId }).eq("festival_id", loserId).eq("user_id", userId);
      winnerUsers.add(userId);
    }
  }
}

export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as MergeBody | null;
  const winnerId = typeof body?.winnerId === "string" ? body.winnerId : null;
  const loserId = typeof body?.loserId === "string" ? body.loserId : null;

  if (!winnerId || !loserId) {
    return NextResponse.json({ ok: false, error: "winnerId and loserId are required." }, { status: 400 });
  }
  if (winnerId === loserId) {
    return NextResponse.json({ ok: false, error: "Cannot merge a festival into itself." }, { status: 400 });
  }

  const svc = createSupabaseAdmin();

  const { data: festivals, error: loadErr } = await svc
    .from("festivals")
    .select(MERGE_SELECT)
    .in("id", [winnerId, loserId]);

  if (loadErr) {
    return NextResponse.json({ ok: false, error: `Load failed: ${loadErr.message}` }, { status: 500 });
  }

  const winner = (festivals ?? []).find((f) => (f as { id: string }).id === winnerId) as Record<string, unknown> | undefined;
  const loser = (festivals ?? []).find((f) => (f as { id: string }).id === loserId) as Record<string, unknown> | undefined;

  if (!winner || !loser) {
    return NextResponse.json({ ok: false, error: "Both festivals must exist." }, { status: 404 });
  }
  if (loser.status === "archived" || loser.merged_into_festival_id) {
    return NextResponse.json({ ok: false, error: "Loser is already archived or merged." }, { status: 409 });
  }

  // 1. Fill-null patch onto winner (never overwrites existing values).
  const patch = computeFillNullPatch(winner, loser);
  if (Object.keys(patch).length > 0) {
    const { error } = await svc.from("festivals").update(patch).eq("id", winnerId);
    if (error) {
      return NextResponse.json({ ok: false, error: `Winner update failed: ${error.message}` }, { status: 500 });
    }
  }

  // 2. Media — additive, dedup by url, appended after winner's max sort_order.
  const { data: winnerMedia } = await svc.from("festival_media").select("url").eq("festival_id", winnerId);
  const winnerUrls = new Set((winnerMedia ?? []).map((m) => (m as { url: string }).url));
  const { data: maxRow } = await svc
    .from("festival_media").select("sort_order").eq("festival_id", winnerId)
    .order("sort_order", { ascending: false }).limit(1).maybeSingle();
  let nextSort = ((maxRow as { sort_order: number } | null)?.sort_order ?? -1) + 1;
  const { data: loserMedia } = await svc.from("festival_media").select("id,url").eq("festival_id", loserId);
  for (const m of loserMedia ?? []) {
    const row = m as { id: string; url: string };
    if (winnerUrls.has(row.url)) {
      await svc.from("festival_media").delete().eq("id", row.id);
    } else {
      await svc.from("festival_media").update({ festival_id: winnerId, sort_order: nextSort++ }).eq("id", row.id);
      winnerUrls.add(row.url);
    }
  }

  // 3. Organizers (m2m) — additive, dedup on organizer_id.
  const { data: winnerOrgs } = await svc.from("festival_organizers").select("organizer_id").eq("festival_id", winnerId);
  const winnerOrgIds = new Set((winnerOrgs ?? []).map((o) => (o as { organizer_id: string }).organizer_id));
  const { data: loserOrgs } = await svc.from("festival_organizers").select("organizer_id").eq("festival_id", loserId);
  for (const o of loserOrgs ?? []) {
    const orgId = (o as { organizer_id: string }).organizer_id;
    if (winnerOrgIds.has(orgId)) {
      await svc.from("festival_organizers").delete().eq("festival_id", loserId).eq("organizer_id", orgId);
    } else {
      await svc.from("festival_organizers").update({ festival_id: winnerId }).eq("festival_id", loserId).eq("organizer_id", orgId);
      winnerOrgIds.add(orgId);
    }
  }

  // 4. Followers / likes — additive, dedup on user_id.
  await transferUserScoped(svc, "user_plan_festivals", winnerId, loserId);
  await transferUserScoped(svc, "festival_likes", winnerId, loserId);

  // 5. Transient notification artifacts — delete loser's (regenerated by schedulers from moved plans).
  await svc.from("user_notifications").delete().eq("festival_id", loserId);
  await svc.from("user_plan_reminders").delete().eq("festival_id", loserId);
  await svc.from("notification_jobs").delete().eq("festival_id", loserId);

  // 6. Stats — repoint to winner (no unique constraints).
  await svc.from("outbound_clicks").update({ festival_id: winnerId }).eq("festival_id", loserId);
  await svc.from("analytics_events").update({ festival_id: winnerId }).eq("festival_id", loserId);
  await svc.from("festival_reports").update({ festival_id: winnerId }).eq("festival_id", loserId);

  // 7. Program — fill-null: move loser's days (items follow via day_id) only if winner has none.
  const { data: winnerDays } = await svc.from("festival_days").select("id").eq("festival_id", winnerId).limit(1);
  if (!winnerDays || winnerDays.length === 0) {
    await svc.from("festival_days").update({ festival_id: winnerId }).eq("festival_id", loserId);
  }

  // 8. Archive loser (recoverable; not deleted).
  const { error: archiveErr } = await svc
    .from("festivals")
    .update({ status: "archived", merged_into_festival_id: winnerId, updated_at: new Date().toISOString() })
    .eq("id", loserId);
  if (archiveErr) {
    return NextResponse.json({ ok: false, error: `Archive failed: ${archiveErr.message}` }, { status: 500 });
  }

  try {
    await logAdminAction({
      actor_user_id: ctx.user.id,
      action: "festival.merged",
      entity_type: "festival",
      entity_id: winnerId,
      route: "/admin/api/festivals/merge",
      method: "POST",
      details: { winner_id: winnerId, loser_id: loserId, filled_fields: Object.keys(patch) },
    });
  } catch (auditError) {
    const message = auditError instanceof Error ? auditError.message : "unknown";
    console.error("[admin/audit] festival.merged failed", { message });
  }

  return NextResponse.json({ ok: true, winner_id: winnerId, redirect_to: `/admin/festivals/${winnerId}` });
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: No new type errors. If `getAdminContext` field names differ (`ctx.user.id`, `ctx.isAdmin`), confirm against `app/admin/api/pending-festivals/[id]/approve/route.ts` which uses the same `getAdminContext()` shape, and against `lib/admin/audit-log.ts` for `logAdminAction` field names — match them exactly.

- [ ] **Step 3: Commit**

```bash
git add app/admin/api/festivals/merge/route.ts
git commit -m "feat(admin): festival merge API (fill-null + transfer + archive loser)"
```

---

## Task 6: Merge UI in duplicates table

**Files:**
- Modify: `components/admin/FestivalDuplicatesTable.tsx`

- [ ] **Step 1: Update the type import**

At the top of `components/admin/FestivalDuplicatesTable.tsx`, change:

```ts
import type { FestivalDuplicateRow } from "@/app/admin/(protected)/festivals/duplicates/page";
```

to:

```ts
import type { FestivalDuplicateRow } from "@/lib/admin/festivalDuplicates";
```

- [ ] **Step 2: Add router + state imports**

Replace the existing import block at the top (the `"use client"` line stays first) so the file imports `useState` and `useRouter`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { FestivalDuplicateRow } from "@/lib/admin/festivalDuplicates";
```

- [ ] **Step 3: Add the merge panel to each pair**

In the `FestivalDuplicatesTable` component, replace the `{rows.map((row) => { ... })}` body so each pair renders a `MergePair` component (defined below). Replace the whole returned `<div className="space-y-3"> ... </div>` block (the `rows.map`) with:

```tsx
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <MergePair key={`${row.left.id}:${row.right.id}`} row={row} />
      ))}
    </div>
  );
}

function MergePair({ row }: { row: FestivalDuplicateRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [winnerId, setWinnerId] = useState<string>(suggestWinner(row));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loserId = winnerId === row.left.id ? row.right.id : row.left.id;

  async function doMerge() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/admin/api/festivals/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winnerId, loserId }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Сливането се провали.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Мрежова грешка.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-4">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {row.reasons.map((r) => (
          <span key={r} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${SIGNAL_COLORS[r] ?? "bg-gray-100 text-gray-600"}`}>
            {r}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <FestivalCard fest={row.left} />
        <FestivalCard fest={row.right} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-black/[0.06] pt-3">
        <Link href={`/admin/festivals/${row.left.id}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-black/[0.12] bg-white px-3 py-1.5 text-xs font-semibold hover:bg-[#f7f6f3]">
          Редактирай #1
        </Link>
        <Link href={`/admin/festivals/${row.right.id}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-black/[0.12] bg-white px-3 py-1.5 text-xs font-semibold hover:bg-[#f7f6f3]">
          Редактирай #2
        </Link>
        <button type="button" onClick={() => setOpen((v) => !v)} className="rounded-lg border border-black/[0.12] bg-[#0c0e14] px-3 py-1.5 text-xs font-semibold text-white hover:bg-black">
          Слей
        </button>
      </div>

      {open && (
        <div className="mt-3 rounded-xl border border-black/[0.1] bg-[#fafaf8] p-3 text-sm">
          <p className="mb-2 font-semibold">Кой запис да остане (победител)?</p>
          <div className="flex flex-col gap-1.5">
            {[row.left, row.right].map((f) => (
              <label key={f.id} className="flex items-center gap-2">
                <input type="radio" name={`winner-${row.left.id}-${row.right.id}`} checked={winnerId === f.id} onChange={() => setWinnerId(f.id)} />
                <span>{f.title ?? "(без заглавие)"} <span className="text-black/40">· {f.status ?? "—"}</span></span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-black/55">
            Снимки, програма, организатори и последователи се прехвърлят към избрания.
            Празните му полета се допълват от другия. Другият се архивира (не се трие).
          </p>
          {error && <p className="mt-2 text-[12px] font-medium text-[#b13a1a]">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={busy} onClick={doMerge} className="rounded-lg bg-[#0c0e14] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
              {busy ? "Сливане…" : "Потвърди сливане"}
            </button>
            <button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded-lg border border-black/[0.12] bg-white px-3 py-1.5 text-xs font-semibold">
              Откажи
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Default winner: verified over non-verified, then earlier start_date. */
function suggestWinner(row: FestivalDuplicateRow): string {
  const score = (s: string | null) => (s === "verified" ? 2 : s === "published" ? 1 : 0);
  const sl = score(row.left.status);
  const sr = score(row.right.status);
  if (sl !== sr) return sl > sr ? row.left.id : row.right.id;
  const dl = row.left.start_date ?? "9999";
  const dr = row.right.start_date ?? "9999";
  return dl <= dr ? row.left.id : row.right.id;
}
```

Keep the existing `STATUS_COLORS`, `StatusBadge`, `FestivalCard`, `SIGNAL_COLORS`, and the empty-state early return (`if (rows.length === 0)`) unchanged — `MergePair` reuses `FestivalCard` and `SIGNAL_COLORS`.

- [ ] **Step 4: Verify types/build**

Run: `npx tsc --noEmit`
Expected: No new type errors.

- [ ] **Step 5: Commit**

```bash
git add components/admin/FestivalDuplicatesTable.tsx
git commit -m "feat(admin): merge panel for duplicate festival pairs"
```

---

## Task 7: Docs

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Document the merge workflow + column**

In `CLAUDE.md`, under the **Content moderation flow** section, append a short subsection after the existing flow block:

```md
### Festival merge

Admin merges near-duplicate festivals at `/admin/festivals/duplicates`:
- Detection: exact signals + token-containment fuzzy match (`lib/admin/festivalDuplicates.ts`).
- Merge: `POST /admin/api/festivals/merge` — winner keeps its values, empty fields back-filled from loser (`computeFillNullPatch`), media/organizers/followers/likes transferred with dedup, program moved only if winner has none, stats repointed; loser set to `status=archived` with `festivals.merged_into_festival_id` pointing to the winner (recoverable, never deleted).
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document festival merge workflow and merged_into column"
```

---

## Final: PR

- [ ] **Run the full test + type check**

Run: `npm test && npx tsc --noEmit`
Expected: All unit tests pass; no new type errors.

- [ ] **Push and open PR**

```bash
git push -u origin feat/festival-duplicates-merge
gh pr create --title "feat(admin): fuzzy duplicate detection + festival merge" --body "Adds token-containment fuzzy duplicate detection and an admin merge flow (fill-null fields, additive media/followers transfer, loser archived). Migration: festivals.merged_into_festival_id."
```

- [ ] **Manual verification in prod admin** (UI is auth + service-role gated; no local preview): on `/admin/festivals/duplicates` confirm the „танцов" pair appears with „близко заглавие", merge with a chosen winner, then verify the loser is archived and the winner has the combined media/followers.

---

## Notes on atomicity

supabase-js has no cross-statement transaction here. Steps run child-first, archive-last: if a step fails mid-way the loser stays visible (not archived) and the operation can be re-run — already-moved rows are idempotent (dedup sets / `merged_into` guard). This is acceptable for a low-frequency admin action; document it rather than introducing an RPC unless merges prove flaky.
