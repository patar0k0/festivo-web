# Organizer Self-Edit on Published Festivals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let verified organizer-portal owners directly edit their own already-published festivals (text fields, gallery, video, hero image, schedule), with every edit audit-logged and flagged on the admin festival list.

**Architecture:** A new `app/api/organizer/festivals/[id]/` route tree, gated by a shared `assertOrganizerCanEditPublishedFestival` helper, reuses existing admin-side helpers (media limits, city resolution, hero rehosting, program draft) but writes through the organizer-portal service-role client. A new `festivals.last_edited_by_organizer_at` column flags edited rows for admins. A new single-page organizer UI (not the multi-step submission wizard) drives the new endpoints.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + service-role client), TypeScript, Tailwind, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-25-organizer-festival-self-edit-design.md`

---

## Task 1: Migration — `last_edited_by_organizer_at`

**Files:**
- Create: `scripts/sql/20260625_festival_organizer_edit_indicator.sql`

- [ ] **Step 1: Write the migration**

```sql
alter table public.festivals
  add column if not exists last_edited_by_organizer_at timestamptz null;

create index if not exists idx_festivals_last_edited_by_organizer_at
  on public.festivals (last_edited_by_organizer_at)
  where last_edited_by_organizer_at is not null;
```

- [ ] **Step 2: Apply the migration to the project's Supabase instance**

Run the SQL above against the project database (via Supabase SQL editor, CLI, or MCP `apply_migration`). Confirm with:

```sql
select column_name, data_type from information_schema.columns
where table_name = 'festivals' and column_name = 'last_edited_by_organizer_at';
```
Expected: one row, `data_type = timestamp with time zone`.

- [ ] **Step 3: Commit**

```bash
git add scripts/sql/20260625_festival_organizer_edit_indicator.sql
git commit -m "chore(db): add festivals.last_edited_by_organizer_at indicator column"
```

---

## Task 2: Organizer field allowlist

**Files:**
- Modify: `lib/admin/patchAllowedKeys.ts`
- Test: `lib/admin/patchAllowedKeys.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { FESTIVAL_PATCH_ALLOWED_KEYS, ORGANIZER_FESTIVAL_PATCH_ALLOWED_KEYS } from "./patchAllowedKeys";

describe("ORGANIZER_FESTIVAL_PATCH_ALLOWED_KEYS", () => {
  it("is a subset of FESTIVAL_PATCH_ALLOWED_KEYS", () => {
    const adminSet = new Set(FESTIVAL_PATCH_ALLOWED_KEYS as readonly string[]);
    for (const key of ORGANIZER_FESTIVAL_PATCH_ALLOWED_KEYS) {
      expect(adminSet.has(key)).toBe(true);
    }
  });

  it("excludes admin-only fields", () => {
    const excluded = [
      "slug",
      "status",
      "is_verified",
      "organizer_id",
      "organizer_ids",
      "organizer_name",
      "organizer_entries",
      "source_url",
      "source_type",
      "promotion_status",
      "promotion_started_at",
      "promotion_expires_at",
      "promotion_rank",
    ];
    const orgSet = new Set(ORGANIZER_FESTIVAL_PATCH_ALLOWED_KEYS as readonly string[]);
    for (const key of excluded) {
      expect(orgSet.has(key as never)).toBe(false);
    }
  });

  it("includes the core editable fields", () => {
    const orgSet = new Set(ORGANIZER_FESTIVAL_PATCH_ALLOWED_KEYS as readonly string[]);
    for (const key of ["title", "description", "city_id", "start_date", "hero_image", "occurrence_dates", "is_free"]) {
      expect(orgSet.has(key as never)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/admin/patchAllowedKeys.test.ts`
Expected: FAIL — `ORGANIZER_FESTIVAL_PATCH_ALLOWED_KEYS` is not exported.

- [ ] **Step 3: Add the constant**

In `lib/admin/patchAllowedKeys.ts`, append after `FESTIVAL_PATCH_ALLOWED_KEYS`:

```ts
export const ORGANIZER_FESTIVAL_PATCH_ALLOWED_KEYS = [
  "title",
  "description",
  "description_short",
  "category",
  "tags",
  "city_id",
  "city_name_display",
  "city",
  "venue_name",
  "location_name",
  "address",
  "latitude",
  "lat",
  "longitude",
  "lng",
  "coords_override",
  "place_id",
  "start_date",
  "end_date",
  "start_time",
  "end_time",
  "occurrence_dates",
  "hero_image",
  "image_url",
  "website_url",
  "ticket_url",
  "price_range",
  "is_free",
] as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/admin/patchAllowedKeys.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/admin/patchAllowedKeys.ts lib/admin/patchAllowedKeys.test.ts
git commit -m "feat(organizer): add ORGANIZER_FESTIVAL_PATCH_ALLOWED_KEYS"
```

---

## Task 3: Audit-log diff helper — `pickFields`

**Files:**
- Modify: `lib/admin/audit-log.ts`
- Test: `lib/admin/audit-log.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { pickFields } from "./audit-log";

describe("pickFields", () => {
  it("returns only the requested keys that exist on the source", () => {
    const result = pickFields({ a: 1, b: 2, c: 3 }, ["a", "c", "missing"]);
    expect(result).toEqual({ a: 1, c: 3 });
  });

  it("returns an empty object for a null source", () => {
    expect(pickFields(null, ["a"])).toEqual({});
  });

  it("returns an empty object for an undefined source", () => {
    expect(pickFields(undefined, ["a"])).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/admin/audit-log.test.ts`
Expected: FAIL — `pickFields` is not exported.

- [ ] **Step 3: Add the helper**

In `lib/admin/audit-log.ts`, append at the end of the file:

```ts
/** Shallow-pick `keys` present on `source` — used to build before/after audit diffs. */
export function pickFields<T extends Record<string, unknown>>(
  source: T | null | undefined,
  keys: string[],
): Record<string, unknown> {
  if (!source) return {};
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in source) out[key] = source[key];
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/admin/audit-log.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/admin/audit-log.ts lib/admin/audit-log.test.ts
git commit -m "feat(admin): add pickFields helper for audit-log diffs"
```

---

## Task 4: Auth-gate helper — `assertOrganizerCanEditPublishedFestival`

**Files:**
- Create: `lib/organizer/festivalSelfEdit.ts`
- Test: `lib/organizer/festivalSelfEdit.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";

const hasActiveOrganizerMembershipMock = vi.fn();
vi.mock("@/lib/organizer/portal", () => ({
  hasActiveOrganizerMembership: (...args: unknown[]) => hasActiveOrganizerMembershipMock(...args),
}));

import { assertOrganizerCanEditPublishedFestival } from "./festivalSelfEdit";

type Row = Record<string, unknown>;

function makeQuery(result: { data: unknown; error: unknown }) {
  const query: Record<string, unknown> = {};
  const chain = () => query;
  query.select = vi.fn(chain);
  query.eq = vi.fn(chain);
  query.order = vi.fn(chain);
  query.limit = vi.fn(chain);
  query.maybeSingle = vi.fn(() => Promise.resolve(result));
  return query;
}

function makeAdmin(opts: {
  festival: { data: Row | null; error: unknown };
  festivalOrganizersLink?: { data: Row | null; error: unknown };
}) {
  return {
    from(table: string) {
      if (table === "festivals") return makeQuery(opts.festival);
      if (table === "festival_organizers") return makeQuery(opts.festivalOrganizersLink ?? { data: null, error: null });
      throw new Error(`unexpected table in test: ${table}`);
    },
  } as never;
}

describe("assertOrganizerCanEditPublishedFestival", () => {
  it("returns 404 when the festival does not exist", async () => {
    const admin = makeAdmin({ festival: { data: null, error: null } });
    const result = await assertOrganizerCanEditPublishedFestival(admin, "user-1", "festival-1");
    expect(result).toEqual({ ok: false, status: 404, error: "Фестивалът не е намерен." });
  });

  it("returns 404 when neither festivals.organizer_id nor festival_organizers has an owner", async () => {
    const admin = makeAdmin({
      festival: { data: { organizer_id: null, status: "verified" }, error: null },
      festivalOrganizersLink: { data: null, error: null },
    });
    const result = await assertOrganizerCanEditPublishedFestival(admin, "user-1", "festival-1");
    expect(result).toEqual({ ok: false, status: 404, error: "Фестивалът не е намерен." });
  });

  it("returns 403 when the festival is not verified/published", async () => {
    const admin = makeAdmin({
      festival: { data: { organizer_id: "org-1", status: "draft" }, error: null },
    });
    const result = await assertOrganizerCanEditPublishedFestival(admin, "user-1", "festival-1");
    expect(result).toEqual({ ok: false, status: 403, error: "Можете да редактирате само одобрени фестивали." });
  });

  it("returns 403 when the user has no active organizer membership", async () => {
    hasActiveOrganizerMembershipMock.mockResolvedValueOnce(false);
    const admin = makeAdmin({
      festival: { data: { organizer_id: "org-1", status: "verified" }, error: null },
    });
    const result = await assertOrganizerCanEditPublishedFestival(admin, "user-1", "festival-1");
    expect(result).toEqual({ ok: false, status: 403, error: "Нямате права за този фестивал." });
  });

  it("returns ok with the organizer id when membership is active and the festival is published", async () => {
    hasActiveOrganizerMembershipMock.mockResolvedValueOnce(true);
    const admin = makeAdmin({
      festival: { data: { organizer_id: "org-1", status: "verified" }, error: null },
    });
    const result = await assertOrganizerCanEditPublishedFestival(admin, "user-1", "festival-1");
    expect(result).toEqual({ ok: true, organizerId: "org-1" });
  });

  it("falls back to festival_organizers when festivals.organizer_id is null", async () => {
    hasActiveOrganizerMembershipMock.mockResolvedValueOnce(true);
    const admin = makeAdmin({
      festival: { data: { organizer_id: null, status: "verified" }, error: null },
      festivalOrganizersLink: { data: { organizer_id: "org-2" }, error: null },
    });
    const result = await assertOrganizerCanEditPublishedFestival(admin, "user-1", "festival-1");
    expect(result).toEqual({ ok: true, organizerId: "org-2" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/organizer/festivalSelfEdit.test.ts`
Expected: FAIL — module `./festivalSelfEdit` does not exist.

- [ ] **Step 3: Implement the helper**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasActiveOrganizerMembership } from "@/lib/organizer/portal";

export type EditableFestivalGateResult =
  | { ok: true; organizerId: string }
  | { ok: false; status: 403 | 404; error: string };

type FestivalOwnershipRow = { organizer_id: string | null; status: string | null };

async function resolveFestivalOrganizerId(
  admin: SupabaseClient,
  festivalId: string,
): Promise<{ organizerId: string | null; status: string | null } | null> {
  const { data: festivalRow, error: festivalError } = await admin
    .from("festivals")
    .select("organizer_id,status")
    .eq("id", festivalId)
    .maybeSingle<FestivalOwnershipRow>();

  if (festivalError) {
    throw new Error(festivalError.message);
  }
  if (!festivalRow) return null;

  if (festivalRow.organizer_id) {
    return { organizerId: festivalRow.organizer_id, status: festivalRow.status };
  }

  const { data: linkRow, error: linkError } = await admin
    .from("festival_organizers")
    .select("organizer_id")
    .eq("festival_id", festivalId)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle<{ organizer_id: string | null }>();

  if (linkError) {
    throw new Error(linkError.message);
  }

  return { organizerId: linkRow?.organizer_id ?? null, status: festivalRow.status };
}

const EDITABLE_STATUSES = new Set(["verified", "published"]);

/** Gate shared by every `app/api/organizer/festivals/[id]/**` route: organizer must own the
 * festival via an active write-role membership, and the festival must already be live. */
export async function assertOrganizerCanEditPublishedFestival(
  admin: SupabaseClient,
  userId: string,
  festivalId: string,
): Promise<EditableFestivalGateResult> {
  const ownership = await resolveFestivalOrganizerId(admin, festivalId);
  if (!ownership || !ownership.organizerId) {
    return { ok: false, status: 404, error: "Фестивалът не е намерен." };
  }

  if (!ownership.status || !EDITABLE_STATUSES.has(ownership.status)) {
    return { ok: false, status: 403, error: "Можете да редактирате само одобрени фестивали." };
  }

  const allowed = await hasActiveOrganizerMembership(admin, userId, ownership.organizerId);
  if (!allowed) {
    return { ok: false, status: 403, error: "Нямате права за този фестивал." };
  }

  return { ok: true, organizerId: ownership.organizerId };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/organizer/festivalSelfEdit.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/organizer/festivalSelfEdit.ts lib/organizer/festivalSelfEdit.test.ts
git commit -m "feat(organizer): add self-edit ownership/status auth gate"
```

---

## Task 5: Core PATCH route

**Files:**
- Create: `app/api/organizer/festivals/[id]/route.ts`

No test file — this project does not unit-test `route.ts` handlers (vitest `include` is `lib/**/*.test.ts` only; see `vitest.config.ts`). Verify manually in Task 13.

- [ ] **Step 1: Implement the route**

```ts
import { NextResponse } from "next/server";
import { getPortalSessionUser, getPortalAdminClient } from "@/lib/organizer/portal";
import { assertOrganizerCanEditPublishedFestival } from "@/lib/organizer/festivalSelfEdit";
import { validateNoUnknownKeys } from "@/lib/api/strictBody";
import { ORGANIZER_FESTIVAL_PATCH_ALLOWED_KEYS } from "@/lib/admin/patchAllowedKeys";
import { canonicalPatchFromUnknown } from "@/lib/festival/validators";
import { festivalPatchFromCanonicalPartial } from "@/lib/festival/mappers";
import { normalizeSettlementInput, resolveOrCreateCityReference } from "@/lib/admin/resolveCityReference";
import { mergeOccurrenceDatesWithRange } from "@/lib/festival/occurrenceDates";
import { isAlreadyOurSupabaseHeroPublicUrl, rehostHeroImageIfRemote } from "@/lib/admin/rehostHeroImageFromUrl";
import { logAdminAction, pickFields } from "@/lib/admin/audit-log";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getPortalSessionUser();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Необходим е вход." }, { status: 401 });
  }

  let admin;
  try {
    admin = getPortalAdminClient();
  } catch {
    return NextResponse.json({ error: "Услугата е временно недостъпна." }, { status: 503 });
  }

  const { id } = await params;
  const gate = await assertOrganizerCanEditPublishedFestival(admin, session.user.id, id);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const strictValidation = validateNoUnknownKeys(body, ORGANIZER_FESTIVAL_PATCH_ALLOWED_KEYS);
  if (!strictValidation.ok) {
    return NextResponse.json(
      { error: `Непознато поле: ${strictValidation.unknownKeys.join(", ")}` },
      { status: 400 },
    );
  }

  const parsed = canonicalPatchFromUnknown(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const canonical = parsed.data;
  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = {
    ...festivalPatchFromCanonicalPartial(canonical),
    last_edited_by_organizer_at: nowIso,
    updated_at: nowIso,
  };

  if ("is_free" in body && typeof body.is_free === "boolean") {
    patch.is_free = body.is_free;
  }

  if ("description_short" in body) {
    const raw = body.description_short;
    if (raw !== undefined && raw !== null && typeof raw !== "string") {
      return NextResponse.json({ error: "Невалидно кратко описание." }, { status: 400 });
    }
    patch.description_short = raw === null || raw === undefined ? null : raw.trim() || null;
  }

  if ("hero_image" in canonical) {
    const heroVal = patch.hero_image;
    if (typeof heroVal === "string" && heroVal.trim()) {
      const inc = heroVal.trim();
      if (/^https?:\/\//i.test(inc) && !isAlreadyOurSupabaseHeroPublicUrl(inc)) {
        const timestamp = Date.now();
        const outcome = await rehostHeroImageIfRemote(
          admin,
          inc,
          (ext) => `festival-hero/organizer/festival-${id}-${timestamp}.${ext}`,
        );
        if (!outcome.ok) {
          return NextResponse.json({ error: `Основна снимка: ${outcome.error}` }, { status: 422 });
        }
        patch.hero_image = outcome.publicUrl;
        patch.image_url = outcome.publicUrl;
      }
    }
  }

  let selectedCitySlug: string | null = null;
  if ("city_name_display" in canonical) {
    const cityInputRaw = typeof canonical.city_name_display === "string" ? canonical.city_name_display : null;
    const cityInput = normalizeSettlementInput(cityInputRaw ?? "");
    if (!cityInput) {
      patch.city_id = null;
      patch.city = null;
    } else {
      const cityResolution = await resolveOrCreateCityReference(admin, cityInput);
      if (!cityResolution?.city) {
        return NextResponse.json({ error: "Градът не можа да бъде разпознат." }, { status: 400 });
      }
      patch.city_id = cityResolution.city.id;
      patch.city = cityResolution.city.slug;
      selectedCitySlug = cityResolution.city.slug;
    }
  }

  if ("occurrence_dates" in body) {
    const merged = mergeOccurrenceDatesWithRange({
      occurrence_days: body.occurrence_dates,
      start_date: typeof body.start_date === "string" ? body.start_date : (typeof patch.start_date === "string" ? patch.start_date : null),
      end_date: typeof body.end_date === "string" ? body.end_date : (typeof patch.end_date === "string" ? patch.end_date : null),
    });
    patch.occurrence_dates = merged.occurrence_dates;
    patch.start_date = merged.start_date;
    patch.end_date = merged.end_date;
  }

  const diffColumns = Object.keys(patch).filter((k) => k !== "updated_at" && k !== "last_edited_by_organizer_at");
  let beforeRow: Record<string, unknown> | null = null;
  if (diffColumns.length > 0) {
    const { data } = await admin.from("festivals").select(diffColumns.join(",")).eq("id", id).maybeSingle();
    beforeRow = (data ?? null) as Record<string, unknown> | null;
  }

  const { error: updateError } = await admin.from("festivals").update(patch).eq("id", id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  let afterRow: Record<string, unknown> | null = null;
  if (diffColumns.length > 0) {
    const { data } = await admin.from("festivals").select(diffColumns.join(",")).eq("id", id).maybeSingle();
    afterRow = (data ?? null) as Record<string, unknown> | null;
  }

  try {
    await logAdminAction({
      actor_user_id: session.user.id,
      action: "festival.organizer_edited",
      entity_type: "festival",
      entity_id: id,
      route: "/api/organizer/festivals/[id]",
      method: "PATCH",
      details: {
        organizer_id: gate.organizerId,
        changed_fields: diffColumns,
        before: pickFields(beforeRow, diffColumns),
        after: pickFields(afterRow, diffColumns),
      },
    });
  } catch (auditError) {
    const message = auditError instanceof Error ? auditError.message : "unknown";
    console.error("[organizer/audit] festival.organizer_edited failed", { message });
  }

  return NextResponse.json({ ok: true, city_slug: selectedCitySlug });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/organizer/festivals/[id]/route.ts
git commit -m "feat(organizer): add self-edit PATCH route for published festivals"
```

---

## Task 6: Gallery GET/POST route

**Files:**
- Create: `app/api/organizer/festivals/[id]/media/route.ts`

- [ ] **Step 1: Implement the route**

```ts
import { NextResponse } from "next/server";
import { getPortalSessionUser, getPortalAdminClient } from "@/lib/organizer/portal";
import { assertOrganizerCanEditPublishedFestival } from "@/lib/organizer/festivalSelfEdit";
import { rehostHeroImageIfRemote } from "@/lib/admin/rehostHeroImageFromUrl";
import { STORAGE_UPLOAD_CACHE_CONTROL } from "@/lib/storage/cacheControl";
import {
  fetchOrganizerPlanRow,
  getMediaLimitExceededErrorMessage,
  resolveAllowedMediaLimitsFromOrganizerPlan,
  resolveMediaPlanFromOrganizer,
} from "@/lib/admin/mediaLimits";
import { logAdminAction } from "@/lib/admin/audit-log";

const HERO_IMAGES_BUCKET = process.env.SUPABASE_HERO_IMAGES_BUCKET || "festival-hero-images";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function extensionFromMimeType(mimeType: string) {
  const normalized = mimeType.toLowerCase();
  if (normalized === "image/jpeg") return "jpg";
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  if (normalized === "image/gif") return "gif";
  if (normalized === "image/avif") return "avif";
  if (normalized === "image/svg+xml") return "svg";
  return null;
}

function extensionFromFileName(name: string) {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? null;
}

type PortalAdminClient = ReturnType<typeof getPortalAdminClient>;

async function assertGalleryInsertAllowed(
  admin: PortalAdminClient,
  organizerId: string,
  festivalId: string,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const { data: organizerPlanRow, error: orgFetchError } = await fetchOrganizerPlanRow(admin, organizerId);
  if (orgFetchError) {
    return { ok: false, response: NextResponse.json({ error: orgFetchError.message }, { status: 500 }) };
  }

  const plan = resolveMediaPlanFromOrganizer(organizerPlanRow);
  const limits = resolveAllowedMediaLimitsFromOrganizerPlan(organizerPlanRow);

  const { count: nonHeroCount, error: nonHeroCountError } = await admin
    .from("festival_media")
    .select("id", { count: "exact", head: true })
    .eq("festival_id", festivalId)
    .eq("is_hero", false);

  if (nonHeroCountError) {
    return { ok: false, response: NextResponse.json({ error: nonHeroCountError.message }, { status: 500 }) };
  }

  const currentImages = typeof nonHeroCount === "number" ? nonHeroCount : 0;
  if (currentImages >= limits.gallery) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: getMediaLimitExceededErrorMessage({ mediaType: "gallery", current: currentImages, limit: limits.gallery, plan }) },
        { status: 409 },
      ),
    };
  }

  return { ok: true };
}

async function insertGalleryRowAndMarkEdited(
  admin: PortalAdminClient,
  festivalId: string,
  publicUrl: string,
): Promise<{ ok: true; row: Record<string, unknown> } | { ok: false; response: NextResponse }> {
  const { data: maxRow } = await admin
    .from("festival_media")
    .select("sort_order")
    .eq("festival_id", festivalId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = typeof maxRow?.sort_order === "number" ? maxRow.sort_order + 1 : 0;

  const { data: inserted, error: insertError } = await admin
    .from("festival_media")
    .insert({ festival_id: festivalId, url: publicUrl, type: "image", sort_order: nextOrder, is_hero: false })
    .select("id, festival_id, url, type, caption, sort_order, is_hero")
    .maybeSingle();

  if (insertError) {
    return { ok: false, response: NextResponse.json({ error: insertError.message }, { status: 500 }) };
  }
  if (!inserted) {
    return { ok: false, response: NextResponse.json({ error: "Добавянето не бе успешно." }, { status: 500 }) };
  }

  await admin.from("festivals").update({ last_edited_by_organizer_at: new Date().toISOString() }).eq("id", festivalId);

  return { ok: true, row: inserted as Record<string, unknown> };
}

async function logOrganizerMediaAction(
  actorUserId: string,
  festivalId: string,
  organizerId: string,
  action: "added" | "removed",
  url: string,
) {
  try {
    await logAdminAction({
      actor_user_id: actorUserId,
      action: action === "added" ? "festival.organizer_media_added" : "festival.organizer_media_removed",
      entity_type: "festival",
      entity_id: festivalId,
      route: "/api/organizer/festivals/[id]/media",
      method: action === "added" ? "POST" : "DELETE",
      details: { organizer_id: organizerId, url },
    });
  } catch (auditError) {
    const message = auditError instanceof Error ? auditError.message : "unknown";
    console.error("[organizer/audit] festival.organizer_media failed", { message });
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getPortalSessionUser();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Необходим е вход." }, { status: 401 });
  }

  let admin: PortalAdminClient;
  try {
    admin = getPortalAdminClient();
  } catch {
    return NextResponse.json({ error: "Услугата е временно недостъпна." }, { status: 503 });
  }

  const { id } = await params;
  const gate = await assertOrganizerCanEditPublishedFestival(admin, session.user.id, id);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const { data, error } = await admin
    .from("festival_media")
    .select("id, festival_id, url, type, caption, sort_order, is_hero")
    .eq("festival_id", id)
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ media: data ?? [] });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getPortalSessionUser();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Необходим е вход." }, { status: 401 });
  }

  let admin: PortalAdminClient;
  try {
    admin = getPortalAdminClient();
  } catch {
    return NextResponse.json({ error: "Услугата е временно недостъпна." }, { status: 503 });
  }

  const { id: festivalId } = await params;
  const gate = await assertOrganizerCanEditPublishedFestival(admin, session.user.id, festivalId);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = (await request.json().catch(() => null)) as { source_url?: unknown } | null;
      const sourceUrl = typeof body?.source_url === "string" ? body.source_url : "";
      if (!sourceUrl.trim()) {
        return NextResponse.json({ error: "Изисква се връзка към снимка." }, { status: 400 });
      }
      if (!/^https?:\/\//i.test(sourceUrl.trim())) {
        return NextResponse.json({ error: "Връзката трябва да започва с http:// или https://." }, { status: 400 });
      }

      const eligibility = await assertGalleryInsertAllowed(admin, gate.organizerId, festivalId);
      if (!eligibility.ok) return eligibility.response;

      const timestamp = Date.now();
      const outcome = await rehostHeroImageIfRemote(
        admin,
        sourceUrl,
        (ext) => `festival-hero/gallery/festival-${festivalId}-${timestamp}.${ext}`,
      );
      if (!outcome.ok) {
        return NextResponse.json({ error: outcome.error }, { status: 422 });
      }

      const inserted = await insertGalleryRowAndMarkEdited(admin, festivalId, outcome.publicUrl);
      if (!inserted.ok) return inserted.response;

      await logOrganizerMediaAction(session.user.id, festivalId, gate.organizerId, "added", outcome.publicUrl);
      return NextResponse.json({ ok: true, row: inserted.row });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Не е предоставен файл." }, { status: 400 });
    }
    if (!file.type || !file.type.toLowerCase().startsWith("image/")) {
      return NextResponse.json({ error: "Позволени са само изображения." }, { status: 400 });
    }
    if (file.size <= 0) {
      return NextResponse.json({ error: "Файлът е празен." }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: `Файлът е твърде голям. Максимум ${Math.floor(MAX_IMAGE_BYTES / (1024 * 1024))}MB.` },
        { status: 400 },
      );
    }

    const extension = extensionFromMimeType(file.type) ?? extensionFromFileName(file.name) ?? "bin";
    const timestamp = Date.now();
    const objectPath = `festival-hero/gallery/festival-${festivalId}-${timestamp}.${extension}`;

    const eligibility = await assertGalleryInsertAllowed(admin, gate.organizerId, festivalId);
    if (!eligibility.ok) return eligibility.response;

    const imageBuffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await admin.storage.from(HERO_IMAGES_BUCKET).upload(objectPath, imageBuffer, {
      upsert: false,
      contentType: file.type,
      cacheControl: STORAGE_UPLOAD_CACHE_CONTROL,
    });
    if (uploadError) {
      return NextResponse.json({ error: `Качването неуспешно: ${uploadError.message}` }, { status: 500 });
    }

    const { data: publicData } = admin.storage.from(HERO_IMAGES_BUCKET).getPublicUrl(objectPath);
    const publicUrl = publicData?.publicUrl ?? null;
    if (!publicUrl) {
      return NextResponse.json({ error: "URL на изображението не е достъпен." }, { status: 500 });
    }

    const inserted = await insertGalleryRowAndMarkEdited(admin, festivalId, publicUrl);
    if (!inserted.ok) return inserted.response;

    await logOrganizerMediaAction(session.user.id, festivalId, gate.organizerId, "added", publicUrl);
    return NextResponse.json({ ok: true, row: inserted.row });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Грешка при качване.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/api/organizer/festivals/[id]/media/route.ts"
git commit -m "feat(organizer): add self-edit gallery list/add route"
```

---

## Task 7: Gallery delete route

**Files:**
- Create: `app/api/organizer/festivals/[id]/media/[mediaId]/route.ts`

- [ ] **Step 1: Implement the route**

```ts
import { NextResponse } from "next/server";
import { getPortalSessionUser, getPortalAdminClient } from "@/lib/organizer/portal";
import { assertOrganizerCanEditPublishedFestival } from "@/lib/organizer/festivalSelfEdit";
import { removeHeroStorageObjectIfUnreferenced } from "@/lib/admin/festivalHeroStorageCleanup";
import { logAdminAction } from "@/lib/admin/audit-log";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; mediaId: string }> }) {
  const session = await getPortalSessionUser();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Необходим е вход." }, { status: 401 });
  }

  let admin;
  try {
    admin = getPortalAdminClient();
  } catch {
    return NextResponse.json({ error: "Услугата е временно недостъпна." }, { status: 503 });
  }

  const { id: festivalId, mediaId } = await params;
  const gate = await assertOrganizerCanEditPublishedFestival(admin, session.user.id, festivalId);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const { data: row, error: fetchError } = await admin
    .from("festival_media")
    .select("id, festival_id, url, type")
    .eq("id", mediaId)
    .eq("festival_id", festivalId)
    .maybeSingle<{ id: string; festival_id: string; url: string | null; type: string | null }>();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Не е намерено." }, { status: 404 });
  }

  const typeLower = (row.type ?? "").toLowerCase();
  const isVideo = typeLower.includes("video");
  const mediaUrl = !isVideo && typeof row.url === "string" ? row.url.trim() : "";

  const { error } = await admin.from("festival_media").delete().eq("id", mediaId).eq("festival_id", festivalId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (mediaUrl) {
    const removal = await removeHeroStorageObjectIfUnreferenced(admin, mediaUrl);
    if (!removal.ok) {
      return NextResponse.json({ error: `Грешка при изчистване на хранилището: ${removal.message}` }, { status: 500 });
    }
  }

  await admin.from("festivals").update({ last_edited_by_organizer_at: new Date().toISOString() }).eq("id", festivalId);

  try {
    await logAdminAction({
      actor_user_id: session.user.id,
      action: "festival.organizer_media_removed",
      entity_type: "festival",
      entity_id: festivalId,
      route: "/api/organizer/festivals/[id]/media/[mediaId]",
      method: "DELETE",
      details: { organizer_id: gate.organizerId, url: mediaUrl || row.url },
    });
  } catch (auditError) {
    const message = auditError instanceof Error ? auditError.message : "unknown";
    console.error("[organizer/audit] festival.organizer_media_removed failed", { message });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/api/organizer/festivals/[id]/media/[mediaId]/route.ts"
git commit -m "feat(organizer): add self-edit gallery delete route"
```

---

## Task 8: Video link route

**Files:**
- Create: `app/api/organizer/festivals/[id]/media/video/route.ts`

- [ ] **Step 1: Implement the route**

```ts
import { NextResponse } from "next/server";
import { getPortalSessionUser, getPortalAdminClient } from "@/lib/organizer/portal";
import { assertOrganizerCanEditPublishedFestival } from "@/lib/organizer/festivalSelfEdit";
import { isSupportedVideoPageUrl } from "@/lib/festival/videoEmbed";
import {
  fetchOrganizerPlanRow,
  getMediaLimitExceededErrorMessage,
  resolveAllowedMediaLimitsFromOrganizerPlan,
  resolveMediaPlanFromOrganizer,
} from "@/lib/admin/mediaLimits";
import { logAdminAction } from "@/lib/admin/audit-log";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getPortalSessionUser();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Необходим е вход." }, { status: 401 });
  }

  let admin;
  try {
    admin = getPortalAdminClient();
  } catch {
    return NextResponse.json({ error: "Услугата е временно недостъпна." }, { status: 503 });
  }

  const { id: festivalId } = await params;
  const gate = await assertOrganizerCanEditPublishedFestival(admin, session.user.id, festivalId);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  try {
    const body = (await request.json().catch(() => null)) as { video_url?: unknown } | null;
    const raw = typeof body?.video_url === "string" ? body.video_url.trim() : "";

    if (raw && !isSupportedVideoPageUrl(raw)) {
      return NextResponse.json(
        { error: "Поддържани са само публични линкове към YouTube или Facebook видео." },
        { status: 400 },
      );
    }

    const { data: organizerPlanRow, error: orgFetchError } = await fetchOrganizerPlanRow(admin, gate.organizerId);
    if (orgFetchError) {
      return NextResponse.json({ error: orgFetchError.message }, { status: 500 });
    }

    const plan = resolveMediaPlanFromOrganizer(organizerPlanRow);
    const limits = resolveAllowedMediaLimitsFromOrganizerPlan(organizerPlanRow);

    const futureVideoCount = raw ? 1 : 0;
    if (futureVideoCount > limits.video) {
      return NextResponse.json(
        { error: getMediaLimitExceededErrorMessage({ mediaType: "video", current: futureVideoCount, limit: limits.video, plan }) },
        { status: 409 },
      );
    }

    const { error: legacyVideoDelError } = await admin
      .from("festival_media")
      .delete()
      .eq("festival_id", festivalId)
      .ilike("type", "%video%");
    if (legacyVideoDelError) {
      return NextResponse.json({ error: legacyVideoDelError.message }, { status: 500 });
    }

    const updatedAt = new Date().toISOString();
    const { error: updError } = await admin
      .from("festivals")
      .update({ video_url: raw || null, updated_at: updatedAt, last_edited_by_organizer_at: updatedAt })
      .eq("id", festivalId);

    if (updError) {
      return NextResponse.json({ error: updError.message }, { status: 500 });
    }

    try {
      await logAdminAction({
        actor_user_id: session.user.id,
        action: "festival.organizer_video_updated",
        entity_type: "festival",
        entity_id: festivalId,
        route: "/api/organizer/festivals/[id]/media/video",
        method: "PUT",
        details: { organizer_id: gate.organizerId, video_url: raw || null },
      });
    } catch (auditError) {
      const message = auditError instanceof Error ? auditError.message : "unknown";
      console.error("[organizer/audit] festival.organizer_video_updated failed", { message });
    }

    return NextResponse.json({ ok: true, video_url: raw || null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неочаквана грешка.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/api/organizer/festivals/[id]/media/video/route.ts"
git commit -m "feat(organizer): add self-edit video link route"
```

---

## Task 9: Hero image route

**Files:**
- Create: `app/api/organizer/festivals/[id]/hero-image/route.ts`

- [ ] **Step 1: Implement the route**

```ts
import { NextResponse } from "next/server";
import { getPortalSessionUser, getPortalAdminClient } from "@/lib/organizer/portal";
import { assertOrganizerCanEditPublishedFestival } from "@/lib/organizer/festivalSelfEdit";
import { rehostHeroImageIfRemote } from "@/lib/admin/rehostHeroImageFromUrl";
import { logAdminAction } from "@/lib/admin/audit-log";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getPortalSessionUser();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Необходим е вход." }, { status: 401 });
  }

  let admin;
  try {
    admin = getPortalAdminClient();
  } catch {
    return NextResponse.json({ error: "Услугата е временно недостъпна." }, { status: 503 });
  }

  const { id: festivalId } = await params;
  const gate = await assertOrganizerCanEditPublishedFestival(admin, session.user.id, festivalId);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  try {
    const body = (await request.json().catch(() => null)) as { source_url?: unknown } | null;
    const sourceUrl = typeof body?.source_url === "string" ? body.source_url : "";
    if (!sourceUrl.trim()) {
      return NextResponse.json({ error: "Изисква се връзка към снимка." }, { status: 400 });
    }

    const timestamp = Date.now();
    const outcome = await rehostHeroImageIfRemote(
      admin,
      sourceUrl,
      (ext) => `festival-hero/organizer/festival-${festivalId}-${timestamp}.${ext}`,
    );
    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.error }, { status: 422 });
    }

    const publicUrl = outcome.publicUrl;
    const updatedAt = new Date().toISOString();

    const { data: updatedRow, error: updateError } = await admin
      .from("festivals")
      .update({ hero_image: publicUrl, image_url: publicUrl, updated_at: updatedAt, last_edited_by_organizer_at: updatedAt })
      .eq("id", festivalId)
      .select("id, hero_image, image_url")
      .maybeSingle();

    if (updateError) {
      return NextResponse.json({ error: `Грешка при обновяване на основната снимка: ${updateError.message}` }, { status: 500 });
    }
    if (!updatedRow) {
      return NextResponse.json({ error: "Фестивалът не е намерен." }, { status: 404 });
    }

    const { data: existingMedia } = await admin
      .from("festival_media")
      .select("id")
      .eq("festival_id", festivalId)
      .eq("url", publicUrl)
      .maybeSingle();

    if (!existingMedia) {
      const { data: maxOrderRow } = await admin
        .from("festival_media")
        .select("sort_order")
        .eq("festival_id", festivalId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextOrder = typeof maxOrderRow?.sort_order === "number" ? maxOrderRow.sort_order + 1 : 0;

      await admin.from("festival_media").insert({
        festival_id: festivalId,
        url: publicUrl,
        type: "image",
        sort_order: nextOrder,
        is_hero: false,
      });
    }

    try {
      await logAdminAction({
        actor_user_id: session.user.id,
        action: "festival.organizer_hero_updated",
        entity_type: "festival",
        entity_id: festivalId,
        route: "/api/organizer/festivals/[id]/hero-image",
        method: "PUT",
        details: { organizer_id: gate.organizerId, hero_image: publicUrl },
      });
    } catch (auditError) {
      const message = auditError instanceof Error ? auditError.message : "unknown";
      console.error("[organizer/audit] festival.organizer_hero_updated failed", { message });
    }

    return NextResponse.json({ ok: true, hero_image: updatedRow.hero_image, image_url: updatedRow.image_url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неочаквана грешка при основната снимка.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/api/organizer/festivals/[id]/hero-image/route.ts"
git commit -m "feat(organizer): add self-edit hero image route"
```

---

## Task 10: Schedule route

**Files:**
- Create: `app/api/organizer/festivals/[id]/schedule/route.ts`

- [ ] **Step 1: Implement the route**

```ts
import { NextResponse } from "next/server";
import { getPortalSessionUser, getPortalAdminClient } from "@/lib/organizer/portal";
import { assertOrganizerCanEditPublishedFestival } from "@/lib/organizer/festivalSelfEdit";
import { logAdminAction } from "@/lib/admin/audit-log";
import {
  parseProgramDraftUnknown,
  programDraftToPublishPayload,
  publishedRowsToProgramDraft,
  replaceFestivalScheduleFromProgramDraft,
} from "@/lib/festival/programDraft";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getPortalSessionUser();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Необходим е вход." }, { status: 401 });
  }

  let admin;
  try {
    admin = getPortalAdminClient();
  } catch {
    return NextResponse.json({ error: "Услугата е временно недостъпна." }, { status: 503 });
  }

  const { id } = await params;
  const gate = await assertOrganizerCanEditPublishedFestival(admin, session.user.id, id);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const { data: days, error: daysErr } = await admin
    .from("festival_days")
    .select("id, date, title")
    .eq("festival_id", id)
    .order("date", { ascending: true });

  if (daysErr) {
    return NextResponse.json({ error: daysErr.message }, { status: 500 });
  }

  const dayList = days ?? [];
  const dayIds = dayList.map((d) => d.id as string);
  let items: Array<{
    day_id: string;
    title: string;
    start_time: string | null;
    end_time: string | null;
    stage: string | null;
    description: string | null;
    sort_order: number | null;
  }> = [];

  if (dayIds.length > 0) {
    const { data: itemRows, error: itemsErr } = await admin
      .from("festival_schedule_items")
      .select("day_id, title, start_time, end_time, stage, description, sort_order")
      .in("day_id", dayIds)
      .order("sort_order", { ascending: true })
      .order("start_time", { ascending: true });

    if (itemsErr) {
      return NextResponse.json({ error: itemsErr.message }, { status: 500 });
    }
    items = (itemRows ?? []) as typeof items;
  }

  const program_draft = publishedRowsToProgramDraft(
    dayList.map((d) => ({ id: String(d.id), date: String(d.date), title: d.title })),
    items,
  );

  return NextResponse.json({ ok: true, program_draft });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getPortalSessionUser();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Необходим е вход." }, { status: 401 });
  }

  let admin;
  try {
    admin = getPortalAdminClient();
  } catch {
    return NextResponse.json({ error: "Услугата е временно недостъпна." }, { status: 503 });
  }

  const { id } = await params;
  const gate = await assertOrganizerCanEditPublishedFestival(admin, session.user.id, id);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = (await request.json().catch(() => null)) as { program_draft?: unknown } | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Невалидно тяло на заявката." }, { status: 400 });
  }

  const parsed = parseProgramDraftUnknown(body.program_draft);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const draft = programDraftToPublishPayload(parsed.value);

  try {
    await replaceFestivalScheduleFromProgramDraft(admin, id, draft);
    const updatedAt = new Date().toISOString();
    const { error: festivalDraftErr } = await admin
      .from("festivals")
      .update({ program_draft: draft, last_edited_by_organizer_at: updatedAt })
      .eq("id", id);
    if (festivalDraftErr) {
      throw new Error(`festival program_draft update failed: ${festivalDraftErr.message}`);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Грешка при обновяване на програмата.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  try {
    await logAdminAction({
      actor_user_id: session.user.id,
      action: "festival.organizer_schedule_updated",
      entity_type: "festival",
      entity_id: id,
      route: "/api/organizer/festivals/[id]/schedule",
      method: "PUT",
      details: {
        organizer_id: gate.organizerId,
        day_count: draft?.days.length ?? 0,
        item_count: draft ? draft.days.reduce((n, d) => n + d.items.length, 0) : 0,
      },
    });
  } catch (auditError) {
    const message = auditError instanceof Error ? auditError.message : "unknown";
    console.error("[organizer/audit] festival.organizer_schedule_updated failed", { message });
  }

  const savedItemsCount = draft ? draft.days.reduce((n, d) => n + d.items.length, 0) : 0;
  return NextResponse.json({ ok: true, savedItemsCount });
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/api/organizer/festivals/[id]/schedule/route.ts"
git commit -m "feat(organizer): add self-edit schedule route"
```

---

## Task 11: Admin list indicator

**Files:**
- Modify: `app/admin/api/festivals/route.ts:113`
- Modify: `app/admin/(protected)/festivals/page.tsx`
- Modify: `components/admin/FestivalsTable.tsx`

- [ ] **Step 1: Add the column to the list API select**

In `app/admin/api/festivals/route.ts`, line 113, change:

```ts
      .select(
        "id,title,description,city,city_id,lat,lng,start_date,end_date,start_time,end_time,occurrence_dates,category,is_free,status,updated_at,created_at,source_type,location_name,organizer_name,hero_image,tags,cities:cities!festivals_city_id_fkey(id,name_bg,slug)",
      )
```

to:

```ts
      .select(
        "id,title,description,city,city_id,lat,lng,start_date,end_date,start_time,end_time,occurrence_dates,category,is_free,status,updated_at,created_at,source_type,location_name,organizer_name,hero_image,tags,last_edited_by_organizer_at,cities:cities!festivals_city_id_fkey(id,name_bg,slug)",
      )
```

- [ ] **Step 2: Add the field to `AdminFestivalRow`**

In `app/admin/(protected)/festivals/page.tsx`, inside the `AdminFestivalRow` type (after `source_type: string | null;`, around line 76), add:

```ts
  last_edited_by_organizer_at: string | null;
```

- [ ] **Step 3: Render the badge in the title column**

In `components/admin/FestivalsTable.tsx`, replace the title `<td>` block (lines 306-311):

```tsx
                  {/* Title */}
                  <td className="max-w-[18rem] px-3 py-3 font-medium text-[#0c0e14]">
                    <Link href={`/admin/festivals/${row.id}`} className="hover:underline">
                      {row.title}
                    </Link>
                  </td>
```

with:

```tsx
                  {/* Title */}
                  <td className="max-w-[18rem] px-3 py-3 font-medium text-[#0c0e14]">
                    <Link href={`/admin/festivals/${row.id}`} className="hover:underline">
                      {row.title}
                    </Link>
                    {row.last_edited_by_organizer_at ? (
                      <span
                        className="ml-2 inline-flex rounded-full border border-[#7c2d12]/30 bg-[#7c2d12]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7c2d12]"
                        title={`Последно редактирано от организатор: ${new Date(row.last_edited_by_organizer_at).toLocaleString("bg-BG")}`}
                      >
                        Ред. от организатор
                      </span>
                    ) : null}
                  </td>
```

- [ ] **Step 4: Manually verify**

Run `npm run dev`, open `/admin/festivals`, confirm the page still loads and no existing row shows the new badge (column is null for all current rows until Task 12 ships and an organizer edits something).

- [ ] **Step 5: Commit**

```bash
git add app/admin/api/festivals/route.ts "app/admin/(protected)/festivals/page.tsx" components/admin/FestivalsTable.tsx
git commit -m "feat(admin): show organizer-edited indicator on festivals list"
```

---

## Task 12: Organizer edit page UI

**Files:**
- Create: `app/organizer/(workspace)/festivals/[id]/edit/page.tsx`
- Create: `app/organizer/(workspace)/festivals/[id]/edit/OrganizerFestivalEditClient.tsx`

This is a new single-page form (not the multi-step submission wizard), scoped to `ORGANIZER_FESTIVAL_PATCH_ALLOWED_KEYS`. It intentionally does not expose `latitude`/`longitude`/`coords_override`/`place_id` editing in v1 (no map picker) — those stay in the API allowlist for a future iteration but the UI only covers text/date/media/schedule fields, per the spec's YAGNI guidance.

- [ ] **Step 1: Implement the server page**

```tsx
import { redirect } from "next/navigation";
import { getPortalAdminClient, getPortalSessionUser } from "@/lib/organizer/portal";
import { assertOrganizerCanEditPublishedFestival } from "@/lib/organizer/festivalSelfEdit";
import { dbTimeToHmInput } from "@/lib/festival/festivalTimeFields";
import { normalizeOccurrenceDatesInput } from "@/lib/festival/occurrenceDates";
import { publishedRowsToProgramDraft } from "@/lib/festival/programDraft";
import OrganizerFestivalEditClient, { type OrganizerFestivalEditInitial } from "./OrganizerFestivalEditClient";

export default async function OrganizerFestivalEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getPortalSessionUser();
  if (!session?.user?.id) {
    redirect(`/login?next=${encodeURIComponent(`/organizer/festivals/${id}/edit`)}`);
  }

  let admin: ReturnType<typeof getPortalAdminClient>;
  try {
    admin = getPortalAdminClient();
  } catch {
    redirect("/organizer/dashboard");
  }

  const gate = await assertOrganizerCanEditPublishedFestival(admin, session!.user.id, id);
  if (!gate.ok) {
    redirect("/organizer/dashboard");
  }

  const { data: festival } = await admin
    .from("festivals")
    .select(
      "id,title,description,description_short,category,tags,city_id,city,location_name,address,start_date,end_date,start_time,end_time,occurrence_dates,hero_image,website_url,ticket_url,price_range,is_free,video_url",
    )
    .eq("id", id)
    .maybeSingle();

  if (!festival) {
    redirect("/organizer/dashboard");
  }

  const { data: cityRow } = festival.city_id
    ? await admin.from("cities").select("name_bg").eq("id", festival.city_id).maybeSingle()
    : { data: null as { name_bg: string } | null };

  const { data: mediaRows } = await admin
    .from("festival_media")
    .select("id, url, sort_order")
    .eq("festival_id", id)
    .eq("is_hero", false)
    .order("sort_order", { ascending: true });

  const { data: dayRows } = await admin
    .from("festival_days")
    .select("id, date, title")
    .eq("festival_id", id)
    .order("date", { ascending: true });

  const dayIds = (dayRows ?? []).map((d) => String(d.id));
  const { data: itemRows } = dayIds.length
    ? await admin
        .from("festival_schedule_items")
        .select("day_id, title, start_time, end_time, stage, description, sort_order")
        .in("day_id", dayIds)
        .order("sort_order", { ascending: true })
    : { data: [] as never[] };

  const programDraft = publishedRowsToProgramDraft(
    (dayRows ?? []).map((d) => ({ id: String(d.id), date: String(d.date), title: d.title })),
    itemRows ?? [],
  );

  const initial: OrganizerFestivalEditInitial = {
    id: festival.id,
    title: festival.title ?? "",
    description: festival.description ?? "",
    descriptionShort: festival.description_short ?? "",
    category: festival.category ?? "",
    tagsInput: Array.isArray(festival.tags) ? festival.tags.join(", ") : "",
    city: cityRow?.name_bg ?? festival.city ?? "",
    locationName: festival.location_name ?? "",
    address: festival.address ?? "",
    startDate: festival.start_date ?? "",
    endDate: festival.end_date ?? "",
    startTime: dbTimeToHmInput(festival.start_time ?? null),
    endTime: dbTimeToHmInput(festival.end_time ?? null),
    occurrenceDates: normalizeOccurrenceDatesInput(festival.occurrence_dates) ?? [],
    heroImage: festival.hero_image ?? "",
    websiteUrl: festival.website_url ?? "",
    ticketUrl: festival.ticket_url ?? "",
    priceRange: festival.price_range ?? "",
    isFree: festival.is_free ?? true,
    videoUrl: festival.video_url ?? "",
    gallery: (mediaRows ?? []).map((m) => ({ id: String(m.id), url: String(m.url) })),
    programDraft,
  };

  return <OrganizerFestivalEditClient initial={initial} />;
}
```

- [ ] **Step 2: Implement the client component**

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import OrganizerProgramEditor from "@/app/organizer/(workspace)/festivals/new/OrganizerProgramEditor";
import { emptyProgramDraft, type ProgramDraft } from "@/lib/festival/programDraft";

export type OrganizerFestivalEditInitial = {
  id: string;
  title: string;
  description: string;
  descriptionShort: string;
  category: string;
  tagsInput: string;
  city: string;
  locationName: string;
  address: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  occurrenceDates: string[];
  heroImage: string;
  websiteUrl: string;
  ticketUrl: string;
  priceRange: string;
  isFree: boolean;
  videoUrl: string;
  gallery: { id: string; url: string }[];
  programDraft: ProgramDraft;
};

const FIELD_CLASS =
  "w-full rounded-lg border border-black/[0.1] bg-white px-3 py-2 text-sm text-[#0c0e14] outline-none transition-all duration-150 placeholder:text-black/40 hover:border-black/20 focus-visible:border-black/15 focus-visible:ring-1 focus-visible:ring-[#7c2d12]/25";
const LABEL_CLASS = "block text-xs font-medium text-[#0c0e14] mb-1";

export default function OrganizerFestivalEditClient({ initial }: { initial: OrganizerFestivalEditInitial }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [descriptionShort, setDescriptionShort] = useState(initial.descriptionShort);
  const [category, setCategory] = useState(initial.category);
  const [tagsInput, setTagsInput] = useState(initial.tagsInput);
  const [city, setCity] = useState(initial.city);
  const [locationName, setLocationName] = useState(initial.locationName);
  const [address, setAddress] = useState(initial.address);
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [startTime, setStartTime] = useState(initial.startTime);
  const [endTime, setEndTime] = useState(initial.endTime);
  const [occurrenceDatesInput, setOccurrenceDatesInput] = useState(initial.occurrenceDates.join(", "));
  const [heroImageUrl, setHeroImageUrl] = useState(initial.heroImage);
  const [websiteUrl, setWebsiteUrl] = useState(initial.websiteUrl);
  const [ticketUrl, setTicketUrl] = useState(initial.ticketUrl);
  const [priceRange, setPriceRange] = useState(initial.priceRange);
  const [isFree, setIsFree] = useState(initial.isFree);
  const [videoUrl, setVideoUrl] = useState(initial.videoUrl);
  const [gallery, setGallery] = useState(initial.gallery);
  const [galleryUrlInput, setGalleryUrlInput] = useState("");
  const [programDraft, setProgramDraft] = useState<ProgramDraft>(initial.programDraft ?? emptyProgramDraft());
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveCoreFields() {
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const occurrenceDates = occurrenceDatesInput
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean);
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch(`/api/organizer/festivals/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          description_short: descriptionShort || null,
          category: category || null,
          tags,
          city,
          location_name: locationName || null,
          address: address || null,
          start_date: startDate || null,
          end_date: endDate || null,
          start_time: startTime || null,
          end_time: endTime || null,
          occurrence_dates: occurrenceDates.length > 0 ? occurrenceDates : null,
          hero_image: heroImageUrl || null,
          website_url: websiteUrl || null,
          ticket_url: ticketUrl || null,
          price_range: priceRange || null,
          is_free: isFree,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(payload.error ?? "Неуспешно запазване.");
        return;
      }
      setSuccess("Запазено.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неуспешно запазване.");
    } finally {
      setSaving(false);
    }
  }

  async function saveVideo() {
    setError("");
    setSuccess("");
    const res = await fetch(`/api/organizer/festivals/${initial.id}/media/video`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_url: videoUrl || null }),
    });
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(payload.error ?? "Неуспешно запазване на видео.");
      return;
    }
    setSuccess("Видео връзката е обновена.");
  }

  async function addGalleryImage() {
    setError("");
    setSuccess("");
    const sourceUrl = galleryUrlInput.trim();
    if (!sourceUrl) return;
    const res = await fetch(`/api/organizer/festivals/${initial.id}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_url: sourceUrl }),
    });
    const payload = (await res.json().catch(() => ({}))) as { error?: string; row?: { id: string; url: string } };
    if (!res.ok) {
      setError(payload.error ?? "Неуспешно добавяне на снимка.");
      return;
    }
    if (payload.row) {
      setGallery((prev) => [...prev, { id: payload.row!.id, url: payload.row!.url }]);
    }
    setGalleryUrlInput("");
  }

  async function removeGalleryImage(mediaId: string) {
    setError("");
    setSuccess("");
    const res = await fetch(`/api/organizer/festivals/${initial.id}/media/${mediaId}`, { method: "DELETE" });
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(payload.error ?? "Неуспешно премахване на снимка.");
      return;
    }
    setGallery((prev) => prev.filter((g) => g.id !== mediaId));
  }

  async function saveSchedule() {
    setError("");
    setSuccess("");
    const res = await fetch(`/api/organizer/festivals/${initial.id}/schedule`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ program_draft: programDraft }),
    });
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(payload.error ?? "Неуспешно запазване на програмата.");
      return;
    }
    setSuccess("Програмата е обновена.");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#0c0e14]">Редактирай фестивал</h1>
        <Link href="/organizer/dashboard" className="text-sm text-black/60 hover:underline">
          ← Назад към таблото
        </Link>
      </div>

      {error ? <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div> : null}
      {success ? <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{success}</div> : null}

      <section className="space-y-3 rounded-2xl border border-black/[0.08] bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-black/50">Основна информация</h2>
        <label className={LABEL_CLASS}>
          Заглавие
          <input className={FIELD_CLASS} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className={LABEL_CLASS}>
          Описание
          <textarea className={FIELD_CLASS} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className={LABEL_CLASS}>
          Кратко описание
          <input className={FIELD_CLASS} value={descriptionShort} onChange={(e) => setDescriptionShort(e.target.value)} />
        </label>
        <label className={LABEL_CLASS}>
          Категория
          <input className={FIELD_CLASS} value={category} onChange={(e) => setCategory(e.target.value)} />
        </label>
        <label className={LABEL_CLASS}>
          Тагове (разделени със запетая)
          <input className={FIELD_CLASS} value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
        </label>
      </section>

      <section className="space-y-3 rounded-2xl border border-black/[0.08] bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-black/50">Локация</h2>
        <label className={LABEL_CLASS}>
          Град
          <input className={FIELD_CLASS} value={city} onChange={(e) => setCity(e.target.value)} />
        </label>
        <label className={LABEL_CLASS}>
          Място
          <input className={FIELD_CLASS} value={locationName} onChange={(e) => setLocationName(e.target.value)} />
        </label>
        <label className={LABEL_CLASS}>
          Адрес
          <input className={FIELD_CLASS} value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>
      </section>

      <section className="space-y-3 rounded-2xl border border-black/[0.08] bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-black/50">Дати и време</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className={LABEL_CLASS}>
            Начална дата
            <input type="date" className={FIELD_CLASS} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className={LABEL_CLASS}>
            Крайна дата
            <input type="date" className={FIELD_CLASS} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <label className={LABEL_CLASS}>
            Начален час
            <input type="time" className={FIELD_CLASS} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </label>
          <label className={LABEL_CLASS}>
            Краен час
            <input type="time" className={FIELD_CLASS} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </label>
        </div>
        <label className={LABEL_CLASS}>
          Конкретни дни (ако фестивалът не е непрекъснат), разделени със запетая, YYYY-MM-DD
          <input className={FIELD_CLASS} value={occurrenceDatesInput} onChange={(e) => setOccurrenceDatesInput(e.target.value)} />
        </label>
      </section>

      <section className="space-y-3 rounded-2xl border border-black/[0.08] bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-black/50">Допълнително</h2>
        <label className={LABEL_CLASS}>
          Основна снимка (връзка)
          <input className={FIELD_CLASS} value={heroImageUrl} onChange={(e) => setHeroImageUrl(e.target.value)} />
        </label>
        <label className={LABEL_CLASS}>
          Уебсайт
          <input className={FIELD_CLASS} value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
        </label>
        <label className={LABEL_CLASS}>
          Връзка за билети
          <input className={FIELD_CLASS} value={ticketUrl} onChange={(e) => setTicketUrl(e.target.value)} />
        </label>
        <label className={LABEL_CLASS}>
          Ценови диапазон
          <input className={FIELD_CLASS} value={priceRange} onChange={(e) => setPriceRange(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm text-[#0c0e14]">
          <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} />
          Безплатен вход
        </label>
        <button
          type="button"
          onClick={saveCoreFields}
          disabled={saving}
          className="rounded-lg bg-[#7c2d12] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Запази основните полета
        </button>
      </section>

      <section className="space-y-3 rounded-2xl border border-black/[0.08] bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-black/50">Видео</h2>
        <label className={LABEL_CLASS}>
          Връзка към YouTube/Facebook видео
          <input className={FIELD_CLASS} value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
        </label>
        <button type="button" onClick={saveVideo} className="rounded-lg border border-black/[0.12] px-4 py-2 text-sm font-semibold">
          Запази видео
        </button>
      </section>

      <section className="space-y-3 rounded-2xl border border-black/[0.08] bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-black/50">Галерия</h2>
        <ul className="grid grid-cols-3 gap-2">
          {gallery.map((image) => (
            <li key={image.id} className="relative">
              <img src={image.url} alt="" className="h-24 w-full rounded-lg object-cover" />
              <button
                type="button"
                onClick={() => removeGalleryImage(image.id)}
                className="absolute right-1 top-1 rounded-full bg-black/70 px-2 py-0.5 text-xs text-white"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input
            className={FIELD_CLASS}
            placeholder="https://… връзка към снимка"
            value={galleryUrlInput}
            onChange={(e) => setGalleryUrlInput(e.target.value)}
          />
          <button type="button" onClick={addGalleryImage} className="rounded-lg border border-black/[0.12] px-4 py-2 text-sm font-semibold">
            Добави
          </button>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-black/[0.08] bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-black/50">Програма</h2>
        <OrganizerProgramEditor value={programDraft} onChange={setProgramDraft} defaultDate={startDate || undefined} />
        <button type="button" onClick={saveSchedule} className="rounded-lg border border-black/[0.12] px-4 py-2 text-sm font-semibold">
          Запази програмата
        </button>
      </section>

      <button type="button" onClick={() => router.push("/organizer/dashboard")} className="text-sm text-black/60 hover:underline">
        Готово, обратно към таблото
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Manually verify**

Run `npm run dev`, log in as an organizer-portal owner with at least one published festival, navigate to `/organizer/festivals/<id>/edit`, change the title, click "Запази основните полета", reload, and confirm the title persisted. Confirm a non-owner organizer visiting the same URL is redirected to `/organizer/dashboard`.

- [ ] **Step 4: Commit**

```bash
git add "app/organizer/(workspace)/festivals/[id]/edit"
git commit -m "feat(organizer): add self-edit page for published festivals"
```

---

## Task 13: Wire the dashboard link and update copy

**Files:**
- Modify: `app/organizer/(workspace)/dashboard/page.tsx`

- [ ] **Step 1: Update the section copy**

Replace (around line 379-382):

```tsx
          <p className="mt-1 text-sm text-black/60">
            Тези фестивали вече са одобрени и видими на festivo.bg. Не подавай нов, ако
            искаш промяна по тях — пиши ни и ще го коригираме.
          </p>
```

with:

```tsx
          <p className="mt-1 text-sm text-black/60">
            Тези фестивали вече са одобрени и видими на festivo.bg. Можеш да редактираш
            директно — промените излизат веднага, без чакане за одобрение.
          </p>
```

- [ ] **Step 2: Add the "Редактирай" link**

Replace the existing `<Link>` block (around lines 402-408):

```tsx
                  <Link
                    href={`/festivals/${festival.slug}`}
                    target="_blank"
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-300/80 bg-emerald-50/70 px-3 py-1.5 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100"
                  >
                    Виж на сайта →
                  </Link>
```

with:

```tsx
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/organizer/festivals/${festival.id}/edit`}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#7c2d12]/30 bg-[#7c2d12]/10 px-3 py-1.5 text-xs font-semibold text-[#7c2d12] transition hover:bg-[#7c2d12]/20"
                    >
                      Редактирай
                    </Link>
                    <Link
                      href={`/festivals/${festival.slug}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-300/80 bg-emerald-50/70 px-3 py-1.5 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100"
                    >
                      Виж на сайта →
                    </Link>
                  </div>
```

- [ ] **Step 3: Manually verify**

Run `npm run dev`, open `/organizer/dashboard` as an owner with a published festival, confirm the "Редактирай" button appears next to "Виж на сайта →" and navigates to the new edit page.

- [ ] **Step 4: Commit**

```bash
git add "app/organizer/(workspace)/dashboard/page.tsx"
git commit -m "feat(organizer): link published festivals to the new self-edit page"
```

---

## Task 14: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add a section under "Organizer portal"**

In `CLAUDE.md`, after the "Auto-claim by matching email" bullet in the **Organizer portal** section, add:

```markdown
- **Self-edit on published festivals:** active organizer-portal owners can directly `PATCH` their own already-published festival (`status` = `verified`/`published`), bypassing `pending_festivals`. Gated by `assertOrganizerCanEditPublishedFestival` (`lib/organizer/festivalSelfEdit.ts`). Editable field set: `ORGANIZER_FESTIVAL_PATCH_ALLOWED_KEYS` (`lib/admin/patchAllowedKeys.ts`) — excludes `slug`, `status`, `is_verified`, ownership, and promotion fields. Routes live under `app/api/organizer/festivals/[id]/` (core fields, `media`, `media/[mediaId]`, `media/video`, `hero-image`, `schedule`). Every write sets `festivals.last_edited_by_organizer_at` (admin list shows a badge) and logs to `admin_audit_logs` via `logAdminAction` with action names `festival.organizer_*`. Follower/update notifications are **not** triggered from this path. Edit UI: `/organizer/festivals/[id]/edit`.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document organizer self-edit on published festivals"
```

---

## Self-review notes

- **Spec coverage:** migration (Task 1), allowlist (Task 2), audit diff (Task 3, 5), auth gate (Task 4), all 6 routes from the spec's table (Tasks 5-10), admin indicator (Task 11), edit UI + dashboard wiring (Tasks 12-13), docs sync (Task 14, required by `CLAUDE.md`'s own "Documentation sync rule" for new API routes). All spec sections are covered.
- **Type consistency:** `assertOrganizerCanEditPublishedFestival` returns `{ ok: true; organizerId }` everywhere it's called across Tasks 5-10 and 12; `gate.organizerId` / `gate.error` / `gate.status` field names match the Task 4 definition exactly.
- **Scope:** UI intentionally omits lat/lng/place_id editing (no map picker) — called out explicitly in Task 12 rather than left ambiguous.
