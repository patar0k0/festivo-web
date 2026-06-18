# Festival Co-Organizers (owner + co_host) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Въвеждаме per-festival роли (`owner` + `co_host`) в `festival_organizers`, така че едно реално лице през organizer portal-а да управлява фестивала като собственик, а допълнително закачените организатори да са display-only.

**Architecture:** Колоната `festival_organizers.role` (вече съществуваща, nullable, неизползвана) се ограничава с CHECK constraint и partial unique index за един `owner` на фестивал. Owner-ството се присвоява при approve **само** за `submission_source = 'organizer_portal'` — historical/admin/ingest фестивали остават „orphan" (всички organizer редове са `co_host`). Permission gating е сървърен helper `getUserFestivalRole` в новите organizer-portal endpoint-и за view/edit/co-organizer management. Публичната страница не се променя.

**Tech Stack:** Next.js 14 App Router, Supabase Postgres + service-role client, TypeScript, Tailwind, съществуващите organizer portal helper-и (`lib/organizer/portal.ts`).

---

## Spec reference

Дизайнът: `docs/superpowers/specs/2026-06-01-festival-co-organizers-design.md`.

## Pre-flight context за разработчика

| Какво | Къде |
|---|---|
| Текуща дефиниция на `festival_organizers` | `scripts/sql/20260319_festival_organizers_m2m.sql` (има `role text null`, неизползвана) |
| Текуща дефиниция на `organizer_members` | `scripts/sql/20260328_organizer_members_portal.sql` |
| Sync helper за организатори на фестивал | `lib/festivalOrganizers.ts` (destructive delete+insert — **трябва да се запази role при sync**) |
| Approve route на pending festival | `app/admin/api/pending-festivals/[id]/approve/route.ts` (линия 579 е syncFestivalOrganizers call) |
| Admin festival PATCH | `app/admin/api/festivals/[id]/route.ts` (линия 457 е syncFestivalOrganizers call) |
| Portal session helpers | `lib/organizer/portal.ts` (`requireOrganizerOwnerPortalSession`, `getPortalAdminClient`, `fetchActiveMembershipOrganizerIds`) |
| Organizer portal layout | `app/organizer/(workspace)/` route group |
| Текущ dashboard | `app/organizer/(workspace)/dashboard/page.tsx` |
| Submission edit (за reference на UI patterns) | `app/organizer/(workspace)/submissions/[id]/edit/page.tsx` |
| Org edit (за reference на форми) | `app/organizer/(workspace)/organizations/[id]/edit/page.tsx` |
| Database type | `lib/types/database.ts` |

В кодa **няма** unit test framework в активна употреба. Plan-ът използва **SQL верификация + manual smoke test през portal-а** вместо автоматизирани тестове, така че верификацията остава реалистична. Ако в бъдеще се добави Vitest/Jest, тестовете се преписват към него.

## File structure (нови / модифицирани)

**Нови:**
- `scripts/sql/20260601_festival_organizers_role_constraint.sql`
- `lib/organizer/festivalAccess.ts`
- `app/organizer/(workspace)/festivals/[id]/page.tsx` (read-only view за co_host и orphan)
- `app/organizer/(workspace)/festivals/[id]/edit/page.tsx` (owner-only edit)
- `app/api/organizer/festivals/[id]/route.ts` (GET + PATCH)
- `app/api/organizer/festivals/[id]/co-organizers/route.ts` (POST add, DELETE remove)
- `components/organizer/FestivalRoleBadge.tsx`
- `components/organizer/CoOrganizersSection.tsx`

**Модифицирани:**
- `lib/festivalOrganizers.ts` (запазване на role при sync)
- `app/admin/api/pending-festivals/[id]/approve/route.ts` (owner assignment за portal submissions)
- `app/admin/api/festivals/[id]/route.ts` (preserve roles при PATCH)
- `app/organizer/(workspace)/dashboard/page.tsx` (нова секция „Моите фестивали" с badges)
- `lib/types/database.ts` (типа за `festival_organizers.role`)
- `CLAUDE.md` (кратко споменаване)
- `docs/system-architecture.md` (секция Organizer portal — добавяне за per-festival роли)

---

## Task 1: SQL migration — role constraint + owner unique index

**Files:**
- Create: `scripts/sql/20260601_festival_organizers_role_constraint.sql`

- [ ] **Step 1: Pre-check existing data (manual, преди миграцията)**

В Supabase SQL editor пусни:

```sql
select role, count(*) from public.festival_organizers group by role;
```

Очаквано: всички редове са с `role IS NULL` (колоната е неизползвана). Ако случайно има non-null стойности, които не са `'owner'` или `'co_host'` → STOP и докладвай преди да продължиш. План B (ако има неочаквани стойности): добави UPDATE в migration-а да ги нормализира към NULL или съответната роля **след преглед от собственика на репото**.

- [ ] **Step 2: Write migration file**

```sql
-- scripts/sql/20260601_festival_organizers_role_constraint.sql
-- Per-festival роли (owner + co_host) за multi-organizer фестивали.
-- Колоната role вече съществува от 20260319 (nullable text, неизползвана).
-- Тук я ограничаваме до { owner, co_host } с default 'co_host' и
-- forcing-ваме точно един owner на фестивал.

-- 1) Нормализирай NULL към 'co_host' (исторически редове).
update public.festival_organizers
set role = 'co_host'
where role is null;

-- 2) Direct constraint + default.
alter table public.festival_organizers
  alter column role set default 'co_host',
  alter column role set not null;

alter table public.festival_organizers
  drop constraint if exists festival_organizers_role_check;

alter table public.festival_organizers
  add constraint festival_organizers_role_check
  check (role in ('owner', 'co_host'));

-- 3) Точно един owner на фестивал.
create unique index if not exists festival_organizers_one_owner_idx
  on public.festival_organizers (festival_id)
  where role = 'owner';

comment on column public.festival_organizers.role is
  'Per-festival роля: owner (пълни edit права, най-много един) или co_host (display-only). Default co_host.';
```

- [ ] **Step 3: Verify locally**

В Supabase SQL editor пусни цялата migration. След това провери:

```sql
-- Constraint трябва да съществува:
select conname from pg_constraint
where conname = 'festival_organizers_role_check';

-- Index трябва да съществува:
select indexname from pg_indexes
where indexname = 'festival_organizers_one_owner_idx';

-- Нямa NULL стойности:
select count(*) from public.festival_organizers where role is null;
-- → очаквано 0

-- Опитай дублиран owner — трябва да гръмне:
-- (избери реален festival_id с поне един съществуващ ред)
-- update public.festival_organizers set role = 'owner' where festival_id = '<id>' limit 2;
-- → second row insert трябва да fail-не с unique violation.
```

- [ ] **Step 4: Commit**

```bash
git add scripts/sql/20260601_festival_organizers_role_constraint.sql
git commit -m "chore(db): add role check + one-owner index on festival_organizers"
```

---

## Task 2: Update `festival_organizers` type in database typings

**Files:**
- Modify: `lib/types/database.ts`

- [ ] **Step 1: Locate the festival_organizers Row type**

Search в `lib/types/database.ts` за `festival_organizers`. В шаблона на Supabase types ще има три варианта: `Row`, `Insert`, `Update`.

- [ ] **Step 2: Add `role` field**

Във всеки от трите варианта добави:

```ts
role: "owner" | "co_host"; // Row: винаги present
role?: "owner" | "co_host"; // Insert: optional (DB default)
role?: "owner" | "co_host"; // Update: optional
```

Ако файлът е auto-generated с коментар „Do not edit" — провери дали проектът има `npm run gen-types` или подобен. Ако да, изпълни го. Ако не — edit-вай ръчно (типичен случай в този репо според коментарите в файла).

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Очаквано: PASS (или непроменени съществуващи грешки, без нови).

- [ ] **Step 4: Commit**

```bash
git add lib/types/database.ts
git commit -m "chore(types): add role field on festival_organizers"
```

---

## Task 3: Preserve roles in `syncFestivalOrganizers`

**Why:** Текущата имплементация прави `delete from festival_organizers where festival_id = $1` + insert на всички organizer ids с `sort_order` само. Без промяна това ще **изтрие role-ите при всеки save** в admin festival PATCH и при approve. Нужно е да четем съществуващите role-и преди delete и да ги пренасяме.

**Files:**
- Modify: `lib/festivalOrganizers.ts`

- [ ] **Step 1: Rewrite `syncFestivalOrganizers` да запазва role**

```ts
// lib/festivalOrganizers.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type FestivalOrganizerRole = "owner" | "co_host";

export type FestivalOrganizerLink = {
  festival_id: string;
  organizer_id: string;
  sort_order: number;
  role: FestivalOrganizerRole;
};

export function normalizeOrganizerIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];

  const deduped = new Set<string>();
  for (const value of input) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    deduped.add(trimmed);
  }

  return Array.from(deduped);
}

type SyncOptions = {
  /**
   * Когато е подаден, тази стойност определя кой organizer_id ще получи role='owner'
   * на финалния set. Останалите получават co_host. Ако ownerOrganizerId не е в
   * organizerIds, фестивалът остава orphan (всички co_host).
   */
  ownerOrganizerId?: string | null;
};

/**
 * Препише festival_organizers за даден festival до точно подадения списък,
 * запазвайки съществуващите role-и където е възможно. Поведение:
 *  - Запазват се role-ите на organizer_id-ите, които остават след sync.
 *  - Новите organizer_id-и влизат с role='co_host'.
 *  - Ако `options.ownerOrganizerId` е подаден и присъства в списъка, той става owner;
 *    останалите owner-и (ако случайно има) се свеждат до co_host (един owner на festival).
 *  - Ако `options.ownerOrganizerId` не е подаден → текущият owner (ако още е в списъка)
 *    остава owner. Иначе festival-ът остава без owner (orphan).
 */
export async function syncFestivalOrganizers(
  client: SupabaseClient,
  festivalId: string,
  organizerIds: string[],
  options: SyncOptions = {},
): Promise<void> {
  const normalized = Array.from(
    new Set(organizerIds.map((value) => value.trim()).filter(Boolean)),
  );

  // 1) Прочети текущите редове (за да знаем кой е owner и какво да запазим).
  const { data: existingRows, error: readError } = await client
    .from("festival_organizers")
    .select("organizer_id, role")
    .eq("festival_id", festivalId);

  if (readError) {
    throw new Error(`Failed to read existing festival organizers: ${readError.message}`);
  }

  const existingRoleByOrganizerId = new Map<string, FestivalOrganizerRole>();
  for (const row of existingRows ?? []) {
    if (row.organizer_id && (row.role === "owner" || row.role === "co_host")) {
      existingRoleByOrganizerId.set(row.organizer_id, row.role);
    }
  }

  // 2) Изтрий всички редове за festival-а.
  const { error: deleteError } = await client
    .from("festival_organizers")
    .delete()
    .eq("festival_id", festivalId);
  if (deleteError) {
    throw new Error(`Failed to clear festival organizers: ${deleteError.message}`);
  }

  if (!normalized.length) return;

  // 3) Определи owner-а за финалния set.
  const explicitOwner =
    options.ownerOrganizerId && normalized.includes(options.ownerOrganizerId)
      ? options.ownerOrganizerId
      : null;
  const preservedOwner =
    !explicitOwner
      ? normalized.find((id) => existingRoleByOrganizerId.get(id) === "owner") ?? null
      : null;
  const finalOwnerId = explicitOwner ?? preservedOwner;

  // 4) Конструирай редовете.
  const rows: FestivalOrganizerLink[] = normalized.map((organizerId, index) => {
    const role: FestivalOrganizerRole =
      organizerId === finalOwnerId ? "owner" : "co_host";
    return {
      festival_id: festivalId,
      organizer_id: organizerId,
      sort_order: index,
      role,
    };
  });

  const { error: insertError } = await client.from("festival_organizers").insert(rows);
  if (insertError) {
    throw new Error(`Failed to insert festival organizers: ${insertError.message}`);
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Очаквано: PASS (възможни нови грешки на callsite-овете заради липсващ `options` arg — но той е optional, така че не би трябвало). Ако `lib/types/database.ts` още не знае за `role` (Task 2 не е merge-нат), временно cast-вай row-овете до `any` в `existingRoleByOrganizerId` за-да минеш ts-check. Иначе остави без cast.

- [ ] **Step 3: Manual smoke (SQL)**

След локален deploy, ръчно тествай чрез admin UI: отвори admin festival edit на festival, който има 2+ organizers, направи save без промяна — провери в SQL editor че role стойностите се запазват:

```sql
select organizer_id, role, sort_order
from public.festival_organizers
where festival_id = '<test-festival-id>'
order by sort_order;
```

Очаквано: същите role стойности като преди save.

- [ ] **Step 4: Commit**

```bash
git add lib/festivalOrganizers.ts
git commit -m "fix(festival-organizers): preserve role on sync"
```

---

## Task 4: Owner assignment при approve на organizer_portal pending

**Files:**
- Modify: `app/admin/api/pending-festivals/[id]/approve/route.ts`

- [ ] **Step 1: Подай owner-а към syncFestivalOrganizers**

Намери извикването на `syncFestivalOrganizers` (около линия 579):

```ts
await syncFestivalOrganizers(adminCtx.supabase, insertedFestival.id, publishedOrganizerIds);
```

Замени с:

```ts
const ownerOrganizerIdForApprove =
  pending.submission_source === "organizer_portal" && pending.organizer_id
    ? pending.organizer_id
    : null;

await syncFestivalOrganizers(
  adminCtx.supabase,
  insertedFestival.id,
  publishedOrganizerIds,
  { ownerOrganizerId: ownerOrganizerIdForApprove },
);
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Очаквано: PASS.

- [ ] **Step 3: Manual smoke**

Локално: създай organizer-portal pending submission, approve-ни го като admin. Провери в SQL:

```sql
select fo.organizer_id, fo.role, o.name
from public.festival_organizers fo
join public.organizers o on o.id = fo.organizer_id
where fo.festival_id = '<approved-festival-id>'
order by fo.role desc, fo.sort_order;
```

Очаквано: organizer-ът, който е submit-нал pending-а, е с `role = 'owner'`; евентуални доп. organizer entries са `co_host`.

За admin/research/ingest pending (non-portal): approve-ни такъв и провери че **никой** не е owner — всички са co_host.

- [ ] **Step 4: Commit**

```bash
git add app/admin/api/pending-festivals/[id]/approve/route.ts
git commit -m "feat(approve): assign owner role for organizer_portal submissions"
```

---

## Task 5: Festival access helper `getUserFestivalRole`

**Files:**
- Create: `lib/organizer/festivalAccess.ts`

- [ ] **Step 1: Write helper**

```ts
// lib/organizer/festivalAccess.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type FestivalAccessRole = "owner" | "co_host" | null;

/**
 * Връща ролята на user-а върху даден фестивал, изчислена през organizer_members
 * (active членства, без значение от portal ролята) и festival_organizers.
 *
 * Връща 'owner' ако user-ът е свързан с organizer, който е owner на festival-а;
 * 'co_host' ако само е свързан с co_host organizer на festival-а;
 * null ако няма връзка.
 *
 * Admin bypass се прави в route handler-ите (isAdmin check), не тук.
 *
 * Изисква supabase client с достъп до organizer_members и festival_organizers
 * (typically service-role / portal admin client).
 */
export async function getUserFestivalRole(
  admin: SupabaseClient,
  userId: string,
  festivalId: string,
): Promise<FestivalAccessRole> {
  if (!userId || !festivalId) return null;

  const { data: memberships, error: mErr } = await admin
    .from("organizer_members")
    .select("organizer_id")
    .eq("user_id", userId)
    .eq("status", "active");

  if (mErr) {
    throw new Error(`organizer_members lookup failed: ${mErr.message}`);
  }

  const organizerIds = Array.from(
    new Set((memberships ?? []).map((m) => m.organizer_id).filter(Boolean)),
  );
  if (organizerIds.length === 0) return null;

  const { data: foRows, error: foErr } = await admin
    .from("festival_organizers")
    .select("organizer_id, role")
    .eq("festival_id", festivalId)
    .in("organizer_id", organizerIds);

  if (foErr) {
    throw new Error(`festival_organizers lookup failed: ${foErr.message}`);
  }

  if (!foRows || foRows.length === 0) return null;

  if (foRows.some((r) => r.role === "owner")) return "owner";
  return "co_host";
}

/** Подобрена форма: hard 403 ако ролята не е owner. */
export async function assertOwnerOrThrow(
  admin: SupabaseClient,
  userId: string,
  festivalId: string,
): Promise<void> {
  const role = await getUserFestivalRole(admin, userId, festivalId);
  if (role !== "owner") {
    throw new ForbiddenFestivalAccessError("Only the festival owner may perform this action.");
  }
}

export class ForbiddenFestivalAccessError extends Error {
  readonly status = 403 as const;
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenFestivalAccessError";
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Очаквано: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/organizer/festivalAccess.ts
git commit -m "feat(organizer): add getUserFestivalRole helper"
```

---

## Task 6: GET /api/organizer/festivals/[id] (view)

**Files:**
- Create: `app/api/organizer/festivals/[id]/route.ts`

- [ ] **Step 1: Write GET handler**

```ts
// app/api/organizer/festivals/[id]/route.ts
import { NextResponse } from "next/server";
import {
  getPortalAdminClient,
  getPortalSessionUser,
} from "@/lib/organizer/portal";
import {
  ForbiddenFestivalAccessError,
  getUserFestivalRole,
} from "@/lib/organizer/festivalAccess";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: festivalId } = await params;
  const session = await getPortalSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = getPortalAdminClient();
  const role = await getUserFestivalRole(admin, session.user.id, festivalId);
  if (role === null) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { data: festival, error } = await admin
    .from("festivals")
    .select(
      "id,slug,title,description,description_short,category,city,start_date,end_date,occurrence_dates,location_name,address,latitude,longitude,hero_image,website_url,ticket_url,price_range,is_free,status,is_verified",
    )
    .eq("id", festivalId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, error: `festival load failed: ${error.message}` },
      { status: 500 },
    );
  }
  if (!festival) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  // Co-organizers (за списъка в UI):
  const { data: organizers, error: orgErr } = await admin
    .from("festival_organizers")
    .select("organizer_id, role, sort_order, organizers!inner(id,name,slug,logo_url)")
    .eq("festival_id", festivalId)
    .order("role", { ascending: false }) // 'owner' преди 'co_host'
    .order("sort_order", { ascending: true });

  if (orgErr) {
    return NextResponse.json(
      { ok: false, error: `organizers load failed: ${orgErr.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    role,
    festival,
    organizers: organizers ?? [],
  });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Очаквано: PASS.

- [ ] **Step 3: Manual smoke**

С organizer-portal user, който е active member на owner organizer на festival X:

```
GET /api/organizer/festivals/<X-id>
```

Очаквано: 200, `role: "owner"`, организаторите включват owner + co_hosts.

С organizer-portal user, който е active member на co_host organizer на festival X:

Очаквано: 200, `role: "co_host"`, организаторите видими.

С user без връзка с organizers на festival X:

Очаквано: 403.

Без session:

Очаквано: 401.

- [ ] **Step 4: Commit**

```bash
git add app/api/organizer/festivals/[id]/route.ts
git commit -m "feat(organizer-api): add GET festival route with role gating"
```

---

## Task 7: PATCH /api/organizer/festivals/[id] (owner-only edit)

**Files:**
- Modify: `app/api/organizer/festivals/[id]/route.ts`

- [ ] **Step 1: Добави PATCH handler в същия файл**

```ts
// ...existing GET above...

const EDITABLE_FIELDS = [
  "description",
  "description_short",
  "website_url",
  "ticket_url",
  "price_range",
  "is_free",
] as const satisfies readonly string[];

type EditableField = (typeof EDITABLE_FIELDS)[number];

function pickEditable(input: unknown): Partial<Record<EditableField, unknown>> {
  if (!input || typeof input !== "object") return {};
  const patch: Partial<Record<EditableField, unknown>> = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in (input as Record<string, unknown>)) {
      patch[key] = (input as Record<string, unknown>)[key];
    }
  }
  return patch;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: festivalId } = await params;
  const session = await getPortalSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = getPortalAdminClient();
  try {
    const role = await getUserFestivalRole(admin, session.user.id, festivalId);
    if (role !== "owner") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "role lookup failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const patch = pickEditable(body);
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "No editable fields in payload" }, { status: 400 });
  }

  const { error: updateError } = await admin
    .from("festivals")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", festivalId);

  if (updateError) {
    return NextResponse.json(
      { ok: false, error: `update failed: ${updateError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
```

> **Scope бележка:** PATCH тук намира **малък безопасен subset** на полета (описание, линкове, цена). Edit на schedule / media / hero е извън scope-а за MVP — те остават admin-only през съществуващите admin endpoints. Това е expressly съгласувано в spec-а (раздел „Out of scope"). Бъдеща итерация може да разшири `EDITABLE_FIELDS`.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Очаквано: PASS.

- [ ] **Step 3: Manual smoke**

С owner user:
```
PATCH /api/organizer/festivals/<X-id>  body: {"website_url":"https://example.com"}
```
Очаквано: 200, в SQL `festivals.website_url` е обновено.

С co_host user → 403. Без session → 401. Без editable полета → 400.

- [ ] **Step 4: Commit**

```bash
git add app/api/organizer/festivals/[id]/route.ts
git commit -m "feat(organizer-api): add PATCH festival route (owner-only)"
```

---

## Task 8: Co-organizers API (add/remove)

**Files:**
- Create: `app/api/organizer/festivals/[id]/co-organizers/route.ts`

- [ ] **Step 1: Write POST (add co_host) + DELETE (remove co_host) handlers**

```ts
// app/api/organizer/festivals/[id]/co-organizers/route.ts
import { NextResponse } from "next/server";
import { getPortalAdminClient, getPortalSessionUser } from "@/lib/organizer/portal";
import { getUserFestivalRole } from "@/lib/organizer/festivalAccess";

export const dynamic = "force-dynamic";

async function requireOwner(festivalId: string) {
  const session = await getPortalSessionUser();
  if (!session) {
    return { error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  }
  const admin = getPortalAdminClient();
  const role = await getUserFestivalRole(admin, session.user.id, festivalId);
  if (role !== "owner") {
    return { error: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }) };
  }
  return { admin, session };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: festivalId } = await params;
  const guarded = await requireOwner(festivalId);
  if ("error" in guarded) return guarded.error;
  const { admin } = guarded;

  const body = (await request.json().catch(() => null)) as { organizer_id?: unknown } | null;
  const targetId = typeof body?.organizer_id === "string" ? body.organizer_id.trim() : "";
  if (!targetId) {
    return NextResponse.json({ ok: false, error: "organizer_id required" }, { status: 400 });
  }

  // Бърза проверка че target organizer-ът съществува и е active.
  const { data: organizer, error: orgErr } = await admin
    .from("organizers")
    .select("id")
    .eq("id", targetId)
    .eq("is_active", true)
    .maybeSingle();
  if (orgErr) {
    return NextResponse.json({ ok: false, error: orgErr.message }, { status: 500 });
  }
  if (!organizer) {
    return NextResponse.json({ ok: false, error: "Organizer not found" }, { status: 404 });
  }

  // Idempotent insert: ако вече е свързан (owner или co_host), не дублираме.
  const { data: existing, error: existingErr } = await admin
    .from("festival_organizers")
    .select("role")
    .eq("festival_id", festivalId)
    .eq("organizer_id", targetId)
    .maybeSingle();
  if (existingErr) {
    return NextResponse.json({ ok: false, error: existingErr.message }, { status: 500 });
  }
  if (existing) {
    return NextResponse.json({ ok: true, already_linked: true, role: existing.role });
  }

  // Намери max(sort_order) за да добавим в края.
  const { data: maxRow } = await admin
    .from("festival_organizers")
    .select("sort_order")
    .eq("festival_id", festivalId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (maxRow?.sort_order ?? -1) + 1;

  const { error: insertErr } = await admin.from("festival_organizers").insert({
    festival_id: festivalId,
    organizer_id: targetId,
    role: "co_host",
    sort_order: nextOrder,
  });
  if (insertErr) {
    return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, role: "co_host" });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: festivalId } = await params;
  const guarded = await requireOwner(festivalId);
  if ("error" in guarded) return guarded.error;
  const { admin } = guarded;

  const url = new URL(request.url);
  const targetId = (url.searchParams.get("organizer_id") ?? "").trim();
  if (!targetId) {
    return NextResponse.json({ ok: false, error: "organizer_id required" }, { status: 400 });
  }

  // Не позволявай изтриване на owner-а през този endpoint.
  const { data: existing, error: existingErr } = await admin
    .from("festival_organizers")
    .select("role")
    .eq("festival_id", festivalId)
    .eq("organizer_id", targetId)
    .maybeSingle();
  if (existingErr) {
    return NextResponse.json({ ok: false, error: existingErr.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ ok: true, removed: false });
  }
  if (existing.role === "owner") {
    return NextResponse.json(
      { ok: false, error: "Owner cannot be removed. Transfer ownership first (coming soon)." },
      { status: 400 },
    );
  }

  const { error: deleteErr } = await admin
    .from("festival_organizers")
    .delete()
    .eq("festival_id", festivalId)
    .eq("organizer_id", targetId);
  if (deleteErr) {
    return NextResponse.json({ ok: false, error: deleteErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, removed: true });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Очаквано: PASS.

- [ ] **Step 3: Manual smoke**

С owner user:
- POST с непознат organizer_id → 404.
- POST с валиден organizer_id → 200, в SQL ред с role=co_host добавен.
- POST повторно със същия → 200, `already_linked: true`.
- DELETE на co_host → 200, `removed: true`.
- DELETE на owner-а → 400.

С co_host user → 403 на двата endpoint-а.

- [ ] **Step 4: Commit**

```bash
git add app/api/organizer/festivals/[id]/co-organizers/route.ts
git commit -m "feat(organizer-api): add co-organizers add/remove endpoints"
```

---

## Task 9: Role badge component

**Files:**
- Create: `components/organizer/FestivalRoleBadge.tsx`

- [ ] **Step 1: Write component**

```tsx
// components/organizer/FestivalRoleBadge.tsx
import type { FestivalAccessRole } from "@/lib/organizer/festivalAccess";

type Props = {
  role: FestivalAccessRole;
};

export function FestivalRoleBadge({ role }: Props) {
  if (role === "owner") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50/90 px-2.5 py-0.5 text-xs font-medium text-emerald-900">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Собственик
      </span>
    );
  }
  if (role === "co_host") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200/70 bg-sky-50/90 px-2.5 py-0.5 text-xs font-medium text-sky-900">
        <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
        Съ-организатор
      </span>
    );
  }
  return null;
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/organizer/FestivalRoleBadge.tsx
git commit -m "feat(organizer-ui): add FestivalRoleBadge component"
```

---

## Task 10: Dashboard — секция „Моите фестивали"

**Files:**
- Modify: `app/organizer/(workspace)/dashboard/page.tsx`

- [ ] **Step 1: Добави query за published festivals на тези organizers**

В `OrganizerDashboardPage` (след съществуващите `orgsRes`/`submissionsRes` queries):

```ts
const festivalsRes = orgIds.length > 0
  ? await admin
      .from("festival_organizers")
      .select("role, sort_order, organizer_id, festivals!inner(id,slug,title,start_date,end_date,hero_image,status,is_verified)")
      .in("organizer_id", orgIds)
      .order("role", { ascending: false }) // owner first
  : { data: [] as Array<{
      role: "owner" | "co_host";
      organizer_id: string;
      festivals: {
        id: string;
        slug: string;
        title: string;
        start_date: string | null;
        end_date: string | null;
        hero_image: string | null;
        status: string;
        is_verified: boolean;
      };
    }> };
```

- [ ] **Step 2: Дедуплицирай и dedupe-ни по festival_id**

Един user може да е свързан с няколко organizers, които и двамата са на същия festival → искаме един ред в UI с „най-силната" роля.

```ts
const festivalMap = new Map<
  string,
  { role: "owner" | "co_host"; festival: typeof festivalsRes.data[number]["festivals"] }
>();

for (const row of festivalsRes.data ?? []) {
  const f = row.festivals;
  if (!f?.id) continue;
  const existing = festivalMap.get(f.id);
  // 'owner' печели срещу 'co_host'
  if (!existing || (existing.role === "co_host" && row.role === "owner")) {
    festivalMap.set(f.id, { role: row.role, festival: f });
  }
}

const myFestivals = Array.from(festivalMap.values());
```

- [ ] **Step 3: Рендерирай секцията**

В JSX, в секция близо до съществуващите „Моите профили" / „Заявки", добави нова секция:

```tsx
import { FestivalRoleBadge } from "@/components/organizer/FestivalRoleBadge";

// ...в return:
{myFestivals.length > 0 && (
  <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
    <header className="mb-4 flex items-center justify-between">
      <h2 className="text-base font-semibold text-black">Моите фестивали</h2>
      <span className="text-xs text-black/55">{myFestivals.length} общо</span>
    </header>
    <ul className="divide-y divide-black/5">
      {myFestivals.map(({ role, festival }) => (
        <li key={festival.id} className="flex items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-3">
            {festival.hero_image && (
              <img
                src={festival.hero_image}
                alt=""
                className="h-12 w-12 rounded-lg object-cover"
              />
            )}
            <div>
              <Link
                href={`/organizer/festivals/${festival.id}`}
                className="text-sm font-medium text-black hover:underline"
              >
                {festival.title}
              </Link>
              {festival.start_date && (
                <p className="text-xs text-black/55">
                  {format(new Date(festival.start_date), "d MMM yyyy", { locale: bg })}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FestivalRoleBadge role={role} />
            {role === "owner" && (
              <Link
                href={`/organizer/festivals/${festival.id}/edit`}
                className="rounded-md border border-black/10 px-3 py-1 text-xs hover:bg-black/5"
              >
                Редактирай
              </Link>
            )}
          </div>
        </li>
      ))}
    </ul>
  </section>
)}
```

- [ ] **Step 4: Type-check + manual smoke**

```bash
npx tsc --noEmit
npm run dev
```

Отвори `/organizer/dashboard` като организатор, който е owner на поне един festival и co_host на друг. Очаквано: и двата се появяват с правилните badges; редакция бутон само на owner.

- [ ] **Step 5: Commit**

```bash
git add app/organizer/(workspace)/dashboard/page.tsx
git commit -m "feat(organizer-dashboard): add 'My festivals' section with role badges"
```

---

## Task 11: Festival view page (read-only)

**Files:**
- Create: `app/organizer/(workspace)/festivals/[id]/page.tsx`

- [ ] **Step 1: Write read-only page**

```tsx
// app/organizer/(workspace)/festivals/[id]/page.tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireOrganizerOwnerPortalSession } from "@/lib/organizer/portal";
import { getUserFestivalRole } from "@/lib/organizer/festivalAccess";
import { FestivalRoleBadge } from "@/components/organizer/FestivalRoleBadge";

export const dynamic = "force-dynamic";

export default async function OrganizerFestivalViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: festivalId } = await params;
  const gate = await requireOrganizerOwnerPortalSession(`/organizer/festivals/${festivalId}`);
  if (gate.kind === "redirect") redirect(gate.to);
  if (gate.kind === "unavailable") {
    return (
      <div className="rounded-2xl border border-amber-200/55 bg-amber-50/70 px-5 py-6 text-sm text-amber-950/85 shadow-sm">
        Услугата е временно недостъпна. Опитайте по-късно.
      </div>
    );
  }

  const { admin, user } = gate;
  const role = await getUserFestivalRole(admin, user.id, festivalId);
  if (role === null) notFound();

  const { data: festival } = await admin
    .from("festivals")
    .select(
      "id,slug,title,description,description_short,start_date,end_date,city,location_name,hero_image,website_url,ticket_url",
    )
    .eq("id", festivalId)
    .maybeSingle();

  if (!festival) notFound();

  const { data: organizers } = await admin
    .from("festival_organizers")
    .select("role, organizers!inner(id,name,slug,logo_url)")
    .eq("festival_id", festivalId)
    .order("role", { ascending: false });

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-black">{festival.title}</h1>
          <div className="mt-2"><FestivalRoleBadge role={role} /></div>
        </div>
        {role === "owner" && (
          <Link
            href={`/organizer/festivals/${festival.id}/edit`}
            className="rounded-md border border-black/10 bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/85"
          >
            Редактирай
          </Link>
        )}
      </header>

      {role === "co_host" && (
        <div className="rounded-xl border border-sky-200/60 bg-sky-50/80 px-4 py-3 text-sm text-sky-950/85">
          Участвате като съ-организатор. За промени се свържете със собственика на фестивала.
        </div>
      )}

      <section className="rounded-2xl border border-black/10 bg-white p-5">
        <h2 className="text-sm font-medium text-black/75">Описание</h2>
        <p className="mt-2 whitespace-pre-line text-sm text-black/80">{festival.description ?? "—"}</p>
      </section>

      <section className="rounded-2xl border border-black/10 bg-white p-5">
        <h2 className="text-sm font-medium text-black/75">Организатори</h2>
        <ul className="mt-3 space-y-2">
          {(organizers ?? []).map((row) => (
            <li key={row.organizers.id} className="flex items-center gap-3">
              {row.organizers.logo_url && (
                <img src={row.organizers.logo_url} alt="" className="h-8 w-8 rounded" />
              )}
              <span className="text-sm">{row.organizers.name}</span>
              <FestivalRoleBadge role={row.role as "owner" | "co_host"} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + manual smoke**

```bash
npx tsc --noEmit
```

Manual: отвори `/organizer/festivals/<id>` като co_host. Очаквано: read-only страница, sky banner, няма „Редактирай" бутон. Като owner: бутонът се появява, без banner. Като outsider: 404.

- [ ] **Step 3: Commit**

```bash
git add app/organizer/(workspace)/festivals/[id]/page.tsx
git commit -m "feat(organizer-portal): add festival read-only view"
```

---

## Task 12: Festival edit page (owner-only)

**Files:**
- Create: `app/organizer/(workspace)/festivals/[id]/edit/page.tsx`
- Create: `components/organizer/CoOrganizersSection.tsx`

- [ ] **Step 1: Co-organizers section component (client)**

```tsx
// components/organizer/CoOrganizersSection.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type OrganizerRow = {
  organizer_id: string;
  role: "owner" | "co_host";
  organizers: { id: string; name: string; logo_url: string | null; slug: string };
};

type Props = {
  festivalId: string;
  initial: OrganizerRow[];
};

export function CoOrganizersSection({ festivalId, initial }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ id: string; name: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(q: string) {
    setQuery(q);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const res = await fetch(`/api/organizer/search?q=${encodeURIComponent(q)}`);
    const json = await res.json();
    if (res.ok && Array.isArray(json.results)) {
      // Изключи вече закачените:
      const linked = new Set(rows.map((r) => r.organizer_id));
      setResults(json.results.filter((r: { id: string }) => !linked.has(r.id)));
    }
  }

  async function addCoHost(organizerId: string, displayName: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/organizer/festivals/${festivalId}/co-organizers`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ organizer_id: organizerId }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok || !json.ok) {
      setError(json.error ?? "Грешка при добавяне");
      return;
    }
    setRows((prev) => [
      ...prev,
      {
        organizer_id: organizerId,
        role: "co_host",
        organizers: { id: organizerId, name: displayName, logo_url: null, slug: "" },
      },
    ]);
    setQuery("");
    setResults([]);
    router.refresh();
  }

  async function removeCoHost(organizerId: string) {
    if (!confirm("Сигурни ли сте, че искате да премахнете този съ-организатор?")) return;
    setBusy(true);
    setError(null);
    const res = await fetch(
      `/api/organizer/festivals/${festivalId}/co-organizers?organizer_id=${encodeURIComponent(organizerId)}`,
      { method: "DELETE" },
    );
    const json = await res.json();
    setBusy(false);
    if (!res.ok || !json.ok) {
      setError(json.error ?? "Грешка при премахване");
      return;
    }
    setRows((prev) => prev.filter((r) => r.organizer_id !== organizerId));
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-black/75">Съ-организатори</h2>
      </header>

      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={row.organizer_id}
            className="flex items-center justify-between gap-3 rounded-lg border border-black/5 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              {row.organizers.logo_url && (
                <img src={row.organizers.logo_url} alt="" className="h-7 w-7 rounded" />
              )}
              <span className="text-sm">{row.organizers.name}</span>
              {row.role === "owner" && (
                <span className="text-xs text-emerald-700">(Собственик)</span>
              )}
            </div>
            {row.role === "co_host" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => removeCoHost(row.organizer_id)}
                className="text-xs text-red-700 hover:underline disabled:opacity-50"
              >
                Премахни
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-5 border-t border-black/5 pt-4">
        <label className="block text-xs text-black/55">Добави съ-организатор</label>
        <input
          type="search"
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="Търси организатор по име..."
          className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm"
        />
        {results.length > 0 && (
          <ul className="mt-2 max-h-48 overflow-auto rounded-md border border-black/10 bg-white shadow-sm">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => addCoHost(r.id, r.name)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-black/5 disabled:opacity-50"
                >
                  {r.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
        <p className="mt-3 text-[11px] text-black/45">
          Прехвърли собствеността — скоро.
        </p>
      </div>
    </section>
  );
}
```

> **Note:** Компонентът ползва `/api/organizer/search?q=...`. Този endpoint вече съществува (`app/api/organizer/search/route.ts`). Преди да реализираш UI-а, отвори файла и потвърди shape-а на response-а (`{ results: [{ id, name }] }`). Ако формата е различна — адаптирай parsing-а в `search()`. Не сменяй endpoint-а.

- [ ] **Step 2: Edit page (server) — owner-only, form + section**

```tsx
// app/organizer/(workspace)/festivals/[id]/edit/page.tsx
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireOrganizerOwnerPortalSession } from "@/lib/organizer/portal";
import { getUserFestivalRole } from "@/lib/organizer/festivalAccess";
import { CoOrganizersSection } from "@/components/organizer/CoOrganizersSection";
import { FestivalRoleBadge } from "@/components/organizer/FestivalRoleBadge";
import { FestivalEditForm } from "@/components/organizer/FestivalEditForm";

export const dynamic = "force-dynamic";

export default async function OrganizerFestivalEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: festivalId } = await params;
  const gate = await requireOrganizerOwnerPortalSession(
    `/organizer/festivals/${festivalId}/edit`,
  );
  if (gate.kind === "redirect") redirect(gate.to);
  if (gate.kind === "unavailable") {
    return (
      <div className="rounded-2xl border border-amber-200/55 bg-amber-50/70 px-5 py-6 text-sm">
        Услугата е временно недостъпна.
      </div>
    );
  }

  const { admin, user } = gate;
  const role = await getUserFestivalRole(admin, user.id, festivalId);
  if (role !== "owner") {
    // co_host или outsider → препрати към view (или 404).
    if (role === "co_host") redirect(`/organizer/festivals/${festivalId}`);
    notFound();
  }

  const { data: festival } = await admin
    .from("festivals")
    .select("id,title,description,description_short,website_url,ticket_url,price_range,is_free")
    .eq("id", festivalId)
    .maybeSingle();

  if (!festival) notFound();

  const { data: organizers } = await admin
    .from("festival_organizers")
    .select("organizer_id, role, organizers!inner(id,name,slug,logo_url)")
    .eq("festival_id", festivalId)
    .order("role", { ascending: false });

  const safeOrganizers = (organizers ?? []).map((row) => ({
    organizer_id: row.organizer_id,
    role: row.role as "owner" | "co_host",
    organizers: row.organizers,
  }));

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <Link href={`/organizer/festivals/${festival.id}`} className="text-xs text-black/55 hover:underline">
            ← Назад към фестивала
          </Link>
          <h1 className="mt-1 text-xl font-semibold">Редактирай: {festival.title}</h1>
          <div className="mt-2"><FestivalRoleBadge role="owner" /></div>
        </div>
      </header>

      <FestivalEditForm festival={festival} />

      <CoOrganizersSection festivalId={festival.id} initial={safeOrganizers} />
    </div>
  );
}
```

- [ ] **Step 3: Edit form client component**

Create `components/organizer/FestivalEditForm.tsx`:

```tsx
// components/organizer/FestivalEditForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Festival = {
  id: string;
  title: string;
  description: string | null;
  description_short: string | null;
  website_url: string | null;
  ticket_url: string | null;
  price_range: string | null;
  is_free: boolean | null;
};

export function FestivalEditForm({ festival }: { festival: Festival }) {
  const router = useRouter();
  const [form, setForm] = useState({
    description: festival.description ?? "",
    description_short: festival.description_short ?? "",
    website_url: festival.website_url ?? "",
    ticket_url: festival.ticket_url ?? "",
    price_range: festival.price_range ?? "",
    is_free: Boolean(festival.is_free),
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onChange<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    const res = await fetch(`/api/organizer/festivals/${festival.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok || !json.ok) {
      setError(json.error ?? "Грешка при запис");
      return;
    }
    setMessage("Запазено.");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-black/10 bg-white p-5">
      <h2 className="text-sm font-medium text-black/75">Основна информация</h2>

      <label className="block text-sm">
        Кратко описание
        <input
          type="text"
          maxLength={200}
          value={form.description_short}
          onChange={(e) => onChange("description_short", e.target.value)}
          className="mt-1 w-full rounded-md border border-black/10 px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        Описание
        <textarea
          rows={6}
          value={form.description}
          onChange={(e) => onChange("description", e.target.value)}
          className="mt-1 w-full rounded-md border border-black/10 px-3 py-2"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          Уебсайт
          <input
            type="url"
            value={form.website_url}
            onChange={(e) => onChange("website_url", e.target.value)}
            className="mt-1 w-full rounded-md border border-black/10 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Билети (линк)
          <input
            type="url"
            value={form.ticket_url}
            onChange={(e) => onChange("ticket_url", e.target.value)}
            className="mt-1 w-full rounded-md border border-black/10 px-3 py-2"
          />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm">
          Цена (диапазон)
          <input
            type="text"
            value={form.price_range}
            onChange={(e) => onChange("price_range", e.target.value)}
            placeholder="напр. 20-40 лв."
            className="ml-2 rounded-md border border-black/10 px-3 py-1.5"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_free}
            onChange={(e) => onChange("is_free", e.target.checked)}
          />
          Безплатно
        </label>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/85 disabled:opacity-50"
        >
          {busy ? "Запис..." : "Запази"}
        </button>
        {message && <span className="text-xs text-emerald-700">{message}</span>}
        {error && <span className="text-xs text-red-700">{error}</span>}
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Type-check + manual smoke**

```bash
npx tsc --noEmit
npm run dev
```

Manual:
- Като owner: `/organizer/festivals/<X>/edit` зарежда формата, save обновява описанието.
- Като co_host: `/organizer/festivals/<X>/edit` → redirect към view.
- Като outsider: 404.
- Add/Remove co_host през UI секцията.

- [ ] **Step 5: Commit**

```bash
git add app/organizer/(workspace)/festivals/[id]/edit/page.tsx components/organizer/CoOrganizersSection.tsx components/organizer/FestivalEditForm.tsx
git commit -m "feat(organizer-portal): add festival edit page with co-organizers management"
```

---

## Task 13: Docs updates

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/system-architecture.md`

- [ ] **Step 1: Update CLAUDE.md (Organizer portal section)**

Намери секцията „Organizer portal" в `CLAUDE.md`. Добави нова bullet точка след съществуващите:

```md
- **Per-festival роли (2026-06):** `festival_organizers.role` (`owner` | `co_host`). Точно един `owner` на фестивал (enforced от partial unique index). Portal-submitted фестивали → submitting organizer става `owner` при approve. Останалите organizer entries и всички admin/research/ingest фестивали остават `co_host` (orphan от portal перспектива; admin продължава да ги управлява). Permission gating: `lib/organizer/festivalAccess.ts#getUserFestivalRole`. Edit и co-organizer management са owner-only през `/api/organizer/festivals/[id]` и `/co-organizers`.
```

- [ ] **Step 2: Update docs/system-architecture.md (Organizer portal section)**

В „Organizer portal" под-секцията на `docs/system-architecture.md`, добави след съществуващите bullet-и:

```md
- **Festival ownership (2026-06):** `festival_organizers` въвежда per-festival роля `owner` / `co_host` (`scripts/sql/20260601_festival_organizers_role_constraint.sql`). При approve на portal-submitted pending, submitting organizer (`pending_festivals.organizer_id`) се записва като `owner`; останалите organizer entries → `co_host`. Admin/ingest/research approves → всички `co_host` (orphan). Organizer-portal endpoints (`GET /api/organizer/festivals/[id]`, `PATCH .../[id]`, `POST/DELETE .../[id]/co-organizers`) gate-ват през `lib/organizer/festivalAccess.ts`. Read-only view (`/organizer/festivals/[id]`) виждан от owner и co_host; edit (`/organizer/festivals/[id]/edit`) — owner-only.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs/system-architecture.md
git commit -m "docs: document festival owner/co_host roles and portal endpoints"
```

---

## Task 14: Final integration smoke (manual)

- [ ] **Step 1: End-to-end smoke през live UI**

Сценарий A (portal owner):
1. Login като user A → claim organizer Orga (status active, role owner).
2. Submit pending festival като Orga, добави Orgb в `organizer_entries` (Orgb също е existing organizer).
3. Admin approve.
4. Login като user A → `/organizer/dashboard` → festival се показва с badge „Собственик", бутон „Редактирай".
5. Login като user B (active member на Orgb) → същият festival се показва с badge „Съ-организатор", без бутон „Редактирай".
6. User A отваря edit, добавя Orgc като co_host през UI секцията → user C (member на Orgc) вижда festival-а в dashboard-а си като „Съ-организатор".
7. User A се опитва да премахне Orga (себе си като owner) → endpoint връща 400.
8. User B опитва PATCH директно през Network → 403.

Сценарий B (admin orphan):
1. Admin approve-ва ingest pending festival, в който има 2 organizers.
2. SQL проверка: всички festival_organizers редове са `co_host`, **няма owner**.
3. Никой organizer-portal user не може да edit-ва (всички получават 403).
4. Admin продължава да edit-ва нормално през `/admin/festivals/<id>`.

- [ ] **Step 2: Финален commit (ако са нужни малки UI настройки)**

```bash
git add -A
git commit -m "chore(organizer-portal): smoke-test polish for festival roles"
```

Ако смоук-ът мине без промени → пропусни този commit.

---

## Out of scope (потвърждение)

Тези **не** влизат в текущия plan, както е дефинирано в spec-а:
- Co-editor роля.
- Invite/accept flow за co_host добавяне (директно добавяне).
- Transfer ownership UI flow (placeholder „Скоро" в UI; backend подготвен — добавяне в бъдеще без schema промени).
- Email/push notifications при добавяне като co_host.
- Bulk add на множество co_hosts.
- Edit на programme/media/hero/dates през organizer portal — остават admin-only.
- Historical data backfill за non-portal фестивали (остават orphan, admin продължава да ги управлява).

## Success criteria (от spec-а)

След пълно изпълнение:

1. ✅ Migration: всички `festival_organizers` редове имат валиден `role` (`owner` или `co_host`); няма дублирани owner-и на същия festival.
2. ✅ co_host user:
   - вижда festival-а в dashboard-а си с badge „Съ-организатор";
   - **не може** да отвори edit (redirect към view);
   - PATCH endpoint връща 403.
3. ✅ owner user:
   - вижда festival-а с badge „Собственик";
   - може да edit-ва subset от полета (description, links, price);
   - може да добавя/маха co_hosts;
   - **не може** да изтрие себе си като owner (endpoint връща 400).
4. ✅ Admin продължава да управлява orphan и portal фестивали безпрепятствено.
5. ✅ Публичната страница на фестивала изглежда еднакво за external visitors.
