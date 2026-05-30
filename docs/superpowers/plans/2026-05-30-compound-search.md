# Compound Search Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace scattered search/city/date controls with one unified compound search bar that keeps all filters in sync via URL params.

**Architecture:** Single `FestivalsCompoundSearch` client component holds local state for text + city + date, submits all at once as URL params to `/festivals`. Both homepage and `/festivals` page use this component — homepage navigates fresh, festivals page updates in place. Active filters shown as removable chips below the bar.

**Tech Stack:** Next.js 14 App Router, React client component, `useRouter` + `useSearchParams`, `createPortal` for dropdowns, Tailwind CSS.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| **Create** | `components/festivals/FestivalsCompoundSearch.tsx` | Unified search bar: text + city + date, one submit |
| **Modify** | `components/home/RealHomePage.tsx` | Replace old search with compound bar |
| **Modify** | `components/festivals/FestivalsListingDiscovery.tsx` | Replace old search with compound bar |
| **Modify** | `app/festivals/page.tsx` | Pass `initialFrom`, `initialTo`, `initialCity` to discovery |
| **Delete** | `components/home/DateQuickSelectClient.tsx` | Replaced by compound bar |
| Keep | `components/home/CitySelectClient.tsx` | Still used on `/cities/*` pages |
| Keep | `components/home/HomeDiscoverySearchClient.tsx` | Still used in mobile dock if needed |

---

## Task 1: Create `FestivalsCompoundSearch` component

**Files:**
- Create: `components/festivals/FestivalsCompoundSearch.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useState, useRef, useLayoutEffect, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { festivalDiscoveryCalendarBounds } from "@/lib/home/festivalDiscoveryBounds";

type CityOption = { name: string; slug: string | null; filterValue: string };
type MenuPos = { top: number; left: number; width: number };

function calcMenuPos(btn: HTMLButtonElement, menuHeight: number): MenuPos {
  const rect = btn.getBoundingClientRect();
  const maxW = Math.min(window.innerWidth * 0.92, 22 * 16);
  const width = Math.max(rect.width, maxW);
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
  const spaceBelow = window.innerHeight - rect.bottom;
  const openUpward = spaceBelow < menuHeight + 16;
  return {
    top: openUpward ? Math.max(8, rect.top - menuHeight - 4) : rect.bottom + 4,
    left,
    width,
  };
}

export interface FestivalsCompoundSearchProps {
  cities: CityOption[];
  initialQuery?: string;
  initialCity?: string;
  initialFrom?: string;
  initialTo?: string;
}

export default function FestivalsCompoundSearch({
  cities,
  initialQuery = "",
  initialCity = "",
  initialFrom = "",
  initialTo = "",
}: FestivalsCompoundSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [city, setCity] = useState(initialCity);
  const [dateFrom, setDateFrom] = useState(initialFrom);
  const [dateTo, setDateTo] = useState(initialTo);
  const [cityOpen, setCityOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [cityMenuPos, setCityMenuPos] = useState<MenuPos | null>(null);
  const [dateMenuPos, setDateMenuPos] = useState<MenuPos | null>(null);

  const cityBtnRef = useRef<HTMLButtonElement>(null);
  const dateBtnRef = useRef<HTMLButtonElement>(null);
  const cityMenuRef = useRef<HTMLDivElement>(null);
  const dateMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!cityOpen) { setCityMenuPos(null); return; }
    const btn = cityBtnRef.current;
    if (!btn) return;
    const sync = () => setCityMenuPos(calcMenuPos(btn, Math.min(window.innerHeight * 0.6, 384)));
    sync();
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => { window.removeEventListener("scroll", sync, true); window.removeEventListener("resize", sync); };
  }, [cityOpen]);

  useLayoutEffect(() => {
    if (!dateOpen) { setDateMenuPos(null); return; }
    const btn = dateBtnRef.current;
    if (!btn) return;
    const sync = () => setDateMenuPos(calcMenuPos(btn, 280));
    sync();
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => { window.removeEventListener("scroll", sync, true); window.removeEventListener("resize", sync); };
  }, [dateOpen]);

  useEffect(() => {
    if (!cityOpen && !dateOpen) return;
    const handler = (e: PointerEvent) => {
      const t = e.target as Node;
      if (cityOpen && !cityBtnRef.current?.contains(t) && !cityMenuRef.current?.contains(t)) setCityOpen(false);
      if (dateOpen && !dateBtnRef.current?.contains(t) && !dateMenuRef.current?.contains(t)) setDateOpen(false);
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === "Escape") { setCityOpen(false); setDateOpen(false); } };
    document.addEventListener("pointerdown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => { document.removeEventListener("pointerdown", handler); document.removeEventListener("keydown", keyHandler); };
  }, [cityOpen, dateOpen]);

  const { weekendStart, weekendEnd, monthStart, monthEnd } = festivalDiscoveryCalendarBounds();
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();
  const endOfWeek = (() => { const d = new Date(); const day = d.getDay(); const diff = day === 0 ? 0 : 7 - day; d.setDate(d.getDate() + diff); return d.toISOString().slice(0, 10); })();

  const datePresets = [
    { label: "Днес", from: today, to: today },
    { label: "Утре", from: tomorrow, to: tomorrow },
    { label: "Този уикенд", from: weekendStart, to: weekendEnd },
    { label: "Тази седмица", from: today, to: endOfWeek },
    { label: "Този месец", from: monthStart, to: monthEnd },
  ];

  const selectedDateLabel = datePresets.find(p => p.from === dateFrom && p.to === dateTo)?.label
    ?? (dateFrom ? dateFrom : null);
  const selectedCityLabel = city
    ? (cities.find(c => c.filterValue === city || c.slug === city)?.name ?? city)
    : null;

  const handleSubmit = () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (city) params.set("city", city);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    router.push(`/festivals${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const clearCity = () => setCity("");
  const clearDate = () => { setDateFrom(""); setDateTo(""); };

  const activeFilters = [
    ...(selectedCityLabel ? [{ label: selectedCityLabel, onRemove: clearCity }] : []),
    ...(selectedDateLabel ? [{ label: selectedDateLabel, onRemove: clearDate }] : []),
  ];

  const xIcon = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12"/>
    </svg>
  );
  const chevron = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-black/35" aria-hidden>
      <path d="M6 9l6 6 6-6"/>
    </svg>
  );

  const cityMenu = mounted && cityOpen && cityMenuPos ? createPortal(
    <div
      ref={cityMenuRef}
      role="menu"
      style={{ position: "fixed", top: cityMenuPos.top, left: cityMenuPos.left, width: cityMenuPos.width, zIndex: 200 }}
      className="max-h-[min(60vh,24rem)] overflow-y-auto rounded-2xl border border-black/[0.09] bg-white p-2 shadow-[0_8px_20px_rgba(12,14,20,0.14)]"
    >
      <button type="button" role="menuitem" onClick={() => { setCity(""); setCityOpen(false); }}
        className="block w-full rounded-xl px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.12em] text-black/40 transition hover:bg-[#f7f6f3]">
        Всички градове
      </button>
      {cities.map(c => (
        <button key={c.filterValue} type="button" role="menuitem"
          onClick={() => { setCity(c.filterValue); setCityOpen(false); }}
          className={cn(
            "block w-full rounded-xl px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.12em] transition hover:bg-[#f7f6f3]",
            city === c.filterValue ? "bg-[#7c2d12]/10 text-[#7c2d12]" : "text-[#0c0e14]"
          )}>
          {c.name}
        </button>
      ))}
    </div>,
    document.body
  ) : null;

  const dateMenu = mounted && dateOpen && dateMenuPos ? createPortal(
    <div
      ref={dateMenuRef}
      role="menu"
      style={{ position: "fixed", top: dateMenuPos.top, left: dateMenuPos.left, width: Math.max(dateMenuPos.width, 190), zIndex: 200 }}
      className="overflow-hidden rounded-2xl border border-black/[0.09] bg-white p-2 shadow-[0_8px_20px_rgba(12,14,20,0.14)]"
    >
      <button type="button" role="menuitem" onClick={() => { clearDate(); setDateOpen(false); }}
        className="block w-full rounded-xl px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.12em] text-black/40 transition hover:bg-[#f7f6f3]">
        Всякога
      </button>
      {datePresets.map(p => (
        <button key={p.label} type="button" role="menuitem"
          onClick={() => { setDateFrom(p.from); setDateTo(p.to); setDateOpen(false); }}
          className={cn(
            "block w-full rounded-xl px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.12em] transition hover:bg-[#f7f6f3]",
            dateFrom === p.from && dateTo === p.to ? "bg-[#7c2d12]/10 text-[#7c2d12]" : "text-[#0c0e14]"
          )}>
          {p.label}
        </button>
      ))}
    </div>,
    document.body
  ) : null;

  return (
    <div className="space-y-2.5">
      <form
        onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
        className="flex flex-col gap-0 overflow-hidden rounded-2xl border border-black/[0.1] bg-white shadow-sm md:flex-row md:items-stretch"
      >
        {/* Text */}
        <div className="flex flex-1 items-center gap-2.5 border-b border-black/[0.07] px-4 py-3 md:border-b-0 md:border-r">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className="shrink-0 text-black/30" aria-hidden>
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
          </svg>
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Фестивал, ключума, събитие..."
            aria-label="Търси фестивал"
            className="min-w-0 flex-1 bg-transparent text-sm text-[#0c0e14] outline-none placeholder:text-black/30"
          />
          {query ? (
            <button type="button" onClick={() => setQuery("")} className="shrink-0 text-black/25 hover:text-black/55" aria-label="Изчисти текст">
              {xIcon}
            </button>
          ) : null}
        </div>

        {/* City */}
        <div className="flex items-center gap-2.5 border-b border-black/[0.07] px-4 py-3 md:border-b-0 md:border-r md:min-w-[9.5rem]">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className="shrink-0 text-black/30" aria-hidden>
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          <button
            ref={cityBtnRef}
            type="button"
            onClick={() => { setCityOpen(v => !v); setDateOpen(false); }}
            aria-expanded={cityOpen}
            aria-haspopup="menu"
            className={cn("flex-1 text-left text-sm font-medium outline-none",
              selectedCityLabel ? "text-[#0c0e14]" : "text-black/30")}
          >
            {selectedCityLabel ?? "Град"}
          </button>
          {selectedCityLabel
            ? <button type="button" onClick={clearCity} className="shrink-0 text-black/25 hover:text-black/55" aria-label="Изчисти град">{xIcon}</button>
            : chevron}
        </div>

        {/* Date */}
        <div className="flex items-center gap-2.5 border-b border-black/[0.07] px-4 py-3 md:border-b-0 md:min-w-[9rem]">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className="shrink-0 text-black/30" aria-hidden>
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <button
            ref={dateBtnRef}
            type="button"
            onClick={() => { setDateOpen(v => !v); setCityOpen(false); }}
            aria-expanded={dateOpen}
            aria-haspopup="menu"
            className={cn("flex-1 text-left text-sm font-medium outline-none",
              selectedDateLabel ? "text-[#0c0e14]" : "text-black/30")}
          >
            {selectedDateLabel ?? "Дата"}
          </button>
          {selectedDateLabel
            ? <button type="button" onClick={clearDate} className="shrink-0 text-black/25 hover:text-black/55" aria-label="Изчисти дата">{xIcon}</button>
            : chevron}
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="mx-3 mb-3 rounded-xl bg-[#7c2d12] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6b2510] active:scale-[0.98] md:mx-1.5 md:my-1.5 md:rounded-xl"
        >
          Търси
        </button>
      </form>

      {/* Active filter chips */}
      {activeFilters.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters.map(f => (
            <button
              key={f.label}
              type="button"
              onClick={f.onRemove}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#7c2d12]/25 bg-[#7c2d12]/[0.07] px-3 py-1 text-xs font-semibold text-[#7c2d12] transition hover:bg-[#7c2d12]/[0.14]"
            >
              {f.label}
              {xIcon}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { clearCity(); clearDate(); setQuery(""); router.push("/festivals"); }}
            className="text-xs text-black/35 transition hover:text-black/60 hover:underline"
          >
            Изчисти всички
          </button>
        </div>
      ) : null}

      {cityMenu}
      {dateMenu}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -10
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/festivals/FestivalsCompoundSearch.tsx
git commit -m "feat(search): add FestivalsCompoundSearch — unified text+city+date bar"
```

---

## Task 2: Update `FestivalsListingDiscovery` to use compound search

**Files:**
- Modify: `components/festivals/FestivalsListingDiscovery.tsx`

- [ ] **Step 1: Replace content**

```tsx
"use client";

import FestivalsCompoundSearch from "@/components/festivals/FestivalsCompoundSearch";
import QuickChipsClient from "@/components/home/QuickChipsClient";
import { pub } from "@/lib/public-ui/styles";
import { cn } from "@/lib/utils";

type CityRow = { name: string; slug: string | null; filterValue: string };

export default function FestivalsListingDiscovery({
  chips,
  cityOptions,
  initialQuery,
  initialCity,
  initialFrom,
  initialTo,
}: {
  chips: Array<{ label: string; href: string }>;
  cityOptions: CityRow[];
  initialQuery: string;
  initialCity?: string;
  initialFrom?: string;
  initialTo?: string;
}) {
  return (
    <div className={cn(pub.panelHero, "relative overflow-hidden p-4 md:p-5")}>
      <div className="relative z-[1] space-y-3">
        <FestivalsCompoundSearch
          cities={cityOptions}
          initialQuery={initialQuery}
          initialCity={initialCity}
          initialFrom={initialFrom}
          initialTo={initialTo}
        />
        <div>
          <hr className="border-amber-900/20 my-1" />
          <QuickChipsClient chips={chips} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -10
```

Expected: may show error about missing `initialCity` etc. in caller — fix in next task.

- [ ] **Step 3: Commit**

```bash
git add components/festivals/FestivalsListingDiscovery.tsx
git commit -m "feat(search): FestivalsListingDiscovery uses compound search bar"
```

---

## Task 3: Pass initial filter values from `/festivals` page

**Files:**
- Modify: `app/festivals/page.tsx` (the `FestivalsListingDiscovery` render call)

- [ ] **Step 1: Find the render call and add props**

Search for `FestivalsListingDiscovery` in `app/festivals/page.tsx`. It currently receives `initialQuery`. Add `initialCity`, `initialFrom`, `initialTo` from the parsed filters:

```tsx
// In FestivalsPage, after parsing filters:
const cityParam = filters.city?.trim() ?? "";
const fromParam = filters.from?.trim() ?? "";
const toParam = filters.to?.trim() ?? "";
```

Then in the JSX, find where `FestivalsListingDiscovery` is rendered and add:
```tsx
<FestivalsListingDiscovery
  chips={chips}
  cityOptions={cityOptions}
  initialQuery={q}
  initialCity={cityParam}
  initialFrom={fromParam}
  initialTo={toParam}
/>
```

- [ ] **Step 2: Check what props `Filters` type has**

```bash
grep -n "city\|from\|to" lib/types.ts | head -20
```

Use `filters.city` for city, `filters.from` for from-date, `filters.to` for to-date.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -10
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add app/festivals/page.tsx
git commit -m "feat(search): pass initial city+date to compound search on /festivals"
```

---

## Task 4: Update homepage to use compound search

**Files:**
- Modify: `components/home/RealHomePage.tsx`

The homepage already has the compound search bar call in `hidden md:block` (from previous work). Replace the desktop search entirely with `FestivalsCompoundSearch`:

- [ ] **Step 1: Update imports**

Add to imports:
```tsx
import FestivalsCompoundSearch from "@/components/festivals/FestivalsCompoundSearch";
```

Remove (no longer needed on homepage):
```tsx
import HomeDiscoverySearchClient from "./HomeDiscoverySearchClient";
// (keep the import only if used by mobile dock below)
```

- [ ] **Step 2: Replace the desktop search block**

Find this block:
```tsx
{/* На desktop — пълното търсене */}
<div className="mt-4 hidden md:block">
  <HomeDiscoverySearchClient secondaryActions={secondaryDiscoveryActions} />
</div>

<div className="mt-3 hidden md:block">
  <hr className="border-amber-900/20 my-1" />
  <QuickChipsClient chips={chips} />
</div>
```

Replace with:
```tsx
{/* На desktop — compound search */}
<div className="mt-4 hidden md:block space-y-3">
  <FestivalsCompoundSearch
    cities={homeCityOptions.map(c => ({
      name: c.name,
      slug: c.slug,
      filterValue: c.filterValue,
    }))}
  />
  <div>
    <hr className="border-amber-900/20 my-1" />
    <QuickChipsClient chips={chips} />
  </div>
</div>
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -10
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add components/home/RealHomePage.tsx
git commit -m "feat(search): homepage desktop uses FestivalsCompoundSearch"
```

---

## Task 5: Update mobile bottom dock to use compound search

The mobile dock (fixed bottom bar) currently uses `HomeDiscoverySearchClient` with separate city/date buttons. Replace it with `FestivalsCompoundSearch`.

**Files:**
- Modify: `components/home/RealHomePage.tsx` (bottom dock section)

- [ ] **Step 1: Find the mobile dock**

In `RealHomePage.tsx`, find:
```tsx
<div className="fixed inset-x-0 bottom-0 z-30 ... md:hidden">
  <HomeDiscoverySearchClient compact secondaryActions={secondaryDiscoveryActions} />
</div>
```

- [ ] **Step 2: Replace with compact compound search**

```tsx
<div className="fixed inset-x-0 bottom-0 z-30 border-t border-amber-200/35 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(12,14,20,0.1)] backdrop-blur md:hidden">
  <FestivalsCompoundSearch
    cities={homeCityOptions.map(c => ({
      name: c.name,
      slug: c.slug,
      filterValue: c.filterValue,
    }))}
  />
</div>
```

- [ ] **Step 3: Remove unused imports** if `HomeDiscoverySearchClient` and `secondaryDiscoveryActions` are no longer used:

```tsx
// Remove if no longer referenced:
// import HomeDiscoverySearchClient from "./HomeDiscoverySearchClient";
// import CitySelectClient from "./CitySelectClient";
// import DateQuickSelectClient from "./DateQuickSelectClient";
// const secondaryDiscoveryActions = ...
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 5: Commit**

```bash
git add components/home/RealHomePage.tsx
git commit -m "feat(search): mobile dock uses FestivalsCompoundSearch"
```

---

## Task 6: Cleanup — delete `DateQuickSelectClient`

**Files:**
- Delete: `components/home/DateQuickSelectClient.tsx`

- [ ] **Step 1: Verify no remaining imports**

```bash
grep -r "DateQuickSelectClient" . --include="*.tsx" --include="*.ts"
```

Expected: no results (after Task 5 removed all usages)

- [ ] **Step 2: Delete file**

```bash
rm components/home/DateQuickSelectClient.tsx
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(search): remove DateQuickSelectClient replaced by compound search"
```

---

## Task 7: Final push

- [ ] **Step 1: Run full build**

```bash
npx next build 2>&1 | grep -E "error|Error|warn" | grep -v "node_modules" | head -20
```

Expected: no errors

- [ ] **Step 2: Push**

```bash
git push origin main
```

---

## Self-Review Checklist

- [x] Text search preserves city + date when submitting ✅ (all in same form state)
- [x] City selection preserves text + date ✅ (same form state)
- [x] Date selection preserves text + city ✅ (same form state)
- [x] Active filters shown as removable chips ✅ (Task 1)
- [x] Mobile bottom dock uses compound search ✅ (Task 5)
- [x] Desktop homepage uses compound search ✅ (Task 4)
- [x] `/festivals` page initializes from URL params ✅ (Task 3)
- [x] City dropdown opens upward when near bottom ✅ (calcMenuPos in Task 1)
- [x] No redirect to /calendar for date selection ✅ (date is inline dropdown)
- [x] Old `DateQuickSelectClient` removed ✅ (Task 6)
