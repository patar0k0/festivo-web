# Organizer Duplicates Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Подобри `/admin/organizers/duplicates` с по-широка детекция (medium-confidence bucket сигнали), по-безопасен двустъпков merge с видимост на фестивали/профил, и персистентно отхвърляне на фалшиви двойки.

**Architecture:** Bucket-базирана детекция (O(n)) разширена с 3 нови нормализатора в `organizerNormalization.ts`. Нова таблица `organizer_duplicate_dismissals` (+ RLS, без публични политики). Нов admin API за dismiss/restore. `page.tsx` зарежда данни, строи двойките, изчислява confidence, зарежда dismissals и festival counts преди рендер. `OrganizerDuplicatesTable` е напълно пренаписан с двустъпков merge, dismiss/restore и сгъната секция за отхвърлени двойки.

**Tech Stack:** Next.js 14 App Router · TypeScript · Supabase (service-role) · Tailwind · `lib/admin/organizerNormalization.ts`

**Spec:** `docs/superpowers/specs/2026-06-03-organizer-duplicates-improvements-design.md`
**Branch:** `feat/organizer-duplicates-improvements`

---

## File Map

| Файл | Промяна |
|---|---|
| `lib/admin/organizerNormalization.ts` | + 3 нови exports |
| `scripts/sql/20260603_organizer_duplicate_dismissals.sql` | **нов** |
| `app/admin/api/organizers/duplicates/dismiss/route.ts` | **нов** |
| `app/admin/(protected)/organizers/duplicates/page.tsx` | значителна промяна |
| `components/admin/OrganizerDuplicatesTable.tsx` | пълен rewrite |

Merge API (`app/admin/api/organizers/merge/route.ts`) — **не се пипа**.

---

## Task 1: Нови нормализатори

**Files:**
- Modify: `lib/admin/organizerNormalization.ts`

- [ ] **Стъпка 1: Добави 3 нови export функции** в края на файла (след `normalizeOrganizerFacebookUrl`):

```typescript
export function normalizeOrganizerNameAggressive(value: unknown): string | null {
  const matched = normalizeOrganizerNameForMatch(value);
  if (!matched) return null;
  // Strip everything except letters (incl. Cyrillic) and digits
  const stripped = matched.replace(/[^\p{L}\p{N}]/gu, "");
  return stripped || null;
}

export function extractWebsiteDomain(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const hostname = url.hostname.replace(/^www\./, "").toLowerCase();
    return hostname || null;
  } catch {
    return null;
  }
}

export function extractEmailDomain(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const atIdx = value.lastIndexOf("@");
  if (atIdx === -1) return null;
  const domain = value.slice(atIdx + 1).trim().toLowerCase();
  return domain || null;
}
```

- [ ] **Стъпка 2: Провери TypeScript компилация**

```powershell
npx tsc --noEmit
```

Очаква се: без грешки.

- [ ] **Стъпка 3: Commit**

```bash
git add lib/admin/organizerNormalization.ts
git commit -m "feat(admin): add aggressive name, website domain, email domain normalizers"
```

---

## Task 2: SQL миграция за dismissals

**Files:**
- Create: `scripts/sql/20260603_organizer_duplicate_dismissals.sql`

- [ ] **Стъпка 1: Създай миграционния файл**

```sql
-- organizer_duplicate_dismissals
-- Stores admin-dismissed false-positive organizer duplicate pairs.
-- RLS enabled, no public policies — service-role only.
-- Canonical order: organizer_a < organizer_b (lexical UUID comparison).

create table if not exists public.organizer_duplicate_dismissals (
  id            uuid        primary key default gen_random_uuid(),
  organizer_a   uuid        not null references public.organizers(id) on delete cascade,
  organizer_b   uuid        not null references public.organizers(id) on delete cascade,
  dismissed_by  uuid        references auth.users(id),
  created_at    timestamptz not null default now(),

  constraint organizer_duplicate_dismissals_ordered
    check (organizer_a < organizer_b),
  constraint organizer_duplicate_dismissals_unique
    unique (organizer_a, organizer_b)
);

-- organizer_a is already covered by the unique index.
-- Add index on organizer_b for reverse lookups and cascade scans.
create index if not exists idx_org_dup_dismissals_b
  on public.organizer_duplicate_dismissals (organizer_b);

alter table public.organizer_duplicate_dismissals enable row level security;
-- No public policies: anon and authenticated roles cannot access this table.
-- All access goes through the service-role client in admin API routes.
```

- [ ] **Стъпка 2: Приложи миграцията в Supabase**

Отиди в Supabase Dashboard → SQL Editor, постави съдържанието и изпълни. Или използвай Supabase MCP `apply_migration` ако е достъпен.

Провери: таблицата `organizer_duplicate_dismissals` съществува в `public` схемата.

- [ ] **Стъпка 3: Commit**

```bash
git add scripts/sql/20260603_organizer_duplicate_dismissals.sql
git commit -m "chore(db): add organizer_duplicate_dismissals table with RLS"
```

---

## Task 3: Dismiss API

**Files:**
- Create: `app/admin/api/organizers/duplicates/dismiss/route.ts`

- [ ] **Стъпка 1: Създай route файла**

```typescript
import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction } from "@/lib/admin/audit-log";

function normalizeId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function canonicalize(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { a?: string; b?: string };
  const rawA = normalizeId(body.a);
  const rawB = normalizeId(body.b);
  if (!rawA || !rawB) return NextResponse.json({ error: "a and b are required" }, { status: 400 });
  if (rawA === rawB) return NextResponse.json({ error: "a and b must be different" }, { status: 400 });

  const [orgA, orgB] = canonicalize(rawA, rawB);

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { error } = await admin
    .from("organizer_duplicate_dismissals")
    .upsert(
      { organizer_a: orgA, organizer_b: orgB, dismissed_by: ctx.user.id },
      { onConflict: "organizer_a,organizer_b" },
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    await logAdminAction({
      actor_user_id: ctx.user.id,
      action: "organizer.duplicate_dismissed",
      entity_type: "organizer",
      entity_id: orgA,
      route: "/admin/api/organizers/duplicates/dismiss",
      method: "POST",
      details: { organizer_a: orgA, organizer_b: orgB },
    });
  } catch { /* non-fatal */ }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { a?: string; b?: string };
  const rawA = normalizeId(body.a);
  const rawB = normalizeId(body.b);
  if (!rawA || !rawB) return NextResponse.json({ error: "a and b are required" }, { status: 400 });

  const [orgA, orgB] = canonicalize(rawA, rawB);

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { error } = await admin
    .from("organizer_duplicate_dismissals")
    .delete()
    .eq("organizer_a", orgA)
    .eq("organizer_b", orgB);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    await logAdminAction({
      actor_user_id: ctx.user.id,
      action: "organizer.duplicate_dismissal_restored",
      entity_type: "organizer",
      entity_id: orgA,
      route: "/admin/api/organizers/duplicates/dismiss",
      method: "DELETE",
      details: { organizer_a: orgA, organizer_b: orgB },
    });
  } catch { /* non-fatal */ }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Стъпка 2: Провери TypeScript компилация**

```powershell
npx tsc --noEmit
```

Очаква се: без грешки.

- [ ] **Стъпка 3: Commit**

```bash
git add app/admin/api/organizers/duplicates/dismiss/route.ts
git commit -m "feat(admin): add organizer duplicate dismiss/restore API"
```

---

## Task 4: Обновен page.tsx

**Files:**
- Modify: `app/admin/(protected)/organizers/duplicates/page.tsx`

- [ ] **Стъпка 1: Замени съдържанието на файла изцяло**

```typescript
import Link from "next/link";
import { redirect } from "next/navigation";
import OrganizerDuplicatesTable from "@/components/admin/OrganizerDuplicatesTable";
import { getAdminContext } from "@/lib/admin/isAdmin";
import {
  extractEmailDomain,
  extractWebsiteDomain,
  normalizeOrganizerFacebookUrl,
  normalizeOrganizerNameAggressive,
  normalizeOrganizerNameForMatch,
  normalizeOrganizerSlug,
} from "@/lib/admin/organizerNormalization";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

type OrganizerRow = {
  id: string;
  name: string | null;
  slug: string | null;
  facebook_url: string | null;
  website_url: string | null;
  email: string | null;
  description: string | null;
  logo_url: string | null;
  phone: string | null;
  festivalCount?: number;
};

type DuplicateRow = {
  left: OrganizerRow;
  right: OrganizerRow;
  reasons: string[];
  confidence: "high" | "medium";
};

type DismissedRow = {
  left: OrganizerRow;
  right: OrganizerRow;
};

function pairKey(a: string, b: string) {
  return [a, b].sort().join(":");
}

const HIGH_CONFIDENCE_REASONS = new Set([
  "exact normalized name",
  "exact slug",
  "exact facebook_url",
]);

function buildDuplicateRows(rows: OrganizerRow[]): DuplicateRow[] {
  const byPair = new Map<string, DuplicateRow>();

  const add = (left: OrganizerRow, right: OrganizerRow, reason: string) => {
    if (left.id === right.id) return;
    const key = pairKey(left.id, right.id);
    const existing = byPair.get(key);
    if (existing) {
      if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
      return;
    }
    const [a, b] = left.id < right.id ? [left, right] : [right, left];
    byPair.set(key, { left: a, right: b, reasons: [reason], confidence: "medium" });
  };

  const bucketize = (keyFn: (row: OrganizerRow) => string | null, reason: string) => {
    const buckets = new Map<string, OrganizerRow[]>();
    for (const row of rows) {
      const key = keyFn(row);
      if (!key) continue;
      const list = buckets.get(key) ?? [];
      list.push(row);
      buckets.set(key, list);
    }
    for (const bucketRows of buckets.values()) {
      if (bucketRows.length < 2) continue;
      for (let i = 0; i < bucketRows.length; i += 1) {
        for (let j = i + 1; j < bucketRows.length; j += 1) {
          add(bucketRows[i], bucketRows[j], reason);
        }
      }
    }
  };

  // High-confidence signals (exact match on normalized fields)
  bucketize((row) => normalizeOrganizerNameForMatch(row.name), "exact normalized name");
  bucketize((row) => normalizeOrganizerSlug(row.slug), "exact slug");
  bucketize((row) => normalizeOrganizerFacebookUrl(row.facebook_url), "exact facebook_url");

  // Medium-confidence signals
  bucketize((row) => normalizeOrganizerNameAggressive(row.name), "similar name (normalized)");
  bucketize((row) => extractWebsiteDomain(row.website_url), "same website domain");
  bucketize((row) => extractEmailDomain(row.email), "same email domain");

  // Promote pairs that have at least one high-confidence reason
  for (const row of byPair.values()) {
    if (row.reasons.some((r) => HIGH_CONFIDENCE_REASONS.has(r))) {
      row.confidence = "high";
    }
  }

  return Array.from(byPair.values()).sort((a, b) => {
    if (a.confidence !== b.confidence) return a.confidence === "high" ? -1 : 1;
    if (b.reasons.length !== a.reasons.length) return b.reasons.length - a.reasons.length;
    return (a.left.name ?? "").localeCompare(b.left.name ?? "", "bg-BG");
  });
}

export default async function OrganizerDuplicatesPage() {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect("/login?next=/admin/organizers/duplicates");
  }

  let adminClient;
  try {
    adminClient = createSupabaseAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to initialize admin client";
    console.error("[admin/organizers/duplicates/page] Admin client initialization failed", { message });
    return (
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">
        Детекцията на дубликати е временно недостъпна.
      </div>
    );
  }

  const { data, error } = await adminClient
    .from("organizers")
    .select("id,name,slug,facebook_url,website_url,email,description,logo_url,phone")
    .eq("is_active", true)
    .order("name", { ascending: true })
    .returns<OrganizerRow[]>();

  if (error) {
    console.error("[admin/organizers/duplicates/page] organizers query failed", { message: error.message });
    return (
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">
        {error.message}
      </div>
    );
  }

  const allDuplicateRows = buildDuplicateRows(data ?? []);

  // Load dismissals and split active / dismissed
  const { data: dismissals } = await adminClient
    .from("organizer_duplicate_dismissals")
    .select("organizer_a,organizer_b")
    .returns<Array<{ organizer_a: string; organizer_b: string }>>();

  const dismissedKeys = new Set(
    (dismissals ?? []).map((d) => pairKey(d.organizer_a, d.organizer_b)),
  );

  const activeRows = allDuplicateRows.filter(
    (r) => !dismissedKeys.has(pairKey(r.left.id, r.right.id)),
  );
  const dismissedRows: DismissedRow[] = allDuplicateRows
    .filter((r) => dismissedKeys.has(pairKey(r.left.id, r.right.id)))
    .map((r) => ({ left: r.left, right: r.right }));

  // Festival counts for organizers in active pairs only
  const activeIds = new Set<string>();
  for (const r of activeRows) {
    activeIds.add(r.left.id);
    activeIds.add(r.right.id);
  }

  const festivalCountMap = new Map<string, number>();
  if (activeIds.size > 0) {
    const { data: festivalLinks } = await adminClient
      .from("festival_organizers")
      .select("organizer_id")
      .in("organizer_id", Array.from(activeIds))
      .returns<Array<{ organizer_id: string }>>();

    for (const link of festivalLinks ?? []) {
      festivalCountMap.set(
        link.organizer_id,
        (festivalCountMap.get(link.organizer_id) ?? 0) + 1,
      );
    }
  }

  const enrichedRows: DuplicateRow[] = activeRows.map((r) => ({
    ...r,
    left: { ...r.left, festivalCount: festivalCountMap.get(r.left.id) ?? 0 },
    right: { ...r.right, festivalCount: festivalCountMap.get(r.right.id) ?? 0 },
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-black/[0.08] bg-white/85 p-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Дубликати на организатори</h1>
          <p className="mt-1 text-sm text-black/65">
            Кандидати за дублиране по нормализирани полета. Merge-ът е необратим — проверявай преди да действаш.
          </p>
        </div>
        <Link
          href="/admin/organizers"
          className="rounded-lg border border-black/[0.12] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] hover:bg-black/[0.04]"
        >
          Назад
        </Link>
      </div>

      <OrganizerDuplicatesTable rows={enrichedRows} dismissedRows={dismissedRows} />
    </div>
  );
}
```

- [ ] **Стъпка 2: Провери TypeScript компилация**

```powershell
npx tsc --noEmit
```

Очаква се: без грешки.

- [ ] **Стъпка 3: Commit**

```bash
git add "app/admin/(protected)/organizers/duplicates/page.tsx"
git commit -m "feat(admin): extend duplicate detection with medium-confidence signals, festival counts, dismissals"
```

---

## Task 5: Пренаписан OrganizerDuplicatesTable

**Files:**
- Modify: `components/admin/OrganizerDuplicatesTable.tsx`

- [ ] **Стъпка 1: Замени целия файл**

```typescript
"use client";

import { useState } from "react";

type OrganizerCard = {
  id: string;
  name: string | null;
  slug: string | null;
  facebook_url: string | null;
  website_url: string | null;
  email: string | null;
  description: string | null;
  logo_url: string | null;
  phone: string | null;
  festivalCount?: number;
};

type DuplicateRow = {
  left: OrganizerCard;
  right: OrganizerCard;
  reasons: string[];
  confidence: "high" | "medium";
};

type DismissedRow = {
  left: OrganizerCard;
  right: OrganizerCard;
};

type ConfirmingState = {
  sourceId: string;
  targetId: string;
  sourceName: string;
  targetName: string;
  sourceFestivals: number;
};

function OrganizerCardView({ org }: { org: OrganizerCard }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        {org.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={org.logo_url}
            alt=""
            className="h-8 w-8 flex-shrink-0 rounded-lg object-cover"
          />
        )}
        <a
          href={`/admin/organizers/${org.id}`}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-[#0c0e14] hover:underline"
        >
          {org.name ?? "(без име)"}
        </a>
      </div>
      <div className="space-y-0.5 text-xs text-black/55">
        <div>{org.festivalCount ?? 0} фестивала</div>
        {org.slug && <div>slug: {org.slug}</div>}
        {org.website_url && <div>web: {org.website_url}</div>}
        {org.email && <div>имейл: {org.email}</div>}
        {org.phone && <div>тел: {org.phone}</div>}
        {org.facebook_url && <div>fb: {org.facebook_url}</div>}
        {org.description && (
          <div className="mt-1 line-clamp-2 text-black/40">{org.description}</div>
        )}
      </div>
    </div>
  );
}

export default function OrganizerDuplicatesTable({
  rows,
  dismissedRows,
}: {
  rows: DuplicateRow[];
  dismissedRows: DismissedRow[];
}) {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<ConfirmingState | null>(null);
  const [dismissedOpen, setDismissedOpen] = useState(false);

  async function merge(sourceId: string, targetId: string) {
    const key = `merge:${sourceId}:${targetId}`;
    setLoadingKey(key);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/admin/api/organizers/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: sourceId, target_id: targetId }),
      });
      const payload = (await res.json().catch(() => null)) as {
        error?: string;
        ok?: boolean;
      } | null;
      if (!res.ok || !payload?.ok) throw new Error(payload?.error ?? "Грешка при сливане.");
      setMessage("Сливането е успешно. Презареждане…");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неочаквана грешка.");
    } finally {
      setLoadingKey(null);
      setConfirming(null);
    }
  }

  async function dismiss(a: string, b: string) {
    const key = `dismiss:${[a, b].sort().join(":")}`;
    setLoadingKey(key);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/admin/api/organizers/duplicates/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ a, b }),
      });
      const payload = (await res.json().catch(() => null)) as {
        error?: string;
        ok?: boolean;
      } | null;
      if (!res.ok || !payload?.ok) throw new Error(payload?.error ?? "Грешка при отхвърляне.");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неочаквана грешка.");
    } finally {
      setLoadingKey(null);
    }
  }

  async function restore(a: string, b: string) {
    const key = `restore:${[a, b].sort().join(":")}`;
    setLoadingKey(key);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/admin/api/organizers/duplicates/dismiss", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ a, b }),
      });
      const payload = (await res.json().catch(() => null)) as {
        error?: string;
        ok?: boolean;
      } | null;
      if (!res.ok || !payload?.ok)
        throw new Error(payload?.error ?? "Грешка при възстановяване.");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неочаквана грешка.");
    } finally {
      setLoadingKey(null);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-black/[0.08] bg-white/90 p-5">
      <p className="text-sm text-black/65">
        Консервативни съвпадения. Всяко сливане е ръчно и необратимо.
      </p>

      {message && <p className="text-sm text-[#1f7a37]">{message}</p>}
      {error && <p className="text-sm text-[#b13a1a]">{error}</p>}

      {rows.length === 0 ? (
        <p className="rounded-xl bg-black/[0.03] p-4 text-sm text-black/65">
          Не са намерени вероятни дубликати.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-black/[0.08]">
          <table className="min-w-full text-sm">
            <thead className="bg-black/[0.03] text-left text-xs uppercase tracking-[0.14em] text-black/55">
              <tr>
                <th className="px-3 py-2">Ляв организатор</th>
                <th className="px-3 py-2">Десен организатор</th>
                <th className="px-3 py-2">Съвпадения</th>
                <th className="px-3 py-2">Действия</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const pairId = [row.left.id, row.right.id].sort().join(":");
                const isConfirming =
                  confirming !== null &&
                  [confirming.sourceId, confirming.targetId].sort().join(":") === pairId;

                return (
                  <tr
                    key={pairId}
                    className="border-t border-black/[0.08] align-top"
                  >
                    <td className="px-3 py-3">
                      <OrganizerCardView org={row.left} />
                    </td>
                    <td className="px-3 py-3">
                      <OrganizerCardView org={row.right} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            row.confidence === "high"
                              ? "bg-[#0c0e14] text-white"
                              : "bg-black/[0.08] text-black/60"
                          }`}
                        >
                          {row.confidence === "high" ? "висока" : "средна"}
                        </span>
                        {row.reasons.map((r) => (
                          <span
                            key={r}
                            className="inline-flex items-center rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px] text-black/60"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {isConfirming ? (
                        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                          <p className="text-xs text-amber-900">
                            <strong>{confirming.sourceName}</strong> ще се слее в{" "}
                            <strong>{confirming.targetName}</strong>.
                            {confirming.sourceFestivals > 0 &&
                              ` ${confirming.sourceFestivals} фестивала се местят.`}{" "}
                            Действието е необратимо.
                          </p>
                          <div className="flex gap-2">
                            <button
                              disabled={loadingKey !== null}
                              onClick={() =>
                                merge(confirming.sourceId, confirming.targetId)
                              }
                              className="rounded-lg bg-[#b13a1a] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              {loadingKey !== null ? "Сливане…" : "Потвърди"}
                            </button>
                            <button
                              disabled={loadingKey !== null}
                              onClick={() => setConfirming(null)}
                              className="rounded-lg border border-black/[0.12] px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                            >
                              Откажи
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <button
                            disabled={loadingKey !== null}
                            onClick={() =>
                              setConfirming({
                                sourceId: row.left.id,
                                targetId: row.right.id,
                                sourceName: row.left.name ?? "(без име)",
                                targetName: row.right.name ?? "(без име)",
                                sourceFestivals: row.left.festivalCount ?? 0,
                              })
                            }
                            className="block w-full rounded-lg bg-[#0c0e14] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
                          >
                            Слей ляв → десен
                          </button>
                          <button
                            disabled={loadingKey !== null}
                            onClick={() =>
                              setConfirming({
                                sourceId: row.right.id,
                                targetId: row.left.id,
                                sourceName: row.right.name ?? "(без име)",
                                targetName: row.left.name ?? "(без име)",
                                sourceFestivals: row.right.festivalCount ?? 0,
                              })
                            }
                            className="block w-full rounded-lg border border-black/[0.15] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] disabled:opacity-50"
                          >
                            Слей десен → ляв
                          </button>
                          <button
                            disabled={loadingKey !== null}
                            onClick={() => dismiss(row.left.id, row.right.id)}
                            className="block w-full rounded-lg border border-black/[0.10] px-3 py-2 text-xs font-medium text-black/50 hover:bg-black/[0.03] disabled:opacity-50"
                          >
                            Не са дубликати
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {dismissedRows.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setDismissedOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-black/45 hover:text-black/65"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`transition-transform ${dismissedOpen ? "rotate-90" : ""}`}
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
            Отхвърлени двойки ({dismissedRows.length})
          </button>
          {dismissedOpen && (
            <div className="overflow-hidden rounded-xl border border-black/[0.06]">
              <table className="min-w-full text-xs">
                <tbody>
                  {dismissedRows.map((row) => {
                    const pairId = [row.left.id, row.right.id].sort().join(":");
                    const restoreKey = `restore:${pairId}`;
                    return (
                      <tr
                        key={pairId}
                        className="border-t border-black/[0.06] first:border-t-0"
                      >
                        <td className="px-3 py-2 text-black/50">
                          {row.left.name ?? "(без име)"}
                        </td>
                        <td className="px-3 py-2 text-black/35">↔</td>
                        <td className="px-3 py-2 text-black/50">
                          {row.right.name ?? "(без име)"}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            disabled={loadingKey !== null}
                            onClick={() => restore(row.left.id, row.right.id)}
                            className="rounded-lg border border-black/[0.12] px-2 py-1 text-[11px] font-medium text-black/50 hover:bg-black/[0.03] disabled:opacity-50"
                          >
                            {loadingKey === restoreKey ? "…" : "Върни"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Стъпка 2: Провери TypeScript компилация**

```powershell
npx tsc --noEmit
```

Очаква се: без грешки.

- [ ] **Стъпка 3: Commit**

```bash
git add components/admin/OrganizerDuplicatesTable.tsx
git commit -m "feat(admin): rewrite OrganizerDuplicatesTable with two-step merge, dismiss, confidence badge"
```

---

## Task 6: Ръчна верификация и PR

- [ ] **Стъпка 1: Стартирай dev server и отиди на страницата**

```powershell
npm run dev
```

Отвори `http://localhost:3000/admin/organizers/duplicates`

- [ ] **Стъпка 2: Провери detection**
  - Виждат се двойки с бадж „висока" (тъмен) и „средна" (блед)
  - Reason badges изброяват причините

- [ ] **Стъпка 3: Провери merge flow**
  - Клик на „Слей ляв → десен" → появява се инлайн потвърждение (жълт фон)
  - Текстът назовава двата организатора и броя фестивали
  - Клик „Откажи" → скрива потвърждението, бутоните се връщат
  - Клик „Потвърди" → spinner, после reload; двойката изчезва

- [ ] **Стъпка 4: Провери dismiss flow**
  - Клик „Не са дубликати" → reload; двойката изчезва от активния списък
  - Долу „Отхвърлени двойки (N)" се появява
  - Разгъни → двойката е там
  - Клик „Върни" → reload; двойката се връща в активния списък

- [ ] **Стъпка 5: Push, PR, merge**

```bash
git push -u origin feat/organizer-duplicates-improvements
gh pr create --title "feat(admin): organizer duplicates — better detection, safe merge, dismissals" --body "$(cat <<'EOF'
## Proposed Change
- Summary: По-широка детекция (medium-confidence bucket сигнали — агресивно нормализирано име, домейн на website/email). Confidence бадж (висока/средна). Двустъпков merge с брой фестивали и профилни линкове. Персистентно отхвърляне на фалшиви двойки.
- Why now: Launch sprint — почистване на duplicate организатори преди публичен старт.

## Impacted Docs
- Spec: `docs/superpowers/specs/2026-06-03-organizer-duplicates-improvements-design.md`

## Checklist
- [x] Schema: миграция `scripts/sql/20260603_organizer_duplicate_dismissals.sql` с индекс + RLS (без публични политики)
- [x] API contract: нов endpoint `/admin/api/organizers/duplicates/dismiss` (POST/DELETE), admin-gated
- [x] Merge API: непроменен
- [x] Background jobs: n/a
- [x] Security: service-role само сървър, RLS заключва anon/authenticated
- [x] Docs: spec в това PR

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
gh pr merge --merge --delete-branch
```

---

## Бележки за изпълнение

- **Миграцията (Task 2) трябва да е приложена в Supabase преди Task 3 и Task 4** — иначе заявките към `organizer_duplicate_dismissals` ще върнат грешка.
- Tasks 1, 3, 4, 5 са независими като код, но deploy-ват заедно; миграцията е prerequisite за runtime.
- Merge API (`/admin/api/organizers/merge`) не се пипа — всички съществуващи merge-ове продължават да работят.
