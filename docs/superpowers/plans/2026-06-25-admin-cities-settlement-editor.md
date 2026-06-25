# Admin Cities Settlement Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give admins a UI to manually correct `cities.is_village` (град/село/без тип) without going through SQL/Supabase MCP.

**Architecture:** New admin page `app/admin/(protected)/cities/page.tsx` (server component, auth gate + initial fetch) renders a client component `components/admin/CitiesManager.tsx` (search/filter/tri-state toggle, optimistic update) which talks to a new API route `app/admin/api/cities/route.ts` (`GET` list, `PATCH` mutation + audit log). A nav entry is added to `lib/admin/adminNavConfig.ts`. Follows the existing `categories` admin page pattern exactly.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (service-role client via `createSupabaseAdmin`), Vitest.

---

### Task 1: API route — `GET /admin/api/cities`

**Files:**
- Create: `app/admin/api/cities/route.ts`
- Test: `app/admin/api/cities/route.test.ts`

This task creates the route file with `GET` only; `PATCH` is added in Task 2 (same file, additive).

- [ ] **Step 1: Write the failing test for GET**

Check how `getAdminContext` and `createSupabaseAdmin` are mocked in an existing route test first — search for a precedent:

Run: `grep -rl "getAdminContext" --include="*.test.ts" app/admin/api | head -5`

If no existing route test mocks `getAdminContext`/`createSupabaseAdmin` via `vi.mock`, use this pattern (it mirrors how `lib/admin/isAdmin.ts` and `lib/supabaseAdmin.ts` are imported in the route):

Create `app/admin/api/cities/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetAdminContext = vi.fn();
const mockFrom = vi.fn();
const mockLogAdminAction = vi.fn();

vi.mock("@/lib/admin/isAdmin", () => ({
  getAdminContext: () => mockGetAdminContext(),
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  createSupabaseAdmin: () => ({ from: mockFrom }),
}));

vi.mock("@/lib/admin/audit-log", () => ({
  logAdminAction: (...args: unknown[]) => mockLogAdminAction(...args),
}));

import { GET, PATCH } from "./route";

function adminCtx() {
  return { supabase: {}, client: {}, user: { id: "admin-1" }, isAdmin: true as const };
}

beforeEach(() => {
  mockGetAdminContext.mockReset();
  mockFrom.mockReset();
  mockLogAdminAction.mockReset();
});

describe("GET /admin/api/cities", () => {
  it("returns 403 when not admin", async () => {
    mockGetAdminContext.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns cities sorted by name_bg (bg-BG locale)", async () => {
    mockGetAdminContext.mockResolvedValue(adminCtx());
    const rows = [
      { id: 2, name_bg: "Ябълково", slug: "yabalkovo", region: null, is_village: true },
      { id: 1, name_bg: "Айтос", slug: "aytos", region: null, is_village: false },
    ];
    mockFrom.mockReturnValue({
      select: () => Promise.resolve({ data: rows, error: null }),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cities.map((c: { name_bg: string }) => c.name_bg)).toEqual(["Айтос", "Ябълково"]);
  });

  it("returns 500 when the query fails", async () => {
    mockGetAdminContext.mockResolvedValue(adminCtx());
    mockFrom.mockReturnValue({
      select: () => Promise.resolve({ data: null, error: { message: "boom" } }),
    });

    const res = await GET();
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/admin/api/cities/route.test.ts`
Expected: FAIL — `./route` has no exported member `GET`/`PATCH` (file doesn't exist yet).

- [ ] **Step 3: Write the GET implementation**

Create `app/admin/api/cities/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction } from "@/lib/admin/audit-log";

export const dynamic = "force-dynamic";

export type AdminCityRow = {
  id: number;
  name_bg: string;
  slug: string;
  region: string | null;
  is_village: boolean | null;
};

export async function GET() {
  const ctx = await getAdminContext();
  if (!ctx?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createSupabaseAdmin();
  const { data, error } = await admin.from("cities").select("id,name_bg,slug,region,is_village");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const cities = ((data ?? []) as AdminCityRow[]).sort((a, b) =>
    a.name_bg.localeCompare(b.name_bg, "bg-BG"),
  );

  return NextResponse.json({ cities });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/admin/api/cities/route.test.ts`
Expected: PASS (3 tests; the `PATCH` import will still fail until Task 2 — if so, comment out the `PATCH` import line from the test file temporarily, or proceed directly to Task 2 before running this, since Task 2 adds the missing export in the same file).

- [ ] **Step 5: Commit**

```bash
git add app/admin/api/cities/route.ts app/admin/api/cities/route.test.ts
git commit -m "feat(admin): add GET /admin/api/cities list endpoint"
```

---

### Task 2: API route — `PATCH /admin/api/cities` (mutate `is_village`)

**Files:**
- Modify: `app/admin/api/cities/route.ts`
- Modify: `app/admin/api/cities/route.test.ts`

- [ ] **Step 1: Add the failing tests for PATCH**

Append to `app/admin/api/cities/route.test.ts` (inside the same file, new `describe` block):

```typescript
describe("PATCH /admin/api/cities", () => {
  function patchRequest(body: unknown) {
    return new Request("http://localhost/admin/api/cities", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns 403 when not admin", async () => {
    mockGetAdminContext.mockResolvedValue(null);
    const res = await PATCH(patchRequest({ id: 1, is_village: true }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when is_village is not boolean|null", async () => {
    mockGetAdminContext.mockResolvedValue(adminCtx());
    const res = await PATCH(patchRequest({ id: 1, is_village: "true" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when id is missing or not a number", async () => {
    mockGetAdminContext.mockResolvedValue(adminCtx());
    const res = await PATCH(patchRequest({ is_village: true }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when the city does not exist", async () => {
    mockGetAdminContext.mockResolvedValue(adminCtx());
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    });

    const res = await PATCH(patchRequest({ id: 999, is_village: true }));
    expect(res.status).toBe(404);
  });

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
        action: "update_is_village",
        entity_type: "city",
        entity_id: "1",
        details: { from: false, to: true },
      }),
    );
  });

  it("returns 500 when the update fails", async () => {
    mockGetAdminContext.mockResolvedValue(adminCtx());
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: { id: 1, is_village: false }, error: null }),
        }),
      }),
      update: () => ({ eq: () => Promise.resolve({ error: { message: "boom" } }) }),
    });

    const res = await PATCH(patchRequest({ id: 1, is_village: true }));
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/admin/api/cities/route.test.ts`
Expected: FAIL — `PATCH` is not exported from `./route`.

- [ ] **Step 3: Write the PATCH implementation**

Append to `app/admin/api/cities/route.ts` (after the `GET` function):

```typescript
type PatchCityBody = {
  id?: unknown;
  is_village?: unknown;
};

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

  const is_village = body?.is_village;
  if (is_village !== true && is_village !== false && is_village !== null) {
    return NextResponse.json({ error: "is_village трябва да е true, false или null" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  const { data: existing, error: readError } = await admin
    .from("cities")
    .select("id,is_village")
    .eq("id", id)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Населеното място не е намерено" }, { status: 404 });
  }

  const { error: updateError } = await admin.from("cities").update({ is_village }).eq("id", id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await logAdminAction({
    actor_user_id: ctx.user.id,
    action: "update_is_village",
    entity_type: "city",
    entity_id: String(id),
    route: "/admin/api/cities",
    method: "PATCH",
    details: { from: existing.is_village, to: is_village },
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/admin/api/cities/route.test.ts`
Expected: PASS (9 tests total).

- [ ] **Step 5: Run the project typecheck**

Run: `npx tsc --noEmit`
Expected: no errors related to `app/admin/api/cities/route.ts`.

- [ ] **Step 6: Commit**

```bash
git add app/admin/api/cities/route.ts app/admin/api/cities/route.test.ts
git commit -m "feat(admin): add PATCH /admin/api/cities to edit is_village"
```

---

### Task 3: `CitiesManager` client component

**Files:**
- Create: `components/admin/CitiesManager.tsx`

No unit test for this file — matches the existing convention (`CategoriesManager.tsx` has no test).

- [ ] **Step 1: Write the component**

Create `components/admin/CitiesManager.tsx`:

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

  async function setIsVillage(id: number, next: boolean | null) {
    const previous = cities.find((c) => c.id === id)?.is_village ?? null;
    setErrorById((prev) => {
      const { [id]: _drop, ...rest } = prev;
      return rest;
    });
    setCities((prev) => prev.map((c) => (c.id === id ? { ...c, is_village: next } : c)));
    setPendingIds((prev) => new Set(prev).add(id));

    try {
      const res = await fetch("/admin/api/cities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_village: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Грешка при запис");
      }
    } catch (e) {
      setCities((prev) => prev.map((c) => (c.id === id ? { ...c, is_village: previous } : c)));
      setErrorById((prev) => ({ ...prev, [id]: e instanceof Error ? e.message : "Грешка при запис" }));
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
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
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04]">
            {filtered.map((c) => (
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
                          disabled={pendingIds.has(c.id)}
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. The `AdminCityRow` type import resolves because Task 1/Task 2 already created `app/admin/api/cities/route.ts` with that export.

- [ ] **Step 3: Commit**

```bash
git add components/admin/CitiesManager.tsx
git commit -m "feat(admin): add CitiesManager component for editing settlement type"
```

---

### Task 4: Admin page + nav entry

**Files:**
- Create: `app/admin/(protected)/cities/page.tsx`
- Modify: `lib/admin/adminNavConfig.ts:34`

- [ ] **Step 1: Write the page**

Create `app/admin/(protected)/cities/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import CitiesManager from "@/components/admin/CitiesManager";
import type { AdminCityRow } from "@/app/admin/api/cities/route";

export const dynamic = "force-dynamic";

export default async function AdminCitiesPage() {
  const ctx = await getAdminContext();
  if (!ctx?.isAdmin) redirect("/login?next=/admin");

  const admin = createSupabaseAdmin();
  const { data } = await admin.from("cities").select("id,name_bg,slug,region,is_village");

  const cities = ((data ?? []) as AdminCityRow[]).sort((a, b) =>
    a.name_bg.localeCompare(b.name_bg, "bg-BG"),
  );

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-[#0c0e14]">Населени места</h1>
        <p className="mt-1 text-sm text-black/55">
          Управлявай тип град/село за всяко населено място (
          <code className="rounded bg-black/5 px-1 font-mono text-xs">cities.is_village</code>
          ). „Без тип" означава курорт/местност — без префикс на сайта.
        </p>
      </div>
      <CitiesManager initial={cities} />
    </div>
  );
}
```

- [ ] **Step 2: Add the nav entry**

In `lib/admin/adminNavConfig.ts`, in the `"Съдържание"` group, add a line directly after the `"Категории"` entry (currently line 34):

```typescript
      { href: "/admin/categories", label: "Категории", match: "prefix" },
      { href: "/admin/cities", label: "Населени места", match: "prefix" },
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: all previously-passing tests still pass, plus the new 9 tests in `app/admin/api/cities/route.test.ts` (pre-existing unrelated failing test files — empty poster/facebook stubs — are expected to still fail; this is pre-existing and unrelated to this change).

- [ ] **Step 5: Commit**

```bash
git add "app/admin/(protected)/cities/page.tsx" lib/admin/adminNavConfig.ts
git commit -m "feat(admin): add cities settlement editor page and nav entry"
```

---

### Task 5: Manual verification in the browser preview

**Files:** none (verification only)

- [ ] **Step 1: Start the preview server**

Use the `preview_start` tool (or `npm run dev` if no preview tool is available) and navigate to `/admin/cities` while logged in as an admin user.

- [ ] **Step 2: Verify the list renders**

Confirm all ~262 rows render with name, slug, and a 3-button type toggle. Confirm the "Населени места" nav link appears under "Съдържание" and is highlighted when active.

- [ ] **Step 3: Verify search and filters**

Type "вакарел" in the search box — confirm only "Вакарел" remains. Clear the search, click each of the 4 filter chips ("Всички"/"Град"/"Село"/"Без тип") — confirm the row count under the search box updates and matches the filter (e.g. "Без тип" shows exactly the 2 resort rows: Боровец, к.к. Мальовица).

- [ ] **Step 4: Verify the toggle mutates the DB**

Click "Село" on a row currently set to "Град" (e.g. a non-Sofia/Plovdiv test row, or revert it back after). Confirm the button highlight switches immediately. Reload the page — confirm the change persisted (calls through to step 5 next).

- [ ] **Step 5: Verify the audit log row**

Using the Supabase MCP `execute_sql` tool against project `hpvfsdmpatgceohigswm`, run:

```sql
select action, entity_type, entity_id, details, created_at
from admin_audit_logs
where entity_type = 'city' and action = 'update_is_village'
order by created_at desc
limit 1;
```

Confirm a row exists matching the change made in Step 4, with `details.from`/`details.to` reflecting the old/new value.

- [ ] **Step 6: Revert the test change (if any) and stop the preview server**

If Step 4 used a real city as a test case, click the toggle back to its original value and confirm it persists. Stop the preview server with `preview_stop`.
