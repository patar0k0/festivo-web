# Cities Region Disambiguation Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the database and the existing `/admin/cities` admin editor hold two settlements with the same name distinguished by `region`, and let admins edit `region` per row — without touching the automated city-resolution logic, which has no regional signal to disambiguate with today.

**Architecture:** A SQL migration relaxes the `cities.name_bg` unique constraint to a compound `(name_bg, region)` constraint. `PATCH /admin/api/cities` (already built in a prior feature) is extended to also accept an optional `region` field alongside the existing `is_village` field, with its own validation and audit-log entry. `CitiesManager.tsx` (the existing admin table) gets a new "Регион" column with a text input + explicit save button per row, sharing the row's pending/error state with the existing tri-state type toggle.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (service-role client via `createSupabaseAdmin`), Vitest, Supabase MCP (for applying the migration to the live database).

---

### Task 1: SQL migration — relax the cities name uniqueness constraint

**Files:**
- Create: `scripts/sql/20260626_cities_name_region_unique.sql`

This task only writes the migration file. Applying it to the live database is a separate, explicit step performed by the controller (not a subagent) via the Supabase MCP `execute_sql` tool, because it's a production DDL change — see the note at the end of this task.

- [ ] **Step 1: Write the migration file**

Create `scripts/sql/20260626_cities_name_region_unique.sql`:

```sql
-- Relax cities.name_bg uniqueness to (name_bg, region), so two settlements that
-- share a name in different municipalities can eventually coexist once an admin
-- (or future tooling) assigns them distinct `region` values. `slug` stays globally
-- unique unchanged — it's the URL path component and must not collide regardless
-- of region.
--
-- This does NOT change automated city-resolution behavior: resolveOrCreateCity()
-- and resolveCityReference() both look up by slug (derived from name alone) before
-- ever attempting an insert, so they will still find an existing same-named city
-- first and never reach a path that needs this looser constraint. This migration
-- only unblocks a future *manual* insert of a second same-named row with a
-- distinct region (e.g. via Supabase MCP, once a real collision is reported).
--
-- Safe to run as-is: all 262 existing rows have region = NULL today, so dropping
-- and re-adding the constraint has nothing to reconcile.

alter table public.cities drop constraint if exists cities_name_bg_key;
alter table public.cities add constraint cities_name_region_key unique (name_bg, region);
```

- [ ] **Step 2: Commit the migration file**

```bash
git add scripts/sql/20260626_cities_name_region_unique.sql
git commit -m "chore(db): relax cities name uniqueness to (name_bg, region)"
```

- [ ] **Step 3 (controller only, not part of subagent dispatch): Apply to the live database**

After this task's commit lands, the controller runs the migration against the live Supabase project (`hpvfsdmpatgceohigswm`) using the Supabase MCP `execute_sql` tool with the exact SQL from Step 1 (the two `alter table` statements), then verifies:

```sql
select conname, pg_get_constraintdef(oid) as def
from pg_constraint
where conrelid = 'public.cities'::regclass;
```

Expected: `cities_name_bg_key` is gone, `cities_name_region_key` is present with definition `UNIQUE (name_bg, region)`, `cities_slug_key` is unchanged.

---

### Task 2: Extend `PATCH /admin/api/cities` to accept `region`

**Files:**
- Modify: `app/admin/api/cities/route.ts`
- Modify: `app/admin/api/cities/route.test.ts`

The current `PATCH` handler (lines 36-92 of `route.ts`) only accepts `{ id, is_village }`. This task makes `is_village` and `region` both optional, requiring at least one, and renames the audit `action` from `"update_is_village"` to the now-more-accurate `"update_city"`.

- [ ] **Step 1: Write the failing tests**

In `app/admin/api/cities/route.test.ts`, first update the existing happy-path test (currently around line 106-129) — change its audit-log assertion from `action: "update_is_village"` to `action: "update_city"`:

```typescript
  it("updates is_village, logs the audit action, and returns 200 on success", async () => {
    mockGetAdminContext.mockResolvedValue(adminCtx());
    const updateEq = vi.fn(() => Promise.resolve({ error: null }));
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: { id: 1, is_village: false }, error: null }),
        }),
      }),
      update: () => ({ eq: updateEq }),
    });

    const res = await PATCH(patchRequest({ id: 1, is_village: true }));
    expect(res.status).toBe(200);
    expect(updateEq).toHaveBeenCalledWith("id", 1);
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "update_city",
        entity_type: "city",
        entity_id: "1",
        details: { is_village: { from: false, to: true } },
      }),
    );
  });
```

Note the `details` shape also changed: it's now `{ is_village: { from, to } }` (nested under the field name) instead of the old flat `{ from, to }`, because `details` must be able to carry either or both fields.

Then append these new tests inside the same `describe("PATCH /admin/api/cities", ...)` block, after the last existing test (`"returns 500 when the update fails"`):

```typescript
  it("returns 400 when neither is_village nor region is present", async () => {
    mockGetAdminContext.mockResolvedValue(adminCtx());
    const res = await PATCH(patchRequest({ id: 1 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when region is not a string or null", async () => {
    mockGetAdminContext.mockResolvedValue(adminCtx());
    const res = await PATCH(patchRequest({ id: 1, region: 42 }));
    expect(res.status).toBe(400);
  });

  it("updates only region, logs audit details with only region, and returns 200", async () => {
    mockGetAdminContext.mockResolvedValue(adminCtx());
    const updateEq = vi.fn(() => Promise.resolve({ error: null }));
    let updatePayload: unknown;
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: { id: 1, is_village: false, region: null }, error: null }),
        }),
      }),
      update: (payload: unknown) => {
        updatePayload = payload;
        return { eq: updateEq };
      },
    });

    const res = await PATCH(patchRequest({ id: 1, region: "обл. Пловдив" }));
    expect(res.status).toBe(200);
    expect(updatePayload).toEqual({ region: "обл. Пловдив" });
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "update_city",
        details: { region: { from: null, to: "обл. Пловдив" } },
      }),
    );
  });

  it("normalizes an empty-string region to null", async () => {
    mockGetAdminContext.mockResolvedValue(adminCtx());
    const updateEq = vi.fn(() => Promise.resolve({ error: null }));
    let updatePayload: unknown;
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: { id: 1, is_village: false, region: "обл. Пловдив" },
              error: null,
            }),
        }),
      }),
      update: (payload: unknown) => {
        updatePayload = payload;
        return { eq: updateEq };
      },
    });

    const res = await PATCH(patchRequest({ id: 1, region: "" }));
    expect(res.status).toBe(200);
    expect(updatePayload).toEqual({ region: null });
  });

  it("updates both is_village and region in one call, with both in audit details", async () => {
    mockGetAdminContext.mockResolvedValue(adminCtx());
    const updateEq = vi.fn(() => Promise.resolve({ error: null }));
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: { id: 1, is_village: false, region: null }, error: null }),
        }),
      }),
      update: () => ({ eq: updateEq }),
    });

    const res = await PATCH(patchRequest({ id: 1, is_village: true, region: "обл. Враца" }));
    expect(res.status).toBe(200);
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "update_city",
        details: {
          is_village: { from: false, to: true },
          region: { from: null, to: "обл. Враца" },
        },
      }),
    );
  });
```

- [ ] **Step 2: Run tests to verify the new/changed ones fail**

Run: `npx vitest run app/admin/api/cities/route.test.ts`
Expected: FAIL — the modified happy-path test fails on the `action`/`details` shape mismatch; the 4 new tests fail because `PATCH` doesn't yet validate/handle `region`.

- [ ] **Step 3: Rewrite the `PATCH` handler**

Replace the entire `PatchCityBody` type and `PATCH` function (currently lines 36-92) in `app/admin/api/cities/route.ts` with:

```typescript
type PatchCityBody = {
  id?: unknown;
  is_village?: unknown;
  region?: unknown;
};

function normalizeRegionInput(value: unknown): { ok: true; region: string | null } | { ok: false } {
  if (value === null) return { ok: true, region: null };
  if (typeof value !== "string") return { ok: false };
  const trimmed = value.trim();
  return { ok: true, region: trimmed === "" ? null : trimmed };
}

export async function PATCH(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as PatchCityBody | null;
  const id = typeof body?.id === "number" && Number.isFinite(body.id) ? body.id : null;
  if (id === null) {
    return NextResponse.json({ error: "id трябва да е число" }, { status: 400 });
  }

  const hasIsVillage = body?.is_village !== undefined;
  const hasRegion = body?.region !== undefined;
  if (!hasIsVillage && !hasRegion) {
    return NextResponse.json({ error: "Няма какво да се обнови" }, { status: 400 });
  }

  let is_village: boolean | null | undefined;
  if (hasIsVillage) {
    const v = body?.is_village;
    if (v !== true && v !== false && v !== null) {
      return NextResponse.json(
        { error: "is_village трябва да е true, false или null" },
        { status: 400 },
      );
    }
    is_village = v;
  }

  let region: string | null | undefined;
  if (hasRegion) {
    const normalized = normalizeRegionInput(body?.region);
    if (!normalized.ok) {
      return NextResponse.json({ error: "region трябва да е текст или null" }, { status: 400 });
    }
    region = normalized.region;
  }

  const admin = createSupabaseAdmin();

  const { data: existing, error: readError } = await admin
    .from("cities")
    .select("id,is_village,region")
    .eq("id", id)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Населеното място не е намерено" }, { status: 404 });
  }

  const updatePayload: { is_village?: boolean | null; region?: string | null } = {};
  if (hasIsVillage) updatePayload.is_village = is_village;
  if (hasRegion) updatePayload.region = region;

  const { error: updateError } = await admin.from("cities").update(updatePayload).eq("id", id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const details: Record<string, { from: unknown; to: unknown }> = {};
  if (hasIsVillage) details.is_village = { from: existing.is_village, to: is_village };
  if (hasRegion) details.region = { from: existing.region, to: region };

  await logAdminAction({
    actor_user_id: ctx.user.id,
    action: "update_city",
    entity_type: "city",
    entity_id: String(id),
    route: "/admin/api/cities",
    method: "PATCH",
    details,
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run app/admin/api/cities/route.test.ts`
Expected: PASS, 14 tests total in this file (3 GET tests, unchanged; 11 PATCH tests — the 6 existing ones, with the happy-path one updated in place, plus 5 new ones from Step 1). Trust the test runner's printed summary line over hand-counting.

- [ ] **Step 5: Run the project typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/admin/api/cities/route.ts app/admin/api/cities/route.test.ts
git commit -m "feat(admin): allow PATCH /admin/api/cities to also update region"
```

---

### Task 3: Add a "Регион" column to `CitiesManager`

**Files:**
- Modify: `components/admin/CitiesManager.tsx`

No new test file — matches the existing convention for this component (no unit/UI test).

This task replaces `setIsVillage`'s inline fetch logic with a shared `patchCity` helper (used by both the existing type toggle and the new region save button), and adds a new table column with a text input + save button per row.

- [ ] **Step 1: Replace the component body**

Replace the entire contents of `components/admin/CitiesManager.tsx` with:

```tsx
"use client";

import { useMemo, useState } from "react";
import type { AdminCityRow } from "@/app/admin/api/cities/route";

type FilterKind = "all" | "city" | "village" | "none";

const FILTERS: { key: FilterKind; label: string }[] = [
  { key: "all", label: "Всички" },
  { key: "city", label: "Град" },
  { key: "village", label: "Село" },
  { key: "none", label: "Без тип" },
];

function matchesFilter(row: AdminCityRow, filter: FilterKind): boolean {
  if (filter === "all") return true;
  if (filter === "city") return row.is_village === false;
  if (filter === "village") return row.is_village === true;
  return row.is_village === null;
}

export default function CitiesManager({ initial }: { initial: AdminCityRow[] }) {
  const [cities, setCities] = useState<AdminCityRow[]>(initial);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKind>("all");
  const [errorById, setErrorById] = useState<Record<number, string>>({});
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());
  const [regionDrafts, setRegionDrafts] = useState<Record<number, string>>(() =>
    Object.fromEntries(initial.map((c) => [c.id, c.region ?? ""])),
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("bg-BG");
    return cities.filter((c) => {
      if (!matchesFilter(c, filter)) return false;
      if (!q) return true;
      return (
        c.name_bg.toLocaleLowerCase("bg-BG").includes(q) ||
        c.slug.toLocaleLowerCase("bg-BG").includes(q)
      );
    });
  }, [cities, query, filter]);

  async function patchCity(
    id: number,
    payload: { is_village?: boolean | null; region?: string | null },
  ): Promise<boolean> {
    setErrorById((prev) => {
      const rest = { ...prev };
      delete rest[id];
      return rest;
    });
    setPendingIds((prev) => new Set(prev).add(id));

    try {
      const res = await fetch("/admin/api/cities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...payload }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Грешка при запис");
      }
      return true;
    } catch (e) {
      setErrorById((prev) => ({ ...prev, [id]: e instanceof Error ? e.message : "Грешка при запис" }));
      return false;
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function setIsVillage(id: number, next: boolean | null) {
    const previous = cities.find((c) => c.id === id)?.is_village ?? null;
    setCities((prev) => prev.map((c) => (c.id === id ? { ...c, is_village: next } : c)));
    const ok = await patchCity(id, { is_village: next });
    if (!ok) {
      setCities((prev) => prev.map((c) => (c.id === id ? { ...c, is_village: previous } : c)));
    }
  }

  async function saveRegion(id: number) {
    const draft = regionDrafts[id] ?? "";
    const trimmed = draft.trim();
    const nextRegion = trimmed === "" ? null : trimmed;
    const previous = cities.find((c) => c.id === id)?.region ?? null;

    setCities((prev) => prev.map((c) => (c.id === id ? { ...c, region: nextRegion } : c)));
    const ok = await patchCity(id, { region: nextRegion });
    if (!ok) {
      setCities((prev) => prev.map((c) => (c.id === id ? { ...c, region: previous } : c)));
      setRegionDrafts((prev) => ({ ...prev, [id]: previous ?? "" }));
    } else {
      setRegionDrafts((prev) => ({ ...prev, [id]: nextRegion ?? "" }));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Търси по име или slug…"
          className="w-full max-w-xs rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
        />
        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider ${
                filter === f.key
                  ? "border-black/[0.18] bg-black/[0.07] text-[#0c0e14]"
                  : "border-black/[0.1] bg-white text-black/70 hover:bg-[#f7f6f3]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-black/45">{filtered.length} от {cities.length}</span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-black/[0.08] bg-white/85">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/[0.06] text-left text-[10px] font-semibold uppercase tracking-widest text-black/45">
              <th className="px-4 py-3">Име</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Тип</th>
              <th className="px-4 py-3">Регион</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04]">
            {filtered.map((c) => {
              const draft = regionDrafts[c.id] ?? "";
              const isDirty = draft.trim() !== (c.region ?? "").trim();
              const isPending = pendingIds.has(c.id);
              return (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium">{c.name_bg}</td>
                  <td className="px-4 py-3 font-mono text-xs text-black/50">{c.slug}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <div className="inline-flex overflow-hidden rounded-lg border border-black/[0.12]">
                        {(
                          [
                            { value: false, label: "Град" },
                            { value: true, label: "Село" },
                            { value: null, label: "Без тип" },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={String(opt.value)}
                            type="button"
                            disabled={isPending}
                            onClick={() => setIsVillage(c.id, opt.value)}
                            className={`px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider disabled:opacity-40 ${
                              c.is_village === opt.value
                                ? "bg-[#0c0e14] text-white"
                                : "bg-white text-black/70 hover:bg-black/5"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      {errorById[c.id] ? (
                        <p className="text-xs text-red-600">{errorById[c.id]}</p>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        value={draft}
                        disabled={isPending}
                        onChange={(e) =>
                          setRegionDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))
                        }
                        placeholder="напр. обл. Пловдив"
                        className="w-40 rounded-lg border border-black/[0.12] px-2 py-1 text-xs disabled:opacity-40"
                      />
                      <button
                        type="button"
                        disabled={!isDirty || isPending}
                        onClick={() => saveRegion(c.id)}
                        className="rounded-lg border border-black/[0.12] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-black/70 hover:bg-black/5 disabled:opacity-40"
                      >
                        Запази
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: same pre-existing 5 failing test FILES as before this branch (`lib/admin/poster/applyProcessResult.test.ts`, `computeEnrichmentPatch.test.ts`, `extractFestivalFromFacebookPost.test.ts`, `posterJobIdempotency.test.ts`, `lib/admin/ingest/enqueueFacebookPostScrape.test.ts` — all "No test suite found", unrelated to this work), plus all `app/admin/api/cities/route.test.ts` tests passing (12 tests from Task 2), plus everything else that passed before. No new failures.

- [ ] **Step 4: Commit**

```bash
git add components/admin/CitiesManager.tsx
git commit -m "feat(admin): add region text field with save button to CitiesManager"
```

---

### Task 4: Manual verification (controller only, after Tasks 1-3 land)

**Files:** none (verification + the Task 1 Step 3 DB migration apply)

- [ ] **Step 1: Apply the Task 1 migration to the live database** (see Task 1 Step 3 above — do this now if not already done).

- [ ] **Step 2: Confirm via code review that resolver behavior is genuinely unchanged**

Run:
```bash
git diff main -- lib/admin/resolveOrCreateCity.ts lib/admin/resolveCityReference.ts
```
Expected: empty output (no changes to either file in this branch) — confirms the spec's explicit constraint that resolver logic stays untouched.

- [ ] **Step 3: Note for prod verification**

Per established project convention (admin pages are auth + service-role gated and cannot be browser-verified locally — they redirect to `/login` without a real session), the actual UI behavior (region input renders, save button enables/disables correctly, optimistic update + rollback on a forced server error, audit log row appears) must be checked by the user in production after merge + deploy. Document this in the PR description's test plan, same as the prior `/admin/cities` feature's PR.
