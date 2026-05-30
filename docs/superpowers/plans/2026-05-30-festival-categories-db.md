# Festival Categories — DB-Managed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Премести категориите от hardcoded TypeScript константа в `festival_categories` DB таблица, за да могат да се управляват от admin панела без code deploy.

**Architecture:** Нова `festival_categories` таблица (slug PK + label_bg + sort_order + is_active) е единственият source of truth. Сървърна функция `listActiveFestivalCategories()` чете от нея. Admin CRUD страница + API позволяват добавяне, преименуване и деактивиране. Всички форми получават категориите като prop от server component-а. Gemini prompt се генерира динамично от таблицата.

**Tech Stack:** Next.js 14 App Router · Supabase Postgres + RLS · TypeScript · Tailwind

---

## Засегнати файлове

| Файл | Промяна |
|---|---|
| `scripts/sql/20260530_festival_categories_table.sql` | **Нов** — DDL + RLS + seed |
| `lib/festivals/categories.server.ts` | **Нов** — `listActiveFestivalCategories()`, `listAllFestivalCategories()` |
| `app/admin/api/festival-categories/route.ts` | **Нов** — GET (all + counts) + POST (add) |
| `app/admin/api/festival-categories/[slug]/route.ts` | **Нов** — PATCH (rename/reorder/toggle) |
| `app/admin/(protected)/categories/page.tsx` | **Нов** — server page |
| `components/admin/CategoriesManager.tsx` | **Нов** — client CRUD UI |
| `lib/admin/adminNavConfig.ts` | Добавя "Категории" в "Съдържание" |
| `lib/festivals/publicCategoryShared.ts` | Трие `CANONICAL_FESTIVAL_CATEGORIES`, `CATEGORY_MAP`, `mapToCanonicalCategory()` |
| `lib/festivals/publicCategories.ts` | Обновява re-exports |
| `lib/festivals/publicCategories.server.ts` | `listPublicFestivalCategorySlugs()` чете от `festival_categories` |
| `lib/festival/mappers.ts` | `normalizeCategory()` → само trim+lowercase (без mapping) |
| `app/admin/(protected)/festivals/[id]/page.tsx` | Fetch categories + pass prop |
| `components/admin/FestivalEditForm.tsx` | `categories` prop → select options |
| `app/admin/(protected)/pending-festivals/[id]/page.tsx` | Fetch categories + pass prop |
| `components/admin/PendingFestivalEditForm.tsx` | `categories` prop → select options |
| `app/organizer/(workspace)/festivals/new/page.tsx` | Fetch active categories + pass prop |
| `app/organizer/(workspace)/festivals/new/NewFestivalSubmissionClient.tsx` | `categories` prop → select options |
| `lib/admin/research/gemini-extract.ts` | `extractFestivalFieldsFromEvidence` приема `categories` параметър |
| `lib/admin/research/research-pipeline.ts` | Подава categories при извикване |
| `lib/admin/research/smart-pipeline.ts` | Подава categories при извикване |

---

## Task 1: SQL таблица, RLS и seed данни

**Files:**
- Create: `scripts/sql/20260530_festival_categories_table.sql`

- [ ] **Стъпка 1: Създай SQL файла**

```sql
-- Migration: 20260530_festival_categories_table
-- Creates a managed festival_categories table so admins can
-- add/rename/deactivate categories without code changes.

CREATE TABLE festival_categories (
  slug       text        PRIMARY KEY,          -- lowercase, stored in festivals.category
  label_bg   text        NOT NULL,             -- Bulgarian display label
  sort_order integer     NOT NULL DEFAULT 0,
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE festival_categories ENABLE ROW LEVEL SECURITY;

-- Public and authenticated users can read active categories (for organizer form + public filter)
CREATE POLICY "Anyone can read active festival categories"
  ON festival_categories FOR SELECT
  USING (is_active = true);

-- Seed with 7 canonical categories from previous migration
INSERT INTO festival_categories (slug, label_bg, sort_order) VALUES
  ('фолклорен фестивал', 'Фолклорен фестивал', 1),
  ('събор',              'Събор',               2),
  ('кулинарен фестивал', 'Кулинарен фестивал', 3),
  ('музикален фестивал', 'Музикален фестивал', 4),
  ('танцов фестивал',    'Танцов фестивал',    5),
  ('културен фестивал',  'Културен фестивал',  6),
  ('арт фестивал',       'Арт фестивал',       7);
```

- [ ] **Стъпка 2: Изпълни в Supabase SQL Editor**

Копирай горния SQL и го изпълни в Supabase Dashboard → SQL Editor.

- [ ] **Стъпка 3: Верифицирай**

В SQL Editor:
```sql
SELECT slug, label_bg, sort_order, is_active FROM festival_categories ORDER BY sort_order;
```
Очакван резултат: 7 реда.

- [ ] **Стъпка 4: Commit**

```bash
git add scripts/sql/20260530_festival_categories_table.sql
git commit -m "chore(db): add festival_categories table with RLS and seed"
```

---

## Task 2: Сървърна функция `listActiveFestivalCategories()`

**Files:**
- Create: `lib/festivals/categories.server.ts`

- [ ] **Стъпка 1: Създай файла**

```typescript
import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export type FestivalCategory = {
  slug: string;
  label_bg: string;
  sort_order: number;
  is_active: boolean;
};

/**
 * Active categories ordered by sort_order, then label_bg.
 * Uses anon client (respects RLS — only is_active = true rows returned).
 * Safe for server components visible to non-admin users.
 */
export async function listActiveFestivalCategories(): Promise<FestivalCategory[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("festival_categories")
    .select("slug,label_bg,sort_order,is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("label_bg", { ascending: true });

  if (error) {
    console.error("[listActiveFestivalCategories]", error.message);
    return [];
  }
  return (data ?? []) as FestivalCategory[];
}

/**
 * All categories including inactive. Uses service role — admin only.
 */
export async function listAllFestivalCategories(): Promise<FestivalCategory[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("festival_categories")
    .select("slug,label_bg,sort_order,is_active")
    .order("sort_order", { ascending: true })
    .order("label_bg", { ascending: true });

  if (error) {
    console.error("[listAllFestivalCategories]", error.message);
    return [];
  }
  return (data ?? []) as FestivalCategory[];
}
```

- [ ] **Стъпка 2: Commit**

```bash
git add lib/festivals/categories.server.ts
git commit -m "feat(categories): server functions to read from festival_categories table"
```

---

## Task 3: Admin API — GET + POST

**Files:**
- Create: `app/admin/api/festival-categories/route.ts`

- [ ] **Стъпка 1: Създай файла**

```typescript
import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { slugify } from "@/lib/utils";

export async function GET() {
  const ctx = await getAdminContext();
  if (!ctx?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createSupabaseAdmin();

  // Categories + festival counts in one go
  const [catResult, countResult] = await Promise.all([
    admin
      .from("festival_categories")
      .select("slug,label_bg,sort_order,is_active")
      .order("sort_order", { ascending: true })
      .order("label_bg", { ascending: true }),
    admin
      .from("festivals")
      .select("category")
      .not("category", "is", null)
      .neq("status", "archived"),
  ]);

  if (catResult.error) {
    return NextResponse.json({ error: catResult.error.message }, { status: 500 });
  }

  const counts: Record<string, number> = {};
  for (const row of countResult.data ?? []) {
    const c = typeof row.category === "string" ? row.category.trim() : "";
    if (c) counts[c] = (counts[c] ?? 0) + 1;
  }

  const categories = (catResult.data ?? []).map((cat) => ({
    ...cat,
    festival_count: counts[cat.slug] ?? 0,
  }));

  return NextResponse.json({ categories });
}

export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const label_bg = typeof body?.label_bg === "string" ? body.label_bg.trim() : "";
  if (!label_bg) {
    return NextResponse.json({ error: "label_bg е задължително" }, { status: 400 });
  }

  const sort_order = typeof body?.sort_order === "number" ? body.sort_order : 99;

  // Derive slug: lowercase trimmed label
  const slug = label_bg.toLocaleLowerCase("bg-BG").replace(/\s+/g, " ").trim();
  if (!slug) {
    return NextResponse.json({ error: "Невалиден лейбъл" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("festival_categories")
    .insert({ slug, label_bg, sort_order })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Категория с този slug вече съществува" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ category: data }, { status: 201 });
}
```

- [ ] **Стъпка 2: Commit**

```bash
git add "app/admin/api/festival-categories/route.ts"
git commit -m "feat(admin-api): GET + POST /admin/api/festival-categories"
```

---

## Task 4: Admin API — PATCH по slug

**Files:**
- Create: `app/admin/api/festival-categories/[slug]/route.ts`

- [ ] **Стъпка 1: Създай файла**

```typescript
import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const ctx = await getAdminContext();
  if (!ctx?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { slug } = await params;
  const body = await request.json().catch(() => ({}));

  const patch: Record<string, unknown> = {};
  if (typeof body.label_bg === "string" && body.label_bg.trim()) {
    patch.label_bg = body.label_bg.trim();
  }
  if (typeof body.sort_order === "number") {
    patch.sort_order = body.sort_order;
  }
  if (typeof body.is_active === "boolean") {
    patch.is_active = body.is_active;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Няма валидни полета за обновяване" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("festival_categories")
    .update(patch)
    .eq("slug", slug)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Не е намерена" }, { status: 404 });
  }

  return NextResponse.json({ category: data });
}
```

- [ ] **Стъпка 2: Commit**

```bash
git add "app/admin/api/festival-categories/[slug]/route.ts"
git commit -m "feat(admin-api): PATCH /admin/api/festival-categories/[slug]"
```

---

## Task 5: Admin CRUD компонент

**Files:**
- Create: `components/admin/CategoriesManager.tsx`

- [ ] **Стъпка 1: Създай файла**

```typescript
"use client";

import { useState, useTransition } from "react";

type Category = {
  slug: string;
  label_bg: string;
  sort_order: number;
  is_active: boolean;
  festival_count: number;
};

export default function CategoriesManager({ initial }: { initial: Category[] }) {
  const [categories, setCategories] = useState<Category[]>(initial);
  const [newLabel, setNewLabel] = useState("");
  const [newOrder, setNewOrder] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function reload() {
    const r = await fetch("/admin/api/festival-categories");
    if (r.ok) {
      const { categories: cats } = await r.json();
      setCategories(cats);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const label_bg = newLabel.trim();
    if (!label_bg) return;
    const sort_order = parseInt(newOrder) || categories.length + 1;

    startTransition(async () => {
      const r = await fetch("/admin/api/festival-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label_bg, sort_order }),
      });
      if (r.ok) {
        setNewLabel("");
        setNewOrder("");
        await reload();
      } else {
        const { error: err } = await r.json();
        setError(err ?? "Грешка при добавяне");
      }
    });
  }

  async function handleToggle(slug: string, is_active: boolean) {
    setError(null);
    startTransition(async () => {
      const r = await fetch(`/admin/api/festival-categories/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !is_active }),
      });
      if (r.ok) await reload();
      else setError("Грешка при промяна");
    });
  }

  async function handleRename(slug: string, current: string) {
    const label_bg = window.prompt("Нов лейбъл:", current);
    if (!label_bg || label_bg.trim() === current) return;
    setError(null);
    startTransition(async () => {
      const r = await fetch(`/admin/api/festival-categories/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label_bg: label_bg.trim() }),
      });
      if (r.ok) await reload();
      else setError("Грешка при преименуване");
    });
  }

  async function handleReorder(slug: string, current: number) {
    const input = window.prompt("Нов ред (число):", String(current));
    if (!input) return;
    const sort_order = parseInt(input);
    if (isNaN(sort_order)) return;
    setError(null);
    startTransition(async () => {
      const r = await fetch(`/admin/api/festival-categories/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order }),
      });
      if (r.ok) await reload();
      else setError("Грешка при пренареждане");
    });
  }

  return (
    <div className="space-y-6">
      {/* Add form */}
      <form onSubmit={handleAdd} className="flex items-end gap-3 rounded-2xl border border-black/[0.08] bg-white/85 p-4">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-black/50">
            Лейбъл
          </label>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="напр. Религиозен фестивал"
            className="w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
            required
          />
        </div>
        <div className="w-20">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-black/50">
            Ред
          </label>
          <input
            type="number"
            value={newOrder}
            onChange={(e) => setNewOrder(e.target.value)}
            placeholder={String(categories.length + 1)}
            className="w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={isPending || !newLabel.trim()}
          className="rounded-xl bg-[#0c0e14] px-4 py-2 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-40"
        >
          Добави
        </button>
      </form>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-black/[0.08] bg-white/85">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/[0.06] text-left text-[10px] font-semibold uppercase tracking-widest text-black/45">
              <th className="px-4 py-3">Ред</th>
              <th className="px-4 py-3">Лейбъл</th>
              <th className="px-4 py-3">Slug (в DB)</th>
              <th className="px-4 py-3">Фестивали</th>
              <th className="px-4 py-3">Активна</th>
              <th className="px-4 py-3">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04]">
            {categories.map((cat) => (
              <tr key={cat.slug} className={cat.is_active ? "" : "opacity-45"}>
                <td className="px-4 py-3 text-black/50">{cat.sort_order}</td>
                <td className="px-4 py-3 font-medium">{cat.label_bg}</td>
                <td className="px-4 py-3 font-mono text-xs text-black/50">{cat.slug}</td>
                <td className="px-4 py-3 text-black/70">{cat.festival_count}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${cat.is_active ? "bg-green-50 text-green-700" : "bg-black/5 text-black/40"}`}>
                    {cat.is_active ? "Да" : "Не"}
                  </span>
                </td>
                <td className="flex gap-2 px-4 py-3">
                  <button
                    onClick={() => handleRename(cat.slug, cat.label_bg)}
                    disabled={isPending}
                    className="rounded-lg border border-black/[0.1] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider hover:bg-black/5 disabled:opacity-40"
                  >
                    Преимен.
                  </button>
                  <button
                    onClick={() => handleReorder(cat.slug, cat.sort_order)}
                    disabled={isPending}
                    className="rounded-lg border border-black/[0.1] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider hover:bg-black/5 disabled:opacity-40"
                  >
                    Ред
                  </button>
                  <button
                    onClick={() => handleToggle(cat.slug, cat.is_active)}
                    disabled={isPending || (!cat.is_active === false && cat.festival_count > 0 && cat.is_active)}
                    className={`rounded-lg border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider disabled:opacity-40 ${cat.is_active ? "border-red-200 text-red-600 hover:bg-red-50" : "border-green-200 text-green-700 hover:bg-green-50"}`}
                  >
                    {cat.is_active ? "Деакт." : "Активир."}
                  </button>
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

- [ ] **Стъпка 2: Commit**

```bash
git add components/admin/CategoriesManager.tsx
git commit -m "feat(admin): CategoriesManager client component for category CRUD"
```

---

## Task 6: Admin страница `/admin/categories`

**Files:**
- Create: `app/admin/(protected)/categories/page.tsx`
- Modify: `lib/admin/adminNavConfig.ts`

- [ ] **Стъпка 1: Създай страницата**

```typescript
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import CategoriesManager from "@/components/admin/CategoriesManager";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const ctx = await getAdminContext();
  if (!ctx?.isAdmin) redirect("/login?next=/admin");

  const admin = createSupabaseAdmin();
  const [catResult, countResult] = await Promise.all([
    admin
      .from("festival_categories")
      .select("slug,label_bg,sort_order,is_active")
      .order("sort_order", { ascending: true })
      .order("label_bg", { ascending: true }),
    admin
      .from("festivals")
      .select("category")
      .not("category", "is", null)
      .neq("status", "archived"),
  ]);

  const counts: Record<string, number> = {};
  for (const row of countResult.data ?? []) {
    const c = typeof row.category === "string" ? row.category.trim() : "";
    if (c) counts[c] = (counts[c] ?? 0) + 1;
  }

  const categories = (catResult.data ?? []).map((cat) => ({
    ...cat,
    festival_count: counts[cat.slug] ?? 0,
  }));

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-[#0c0e14]">Категории на фестивали</h1>
        <p className="mt-1 text-sm text-black/55">
          Управлявай списъка с категории. Slug-ът се генерира автоматично и е постоянен — съхранява се директно в <code>festivals.category</code>.
        </p>
      </div>
      <CategoriesManager initial={categories} />
    </div>
  );
}
```

- [ ] **Стъпка 2: Добави в навигацията**

Отвори `lib/admin/adminNavConfig.ts`. В групата `"Съдържание"` добави след `"Фестивали"`:

```typescript
{ href: "/admin/categories", label: "Категории", match: "prefix" },
```

Пълният `items` масив за "Съдържание" трябва да изглежда така:

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
],
```

- [ ] **Стъпка 3: Commit**

```bash
git add "app/admin/(protected)/categories/page.tsx" lib/admin/adminNavConfig.ts
git commit -m "feat(admin): /admin/categories page with CRUD for festival categories"
```

---

## Task 7: Обнови `publicCategoryShared.ts` и `publicCategories.server.ts`

**Files:**
- Modify: `lib/festivals/publicCategoryShared.ts`
- Modify: `lib/festivals/publicCategories.ts`
- Modify: `lib/festivals/publicCategories.server.ts`

- [ ] **Стъпка 1: Изтрий hardcoded constants от `publicCategoryShared.ts`**

Замени целия файл с:

```typescript
/** Canonical slug → Bulgarian display label. Used as fallback when DB is unavailable. */
export const FESTIVAL_CATEGORY_LABELS: Record<string, string> = {
  "фолклорен фестивал": "Фолклорен фестивал",
  "събор":              "Събор",
  "кулинарен фестивал": "Кулинарен фестивал",
  "музикален фестивал": "Музикален фестивал",
  "танцов фестивал":    "Танцов фестивал",
  "културен фестивал":  "Културен фестивал",
  "арт фестивал":       "Арт фестивал",
};

export function labelForPublicCategory(slug: string): string {
  const key = slug.trim().toLocaleLowerCase("bg-BG");
  return FESTIVAL_CATEGORY_LABELS[key] ?? slug;
}

export function sortPublicFestivalCategorySlugs(slugs: Iterable<string>): string[] {
  return Array.from(slugs).sort((a, b) => a.localeCompare(b, "bg"));
}

export function sortPublicFestivalCategorySlugsByActiveCount(
  slugs: string[],
  counts: ReadonlyMap<string, number>
): string[] {
  return [...slugs].sort((a, b) => {
    const ca = counts.get(a) ?? 0;
    const cb = counts.get(b) ?? 0;
    const aZero = ca === 0 ? 1 : 0;
    const bZero = cb === 0 ? 1 : 0;
    if (aZero !== bZero) return aZero - bZero;
    if (ca !== cb) return cb - ca;
    return a.localeCompare(b, "bg");
  });
}
```

- [ ] **Стъпка 2: Обнови re-exports в `publicCategories.ts`**

Замени целия файл с:

```typescript
export {
  FESTIVAL_CATEGORY_LABELS,
  labelForPublicCategory,
  sortPublicFestivalCategorySlugs,
  sortPublicFestivalCategorySlugsByActiveCount,
} from "./publicCategoryShared";
```

- [ ] **Стъпка 3: Обнови `listPublicFestivalCategorySlugs()` в `publicCategories.server.ts`**

Намери функцията `listPublicFestivalCategorySlugs()` (ред ~80) и замени целия й body, така че да чете от `festival_categories` вместо от `festivals.category`:

```typescript
/**
 * Active category slugs from the festival_categories table, ordered by sort_order.
 * Falls back to distinct festivals.category values if the table is unavailable.
 */
export async function listPublicFestivalCategorySlugs(): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("festival_categories")
    .select("slug")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("slug", { ascending: true });

  if (error) {
    console.error("[listPublicFestivalCategorySlugs]", error.message);
    return [];
  }
  return (data ?? []).map((r) => r.slug as string);
}
```

И обнови `listPublicFestivalCategorySlugsSortedByActiveCount()` да ползва новата функция (тя вече сортира по sort_order, не по count — remove the count sorting logic):

```typescript
/**
 * Active category slugs ordered by sort_order from festival_categories table.
 * The minCount parameter is ignored — visibility is controlled via is_active.
 */
export async function listPublicFestivalCategorySlugsSortedByActiveCount(_minCount = 3): Promise<string[]> {
  return listPublicFestivalCategorySlugs();
}
```

- [ ] **Стъпка 4: Commit**

```bash
git add lib/festivals/publicCategoryShared.ts lib/festivals/publicCategories.ts lib/festivals/publicCategories.server.ts
git commit -m "refactor(categories): public category functions read from festival_categories table"
```

---

## Task 8: Обнови `normalizeCategory()` в `mappers.ts`

**Files:**
- Modify: `lib/festival/mappers.ts`

- [ ] **Стъпка 1: Изтрий import и върни простата версия**

Намери import-а на `mapToCanonicalCategory` (ред 6) и го изтрий:
```typescript
import { mapToCanonicalCategory } from "@/lib/festivals/publicCategoryShared";
```

Намери `normalizeCategory()` и я замени:

```typescript
/**
 * Normalizes a festival category string: trim + lowercase.
 * The select UI enforces valid values; this function only sanitizes input.
 */
export function normalizeCategory(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLocaleLowerCase("bg-BG");
  return trimmed || null;
}
```

- [ ] **Стъпка 2: Commit**

```bash
git add lib/festival/mappers.ts
git commit -m "refactor(categories): normalizeCategory is trim+lowercase only (no hardcoded map)"
```

---

## Task 9: Обнови admin форми

**Files:**
- Modify: `app/admin/(protected)/festivals/[id]/page.tsx`
- Modify: `components/admin/FestivalEditForm.tsx`
- Modify: `app/admin/(protected)/pending-festivals/[id]/page.tsx`
- Modify: `components/admin/PendingFestivalEditForm.tsx`

- [ ] **Стъпка 1: Обнови `FestivalEditForm.tsx` — добави `categories` prop**

В началото на файла добави import:
```typescript
import type { FestivalCategory } from "@/lib/festivals/categories.server";
```

Намери дефиницията на props типа за компонента (търси `type FestivalEditFormProps` или параметрите на default export функцията). Добави `categories: FestivalCategory[]` към props-а.

Намери select-а за category (реда с `CANONICAL_FESTIVAL_CATEGORIES.map`) и го замени:
```tsx
<select value={form.category} onChange={(e) => updateField("category", e.target.value)} className={ADMIN_ENTITY_CONTROL_CLASS}>
  <option value="">— без категория —</option>
  {categories.map((cat) => (
    <option key={cat.slug} value={cat.slug}>
      {cat.label_bg}
    </option>
  ))}
</select>
```

Изтрий import-а на `CANONICAL_FESTIVAL_CATEGORIES`.

- [ ] **Стъпка 2: Обнови `app/admin/(protected)/festivals/[id]/page.tsx`**

Добави import:
```typescript
import { listAllFestivalCategories } from "@/lib/festivals/categories.server";
```

В `AdminFestivalEditPage` добави fetch на категориите заедно с другите данни:
```typescript
const [festivalResult, organizersResult, categories] = await Promise.all([
  ctx.supabase.from("festivals").select("*,cities:cities!festivals_city_id_fkey(id,name_bg,slug)").eq("id", id).maybeSingle(),
  adminClient.schema("public").from("organizers").select("id,name,slug,description,logo_url,website_url,facebook_url,instagram_url,created_at,plan,plan_started_at,plan_expires_at", { count: "exact" }).order("name", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false, nullsFirst: false }),
  listAllFestivalCategories(),
]);
```

Адаптирай деструктурирането и подай `categories` на `<FestivalEditForm categories={categories} ... />`.

- [ ] **Стъпка 3: Обнови `PendingFestivalEditForm.tsx` — добави `categories` prop**

Същия pattern като FestivalEditForm:
- Добави `import type { FestivalCategory } from "@/lib/festivals/categories.server";`
- Добави `categories: FestivalCategory[]` към props-а
- Замени select-а да ползва `categories.map((cat) => <option key={cat.slug} value={cat.slug}>{cat.label_bg}</option>)`
- Изтрий `CANONICAL_FESTIVAL_CATEGORIES` import

- [ ] **Стъпка 4: Обнови `app/admin/(protected)/pending-festivals/[id]/page.tsx`**

Добави import:
```typescript
import { listAllFestivalCategories } from "@/lib/festivals/categories.server";
```

Добави fetch в Page компонента:
```typescript
const categories = await listAllFestivalCategories();
```

Подай `categories={categories}` на `<PendingFestivalEditForm ... />`.

- [ ] **Стъпка 5: Commit**

```bash
git add "app/admin/(protected)/festivals/[id]/page.tsx" \
        components/admin/FestivalEditForm.tsx \
        "app/admin/(protected)/pending-festivals/[id]/page.tsx" \
        components/admin/PendingFestivalEditForm.tsx
git commit -m "feat(admin): festival forms load categories from DB"
```

---

## Task 10: Обнови органайзер форма

**Files:**
- Modify: `app/organizer/(workspace)/festivals/new/page.tsx`
- Modify: `app/organizer/(workspace)/festivals/new/NewFestivalSubmissionClient.tsx`

- [ ] **Стъпка 1: Обнови `page.tsx`**

Добави import:
```typescript
import { listActiveFestivalCategories, type FestivalCategory } from "@/lib/festivals/categories.server";
```

В `NewFestivalSubmissionPage` добави fetch:
```typescript
const categories = await listActiveFestivalCategories();
```

Подай `categories={categories}` на `<NewFestivalSubmissionClient ... />`.

- [ ] **Стъпка 2: Обнови `NewFestivalSubmissionClient.tsx`**

Добави import:
```typescript
import type { FestivalCategory } from "@/lib/festivals/categories.server";
```

Добави `categories: FestivalCategory[]` prop към `NewFestivalSubmissionInner` и default export.

Замени select options:
```tsx
<select
  id="wizard-field-category"
  value={formData.category}
  onChange={(ev) => patchForm("category", ev.target.value)}
  className={FIELD_CLASS}
>
  <option value="">— избери категория —</option>
  {categories.map((cat) => (
    <option key={cat.slug} value={cat.slug}>
      {cat.label_bg}
    </option>
  ))}
</select>
```

Изтрий `CANONICAL_FESTIVAL_CATEGORIES` import.

- [ ] **Стъпка 3: Commit**

```bash
git add "app/organizer/(workspace)/festivals/new/page.tsx" \
        "app/organizer/(workspace)/festivals/new/NewFestivalSubmissionClient.tsx"
git commit -m "feat(organizer): category select loads from DB via categories prop"
```

---

## Task 11: Обнови Gemini AI prompt динамично

**Files:**
- Modify: `lib/admin/research/gemini-extract.ts`
- Modify: `lib/admin/research/research-pipeline.ts`
- Modify: `lib/admin/research/smart-pipeline.ts`

- [ ] **Стъпка 1: Обнови `extractFestivalFieldsFromEvidence()` в `gemini-extract.ts`**

Добави `categories?: string[]` параметър към input типа:

```typescript
export async function extractFestivalFieldsFromEvidence(input: {
  userQuery: string;
  sourceUrl: string;
  pageTitle: string;
  excerpt: string;
  onModelUsed?: (modelId: string) => void;
  categories?: string[];  // ← добави
}): Promise<GeminiRawExtraction> {
```

Намери секцията `КАТЕГОРИЯ (category):` в prompt-а и я замени с динамична версия. Намери `const buildPrompt = ...` или директното template string и обнови:

```typescript
const categoryList = (input.categories && input.categories.length > 0)
  ? input.categories
  : ["фолклорен фестивал","събор","кулинарен фестивал","музикален фестивал","танцов фестивал","културен фестивал","арт фестивал"];

const categoryPromptSection = `КАТЕГОРИЯ (category):
- Задължително избирай ТОЧНО една от следните стойности (lowercase):
${categoryList.map(c => `  "${c}"`).join('\n')}
- Ако събитието съчетава два типа, избери доминиращия.
- Ако типът не е ясен от текста → null.`;
```

Замени хардкодния КАТЕГОРИЯ блок в prompt-а с `${categoryPromptSection}`.

- [ ] **Стъпка 2: Обнови `research-pipeline.ts`**

Добави import:
```typescript
import { listActiveFestivalCategories } from "@/lib/festivals/categories.server";
```

Намери извикването на `extractFestivalFieldsFromEvidence({...})` (ред ~404) и добави `categories` параметъра. Категориите трябва да се зареждат веднъж преди loop-а:

```typescript
const activeCategories = await listActiveFestivalCategories();
const categorySlugs = activeCategories.map(c => c.slug);

// ... в loop-а:
const ex = await extractFestivalFieldsFromEvidence({
  userQuery: query,
  sourceUrl: hit.url,
  pageTitle: doc.title || hit.title,
  excerpt: doc.excerpt,
  categories: categorySlugs,
});
```

- [ ] **Стъпка 3: Обнови `smart-pipeline.ts`**

Добави import и добави `categories` параметъра при извикването на `extractFestivalFieldsFromEvidence` (ред ~311):

```typescript
import { listActiveFestivalCategories } from "@/lib/festivals/categories.server";

// Преди извикването:
const activeCategories = await listActiveFestivalCategories();
const categorySlugs = activeCategories.map(c => c.slug);

// При извикването:
extraction = await extractFestivalFieldsFromEvidence({
  userQuery: query,
  sourceUrl: "combined-smart-research",
  pageTitle: query,
  excerpt: combinedEvidence,
  onModelUsed: (m) => { geminiModelUsed = m; },
  categories: categorySlugs,
});
```

- [ ] **Стъпка 4: Commit**

```bash
git add lib/admin/research/gemini-extract.ts \
        lib/admin/research/research-pipeline.ts \
        lib/admin/research/smart-pipeline.ts
git commit -m "feat(categories): Gemini prompt uses dynamic categories from DB"
```

---

## Task 12: TypeScript проверка + PR

- [ ] **Стъпка 1: TypeScript build**

```bash
cd C:\Project\festivo-web && npx tsc --noEmit 2>&1
```

Очакван резултат: 0 грешки. При грешки — фиксирай и commit.

- [ ] **Стъпка 2: Верифицирай admin страницата**

Провери `http://localhost:3000/admin/categories` — трябва да се вижда таблицата с 7 категории и форма за добавяне.

- [ ] **Стъпка 3: Push и PR**

```bash
git push -u origin feat/festival-categories-db
gh pr create \
  --title "feat(categories): manage festival categories from admin panel (DB-driven)" \
  --body "$(cat <<'EOF'
## Proposed Change
- Нова \`festival_categories\` таблица с RLS — source of truth за категориите
- Admin CRUD страница \`/admin/categories\`: добавяне, преименуване, активиране/деактивиране
- Всички форми (admin + organizer) зареждат категориите от DB
- Gemini AI prompt генерира категориите динамично от таблицата
- Hardcoded \`CANONICAL_FESTIVAL_CATEGORIES\` константа е премахната

## Checklist
- [x] Schema: migration в scripts/sql/ с RLS и seed
- [x] API contract: backward-compatible (category остава text колона в festivals)
- [x] Security: admin API използва getAdminContext(); публичен SELECT само за is_active=true
- [x] Docs: не е нужно (UI-only промяна без нова архитектура)
EOF
)"
gh pr merge --merge --delete-branch
```
