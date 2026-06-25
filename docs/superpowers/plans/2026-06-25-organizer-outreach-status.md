# Organizer Outreach Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Кореспонденция" (correspondence) column + filter to `/admin/organizers` so the admin can see which organizers have never received an outreach email, without opening every organizer individually.

**Architecture:** Status is derived entirely from existing `email_jobs` rows of type `organizer-outreach` (no schema change). A new pure-logic module (`lib/admin/organizerOutreachStatus.ts`) parses the organizer id out of each row's `dedupe_key`, builds an `organizerId → lastContactedAt` map, and classifies each organizer into `contacted` / `not_contacted` / `no_email`. The existing organizers list page (`app/admin/(protected)/organizers/page.tsx`) fetches this map once per request, joins it onto the rows it already builds, renders a new badge column, and extends its existing "derived filter forces full-fetch" pagination path (already used for the `type`/origin filter) to also cover the new outreach filter.

**Tech Stack:** Next.js 14 App Router (Server Component), Supabase service-role client, TypeScript, Vitest for unit tests.

**Spec:** `docs/superpowers/specs/2026-06-25-organizer-outreach-status-design.md`

---

## File Structure

- **Create:** `lib/admin/organizerOutreachStatus.ts` — pure helpers (`parseOutreachDedupeKey`, `buildOutreachContactedMap`, `classifyOutreachStatus`) + one Supabase-touching paginated fetch (`fetchAllOrganizerOutreachContactedMap`). All outreach-status logic lives here so it's independently testable without touching the page.
- **Create:** `lib/admin/organizerOutreachStatus.test.ts` — unit tests for all of the above (sibling-file pattern, matching `lib/organizer/profileCompleteness.test.ts`).
- **Modify:** `app/admin/(protected)/organizers/page.tsx` — wire the new helper into the existing query/render/filter logic. No new file needed here; it's the same page extending its existing derived-filter pattern.

No automated test touches the page component itself — this codebase has no page-level test harness, and `page.tsx` is a gated admin Server Component (per project memory, admin pages are verified in production by the user, not via local preview). Task 3 ends with a `tsc --noEmit` type-check instead, and the final task is a manual prod-verification handoff note.

---

### Task 1: Pure outreach-status classification helpers

**Files:**
- Create: `lib/admin/organizerOutreachStatus.ts`
- Test: `lib/admin/organizerOutreachStatus.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/admin/organizerOutreachStatus.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  parseOutreachDedupeKey,
  buildOutreachContactedMap,
  classifyOutreachStatus,
} from "./organizerOutreachStatus";

describe("parseOutreachDedupeKey", () => {
  it("extracts the organizer id from a well-formed key", () => {
    expect(
      parseOutreachDedupeKey("organizer-outreach:org-123:contact@example.bg:2026-06-20"),
    ).toBe("org-123");
  });

  it("returns null for a key with the wrong prefix", () => {
    expect(parseOutreachDedupeKey("festival-approved:abc:2026-06-20")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(parseOutreachDedupeKey(null)).toBeNull();
  });

  it("returns null when the organizer id segment is empty", () => {
    expect(parseOutreachDedupeKey("organizer-outreach::contact@example.bg:2026-06-20")).toBeNull();
  });
});

describe("buildOutreachContactedMap", () => {
  it("maps organizer id to created_at for a single matching row", () => {
    const map = buildOutreachContactedMap([
      { dedupe_key: "organizer-outreach:org-1:a@b.bg:2026-06-01", created_at: "2026-06-01T10:00:00Z" },
    ]);
    expect(map.get("org-1")).toBe("2026-06-01T10:00:00Z");
  });

  it("keeps the most recent created_at when an organizer has multiple rows", () => {
    const map = buildOutreachContactedMap([
      { dedupe_key: "organizer-outreach:org-1:a@b.bg:2026-06-01", created_at: "2026-06-01T10:00:00Z" },
      { dedupe_key: "organizer-outreach:org-1:a@b.bg:2026-06-20", created_at: "2026-06-20T08:00:00Z" },
    ]);
    expect(map.get("org-1")).toBe("2026-06-20T08:00:00Z");
  });

  it("ignores rows with an unparsable dedupe_key", () => {
    const map = buildOutreachContactedMap([
      { dedupe_key: "welcome-email:user-1:2026-06-01", created_at: "2026-06-01T10:00:00Z" },
      { dedupe_key: null, created_at: "2026-06-01T10:00:00Z" },
    ]);
    expect(map.size).toBe(0);
  });

  it("tracks separate organizers independently", () => {
    const map = buildOutreachContactedMap([
      { dedupe_key: "organizer-outreach:org-1:a@b.bg:2026-06-01", created_at: "2026-06-01T10:00:00Z" },
      { dedupe_key: "organizer-outreach:org-2:c@d.bg:2026-06-02", created_at: "2026-06-02T10:00:00Z" },
    ]);
    expect(map.size).toBe(2);
    expect(map.get("org-2")).toBe("2026-06-02T10:00:00Z");
  });
});

describe("classifyOutreachStatus", () => {
  it("returns contacted when the organizer is in the map, regardless of current email", () => {
    const map = new Map([["org-1", "2026-06-20T08:00:00Z"]]);
    expect(classifyOutreachStatus(null, "org-1", map)).toEqual({
      status: "contacted",
      lastContactedAt: "2026-06-20T08:00:00Z",
    });
  });

  it("returns no_email when there is no email and no contact history", () => {
    const map = new Map<string, string>();
    expect(classifyOutreachStatus(null, "org-2", map)).toEqual({
      status: "no_email",
      lastContactedAt: null,
    });
  });

  it("returns no_email when email is an empty/whitespace string", () => {
    const map = new Map<string, string>();
    expect(classifyOutreachStatus("   ", "org-2", map)).toEqual({
      status: "no_email",
      lastContactedAt: null,
    });
  });

  it("returns not_contacted when there is an email but no contact history", () => {
    const map = new Map<string, string>();
    expect(classifyOutreachStatus("org@example.bg", "org-3", map)).toEqual({
      status: "not_contacted",
      lastContactedAt: null,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/admin/organizerOutreachStatus.test.ts`
Expected: FAIL — `lib/admin/organizerOutreachStatus.ts` does not exist yet (module not found).

- [ ] **Step 3: Write the minimal implementation**

Create `lib/admin/organizerOutreachStatus.ts`:

```ts
export type OrganizerOutreachStatus = "contacted" | "not_contacted" | "no_email";

export type OutreachStatusInfo = {
  status: OrganizerOutreachStatus;
  lastContactedAt: string | null;
};

const OUTREACH_DEDUPE_PREFIX = "organizer-outreach";

/**
 * Parses the organizer id out of an outreach `email_jobs.dedupe_key`
 * (format: `organizer-outreach:{organizerId}:{email}:{date}`).
 * Returns null for keys from other email types or malformed keys.
 */
export function parseOutreachDedupeKey(dedupeKey: string | null): string | null {
  if (!dedupeKey) return null;
  const parts = dedupeKey.split(":");
  if (parts.length < 2 || parts[0] !== OUTREACH_DEDUPE_PREFIX) return null;
  return parts[1] || null;
}

/**
 * Reduces raw outreach email_jobs rows into organizerId -> most recent created_at (ISO string).
 * Rows that aren't parseable as outreach dedupe keys are skipped.
 */
export function buildOutreachContactedMap(
  rows: { dedupe_key: string | null; created_at: string }[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    const organizerId = parseOutreachDedupeKey(row.dedupe_key);
    if (!organizerId) continue;
    const existing = map.get(organizerId);
    if (!existing || row.created_at > existing) {
      map.set(organizerId, row.created_at);
    }
  }
  return map;
}

/**
 * Classifies a single organizer's outreach status.
 * Contacted takes priority over no_email: an organizer emailed in the past
 * still shows as contacted even if their stored email was since cleared/changed.
 */
export function classifyOutreachStatus(
  email: string | null | undefined,
  organizerId: string,
  contactedMap: Map<string, string>,
): OutreachStatusInfo {
  const lastContactedAt = contactedMap.get(organizerId) ?? null;
  if (lastContactedAt) {
    return { status: "contacted", lastContactedAt };
  }
  if (!email || !email.trim()) {
    return { status: "no_email", lastContactedAt: null };
  }
  return { status: "not_contacted", lastContactedAt: null };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/admin/organizerOutreachStatus.test.ts`
Expected: PASS (13 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/admin/organizerOutreachStatus.ts lib/admin/organizerOutreachStatus.test.ts
git commit -m "feat(admin): add organizer outreach status classification helpers"
```

---

### Task 2: Paginated fetch of all outreach dedupe keys

**Files:**
- Modify: `lib/admin/organizerOutreachStatus.ts`
- Test: `lib/admin/organizerOutreachStatus.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `lib/admin/organizerOutreachStatus.test.ts` (add `vi` to the existing `vitest` import: `import { describe, it, expect, vi } from "vitest";`):

```ts
describe("fetchAllOrganizerOutreachContactedMap", () => {
  type Row = { dedupe_key: string | null; created_at: string };

  /** Minimal fake mimicking the .from().select().eq().range() chain this function uses. */
  function makeClient(pages: { data: Row[] | null; error: unknown }[]) {
    let call = 0;
    const rangeCalls: Array<[number, number]> = [];
    const client = {
      from(table: string) {
        if (table !== "email_jobs") throw new Error(`unexpected table: ${table}`);
        const query: Record<string, unknown> = {};
        query.select = vi.fn(() => query);
        query.eq = vi.fn(() => query);
        query.range = vi.fn((from: number, to: number) => {
          rangeCalls.push([from, to]);
          const result = pages[call] ?? { data: [], error: null };
          call += 1;
          return Promise.resolve(result);
        });
        return query;
      },
    };
    return { client, rangeCalls };
  }

  it("aggregates rows across multiple pages and stops once a short page is returned", async () => {
    const { client, rangeCalls } = makeClient([
      {
        data: [
          { dedupe_key: "organizer-outreach:org-1:a@b.bg:2026-06-01", created_at: "2026-06-01T10:00:00Z" },
          { dedupe_key: "organizer-outreach:org-2:c@d.bg:2026-06-02", created_at: "2026-06-02T10:00:00Z" },
        ],
        error: null,
      },
      {
        data: [
          { dedupe_key: "organizer-outreach:org-3:e@f.bg:2026-06-03", created_at: "2026-06-03T10:00:00Z" },
        ],
        error: null,
      },
    ]);

    const map = await fetchAllOrganizerOutreachContactedMap(client as never, 2);

    expect(map.size).toBe(3);
    expect(map.get("org-3")).toBe("2026-06-03T10:00:00Z");
    expect(rangeCalls).toEqual([[0, 1], [2, 3]]);
  });

  it("returns an empty map when there are no outreach jobs", async () => {
    const { client } = makeClient([{ data: [], error: null }]);
    const map = await fetchAllOrganizerOutreachContactedMap(client as never, 2);
    expect(map.size).toBe(0);
  });

  it("throws when the underlying query errors", async () => {
    const { client } = makeClient([{ data: null, error: { message: "boom" } }]);
    await expect(fetchAllOrganizerOutreachContactedMap(client as never, 2)).rejects.toThrow("boom");
  });
});
```

And add the import at the top of the test file:

```ts
import {
  parseOutreachDedupeKey,
  buildOutreachContactedMap,
  classifyOutreachStatus,
  fetchAllOrganizerOutreachContactedMap,
} from "./organizerOutreachStatus";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/admin/organizerOutreachStatus.test.ts`
Expected: FAIL — `fetchAllOrganizerOutreachContactedMap` is not exported yet.

- [ ] **Step 3: Write the minimal implementation**

First, add the import at the very top of `lib/admin/organizerOutreachStatus.ts` (above the existing `export type OrganizerOutreachStatus = ...` line):

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
```

Then append to the bottom of `lib/admin/organizerOutreachStatus.ts`:

```ts
const DEFAULT_OUTREACH_FETCH_PAGE_SIZE = 1000;

/**
 * Fetches every `organizer-outreach` email_jobs row (paginated, since there's no upper
 * bound on how many outreach emails will be sent over time) and reduces them into an
 * organizerId -> most recent contacted-at map.
 */
export async function fetchAllOrganizerOutreachContactedMap(
  client: SupabaseClient,
  pageSize: number = DEFAULT_OUTREACH_FETCH_PAGE_SIZE,
): Promise<Map<string, string>> {
  const rows: { dedupe_key: string | null; created_at: string }[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await client
      .from("email_jobs")
      .select("dedupe_key,created_at")
      .eq("type", OUTREACH_DEDUPE_PREFIX)
      .range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    // Supabase's default (un-generic'd) client types `data` as `any`; the actual
    // shape is constrained by the `.select("dedupe_key,created_at")` above.
    const page = (data ?? []) as { dedupe_key: string | null; created_at: string }[];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  return buildOutreachContactedMap(rows);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/admin/organizerOutreachStatus.test.ts`
Expected: PASS (16 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/admin/organizerOutreachStatus.ts lib/admin/organizerOutreachStatus.test.ts
git commit -m "feat(admin): add paginated fetch for organizer outreach contacted map"
```

---

### Task 3: Wire outreach status into the organizers list page

**Files:**
- Modify: `app/admin/(protected)/organizers/page.tsx`

- [ ] **Step 1: Import the new helpers and the email job type constant**

In `app/admin/(protected)/organizers/page.tsx`, replace the top imports:

```ts
import Link from "next/link";
import { redirect } from "next/navigation";
import { classifyOrganizerOriginFromMembers, type OrganizerOriginKind } from "@/lib/admin/organizers";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
```

with:

```ts
import Link from "next/link";
import { redirect } from "next/navigation";
import { classifyOrganizerOriginFromMembers, type OrganizerOriginKind } from "@/lib/admin/organizers";
import {
  classifyOutreachStatus,
  fetchAllOrganizerOutreachContactedMap,
  type OrganizerOutreachStatus,
} from "@/lib/admin/organizerOutreachStatus";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
```

- [ ] **Step 2: Add the outreach badge config next to `ORIGIN_BADGE`**

Replace:

```ts
const ORIGIN_BADGE: Record<OrganizerOriginKind, { label: string; className: string }> = {
  portal: {
    label: "Портал",
    className: "bg-emerald-100 text-emerald-950 ring-1 ring-emerald-200/90",
  },
  pending: {
    label: "Чакащ",
    className: "bg-amber-100 text-amber-950 ring-1 ring-amber-200/90",
  },
  virtual: {
    label: "Виртуален",
    className: "bg-black/[0.06] text-black/65 ring-1 ring-black/[0.1]",
  },
};
```

with:

```ts
const ORIGIN_BADGE: Record<OrganizerOriginKind, { label: string; className: string }> = {
  portal: {
    label: "Портал",
    className: "bg-emerald-100 text-emerald-950 ring-1 ring-emerald-200/90",
  },
  pending: {
    label: "Чакащ",
    className: "bg-amber-100 text-amber-950 ring-1 ring-amber-200/90",
  },
  virtual: {
    label: "Виртуален",
    className: "bg-black/[0.06] text-black/65 ring-1 ring-black/[0.1]",
  },
};

const OUTREACH_BADGE: Record<OrganizerOutreachStatus, { label: string; className: string }> = {
  contacted: {
    label: "Писан",
    className: "bg-emerald-100 text-emerald-950 ring-1 ring-emerald-200/90",
  },
  not_contacted: {
    label: "Не писан",
    className: "bg-amber-100 text-amber-950 ring-1 ring-amber-200/90",
  },
  no_email: {
    label: "Без имейл",
    className: "bg-black/[0.06] text-black/65 ring-1 ring-black/[0.1]",
  },
};
```

- [ ] **Step 3: Parse the new `outreach` filter param**

Replace:

```ts
  const params = await searchParams;
  const q = asString(params.q).trim();
  const typeFilter = asString(params.type);
  const pageRaw = Number.parseInt(asString(params.page) || "1", 10);
```

with:

```ts
  const params = await searchParams;
  const q = asString(params.q).trim();
  const typeFilter = asString(params.type);
  const outreachFilter = asString(params.outreach);
  const pageRaw = Number.parseInt(asString(params.page) || "1", 10);
```

- [ ] **Step 4: Extend `buildQs` to carry the new filter**

Replace:

```ts
function buildQs(params: { q: string; type: string; page: number }) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.type && params.type !== "all") sp.set("type", params.type);
  if (params.page > 1) sp.set("page", String(params.page));
  return sp.toString();
}
```

with:

```ts
function buildQs(params: { q: string; type: string; outreach: string; page: number }) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.type && params.type !== "all") sp.set("type", params.type);
  if (params.outreach && params.outreach !== "all") sp.set("outreach", params.outreach);
  if (params.page > 1) sp.set("page", String(params.page));
  return sp.toString();
}
```

- [ ] **Step 5: Add `email` to the organizers select and broaden the derived-filter flag**

Replace:

```ts
  // `origin` (Тип) is derived in JS from organizer_members.status, not a DB column,
  // so it can't be filtered/paginated in SQL. When a type filter is active we must
  // fetch the full matching set, classify, filter, THEN paginate in JS — otherwise
  // the filter only sees the current 50-row DB page and both the row list and the
  // total/page count come out wrong. Without a type filter we keep efficient DB paging.
  const hasTypeFilter = Boolean(typeFilter && typeFilter !== "all");

  let query = adminClient
    .schema("public")
    .from("organizers")
    // FK hint required: festival_organizers is M2M, so plain `festivals(count)` is ambiguous.
    .select("id,name,slug,verified,created_at,organizer_members(status),festivals!festivals_organizer_id_fkey(count),festival_organizers(count)", { count: "exact" })
    .eq("is_active", true);
```

with:

```ts
  // `origin` (Тип) and outreach status are both derived in JS (from organizer_members.status
  // and from email_jobs respectively), not DB columns, so neither can be filtered/paginated
  // in SQL. When either filter is active we must fetch the full matching set, classify,
  // filter, THEN paginate in JS — otherwise the filter only sees the current 50-row DB page
  // and both the row list and the total/page count come out wrong. With no derived filter
  // active we keep efficient DB-side paging.
  const hasTypeFilter = Boolean(typeFilter && typeFilter !== "all");
  const hasOutreachFilter = Boolean(outreachFilter && outreachFilter !== "all");
  const hasDerivedFilter = hasTypeFilter || hasOutreachFilter;

  let query = adminClient
    .schema("public")
    .from("organizers")
    // FK hint required: festival_organizers is M2M, so plain `festivals(count)` is ambiguous.
    .select("id,name,slug,email,verified,created_at,organizer_members(status),festivals!festivals_organizer_id_fkey(count),festival_organizers(count)", { count: "exact" })
    .eq("is_active", true);
```

- [ ] **Step 6: Use `hasDerivedFilter` for the range/no-range branch**

Replace:

```ts
  if (!hasTypeFilter) {
    query = query.range(from, to);
  }

  const { data, error, count } = await query;
```

with:

```ts
  if (!hasDerivedFilter) {
    query = query.range(from, to);
  }

  const { data, error, count } = await query;
```

- [ ] **Step 7: Fetch the contacted map and classify outreach status per row**

Replace:

```ts
  let rows = (data ?? []).map((row) => {
    const members = row.organizer_members as { status: string }[] | null | undefined;
    const festivalsRaw = row.festivals as { count: number }[] | null | undefined;
    const m2mRaw = row.festival_organizers as { count: number }[] | null | undefined;
    // Use the larger of the two counts — legacy organizer_id + junction table.
    // Festivals linked only via festival_organizers (secondary organizers) are
    // otherwise invisible. Taking max avoids double-counting when both sources
    // contain the same festival.
    const festivalCount = Math.max(
      festivalsRaw?.[0]?.count ?? 0,
      m2mRaw?.[0]?.count ?? 0,
    );
    return {
      ...row,
      members,
      origin: classifyOrganizerOriginFromMembers(members),
      festivalCount,
    };
  });

  // Type filter + pagination. When filtering by derived origin we fetched the full
  // set above, so filter then slice here and use the FILTERED length as the total —
  // this keeps the counter and page count consistent with what's actually shown.
  let totalCount: number;
  if (hasTypeFilter) {
    rows = rows.filter((r) => r.origin === typeFilter);
    totalCount = rows.length;
    rows = rows.slice(from, to + 1);
  } else {
    totalCount = count ?? 0;
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));
  const prevQs = page > 1 ? buildQs({ q, type: typeFilter, page: page - 1 }) : null;
  const nextQs = page < totalPages ? buildQs({ q, type: typeFilter, page: page + 1 }) : null;
```

with:

```ts
  const contactedMap = await fetchAllOrganizerOutreachContactedMap(adminClient);

  let rows = (data ?? []).map((row) => {
    const members = row.organizer_members as { status: string }[] | null | undefined;
    const festivalsRaw = row.festivals as { count: number }[] | null | undefined;
    const m2mRaw = row.festival_organizers as { count: number }[] | null | undefined;
    // Use the larger of the two counts — legacy organizer_id + junction table.
    // Festivals linked only via festival_organizers (secondary organizers) are
    // otherwise invisible. Taking max avoids double-counting when both sources
    // contain the same festival.
    const festivalCount = Math.max(
      festivalsRaw?.[0]?.count ?? 0,
      m2mRaw?.[0]?.count ?? 0,
    );
    const outreach = classifyOutreachStatus(row.email, row.id, contactedMap);
    return {
      ...row,
      members,
      origin: classifyOrganizerOriginFromMembers(members),
      festivalCount,
      outreachStatus: outreach.status,
      lastContactedAt: outreach.lastContactedAt,
    };
  });

  // Derived-filter + pagination. When filtering by origin and/or outreach status we
  // fetched the full set above, so filter then slice here and use the FILTERED length
  // as the total — this keeps the counter and page count consistent with what's shown.
  let totalCount: number;
  if (hasDerivedFilter) {
    if (hasTypeFilter) {
      rows = rows.filter((r) => r.origin === typeFilter);
    }
    if (hasOutreachFilter) {
      rows = rows.filter((r) => r.outreachStatus === outreachFilter);
    }
    totalCount = rows.length;
    rows = rows.slice(from, to + 1);
  } else {
    totalCount = count ?? 0;
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));
  const prevQs = page > 1 ? buildQs({ q, type: typeFilter, outreach: outreachFilter, page: page - 1 }) : null;
  const nextQs = page < totalPages ? buildQs({ q, type: typeFilter, outreach: outreachFilter, page: page + 1 }) : null;
```

- [ ] **Step 8: Add the outreach `<select>` to the filter form**

Replace:

```tsx
          <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
            Тип
            <select
              name="type"
              defaultValue={typeFilter || "all"}
              className="mt-1 block rounded-lg border border-black/[0.12] bg-white px-2.5 py-1.5 text-sm text-black focus:outline-none focus:ring-1 focus:ring-black/20"
            >
              <option value="all">Всички</option>
              <option value="portal">Портал</option>
              <option value="pending">Чакащ</option>
              <option value="virtual">Виртуален</option>
            </select>
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-lg bg-[#0c0e14] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white"
            >
              Търси
            </button>
            {(q || (typeFilter && typeFilter !== "all")) && (
```

with:

```tsx
          <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
            Тип
            <select
              name="type"
              defaultValue={typeFilter || "all"}
              className="mt-1 block rounded-lg border border-black/[0.12] bg-white px-2.5 py-1.5 text-sm text-black focus:outline-none focus:ring-1 focus:ring-black/20"
            >
              <option value="all">Всички</option>
              <option value="portal">Портал</option>
              <option value="pending">Чакащ</option>
              <option value="virtual">Виртуален</option>
            </select>
          </label>
          <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
            Кореспонденция
            <select
              name="outreach"
              defaultValue={outreachFilter || "all"}
              className="mt-1 block rounded-lg border border-black/[0.12] bg-white px-2.5 py-1.5 text-sm text-black focus:outline-none focus:ring-1 focus:ring-black/20"
            >
              <option value="all">Всички</option>
              <option value="not_contacted">Неписани</option>
              <option value="contacted">Писани</option>
              <option value="no_email">Без имейл</option>
            </select>
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-lg bg-[#0c0e14] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white"
            >
              Търси
            </button>
            {(q || (typeFilter && typeFilter !== "all") || (outreachFilter && outreachFilter !== "all")) && (
```

- [ ] **Step 9: Add the table header cell**

Replace:

```tsx
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Тип</th>
              <th className="px-4 py-3">Фестивали</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Verified</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
```

with:

```tsx
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Тип</th>
              <th className="px-4 py-3">Кореспонденция</th>
              <th className="px-4 py-3">Фестивали</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Verified</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
```

- [ ] **Step 10: Render the badge cell in each row**

Replace:

```tsx
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold tracking-tight ${badge.className}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
```

with:

```tsx
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold tracking-tight ${badge.className}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const outreachBadge = OUTREACH_BADGE[row.outreachStatus];
                      return (
                        <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold tracking-tight ${outreachBadge.className}`}>
                          {outreachBadge.label}
                          {row.lastContactedAt && (
                            <span className="ml-1 font-normal opacity-70">
                              · {new Date(row.lastContactedAt).toLocaleDateString("bg-BG", { timeZone: "Europe/Sofia" })}
                            </span>
                          )}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
```

- [ ] **Step 11: Update the empty-state colspan**

Replace:

```tsx
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-black/60">
                  {q ? `Няма резултати за „${q}".` : "No organizers found."}
                </td>
              </tr>
            )}
```

with:

```tsx
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-black/60">
                  {q ? `Няма резултати за „${q}".` : "No organizers found."}
                </td>
              </tr>
            )}
```

Note: the pagination `<Link>` hrefs below this further down the file need no edit — they already just forward `prevQs`/`nextQs`, which now include the `outreach` param automatically via the updated `buildQs` calls from Step 7.

- [ ] **Step 12: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. If `row.outreachStatus` or `row.email` show as `unknown`/missing-property errors, confirm Step 5's select string and Step 7's mapped object both include them exactly as written above.

- [ ] **Step 13: Run the full unit test suite**

Run: `npx vitest run`
Expected: PASS, including the 16 tests from Tasks 1–2.

- [ ] **Step 14: Commit**

```bash
git add "app/admin/(protected)/organizers/page.tsx"
git commit -m "feat(admin): show organizer outreach status column and filter"
```

---

### Task 4: Manual production verification (admin-gated page)

Per project convention, admin pages require real auth + service-role data and can't be exercised via local preview — verification happens against the deployed app.

- [ ] **Step 1: Push and open a PR**

```bash
git push -u origin <branch-name>
gh pr create --title "feat(admin): organizer outreach status column and filter" --body "Adds a Кореспонденция column + filter to /admin/organizers, derived from existing email_jobs outreach history. No schema change. See docs/superpowers/specs/2026-06-25-organizer-outreach-status-design.md."
gh pr merge --merge --delete-branch
```

- [ ] **Step 2: Hand off to the user for prod verification**

Ask the user to open `https://festivo.bg/admin/organizers` after the Vercel deploy finishes and confirm:
- The new "Кореспонденция" column shows "Писан · {date}" for at least one organizer they've previously emailed via the outreach modal.
- Organizers with no email show "Без имейл".
- The "Кореспонденция" filter dropdown correctly narrows the list to "Неписани" and the count updates.
