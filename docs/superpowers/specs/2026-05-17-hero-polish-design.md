# Hero Section Polish — Implementation Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three visual issues in the homepage hero section to make it look more professional.

**Scope:** UI-only changes. No new routes, no API changes, no schema changes.

**Affected files:**
- `components/home/RealHomePage.tsx`
- `components/home/QuickChipsClient.tsx`

---

## Change 1 — Festival count badge

**Current:** Plain paragraph with low-opacity amber text — looks like placeholder copy.
```tsx
<p className="mt-1.5 text-xs text-amber-900/50 md:text-sm">
  {publishedFestivalsBulgariaLabel(totalFestivalsCount)}
</p>
```

**New:** Inline pill badge with a leading dot. Renders as `● 65 фестивала в България`.

```tsx
<p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-900/[0.07] px-3 py-1 text-xs font-medium text-amber-900/70">
  <span className="h-1.5 w-1.5 rounded-full bg-amber-700/60" aria-hidden />
  {publishedFestivalsBulgariaLabel(totalFestivalsCount)}
</p>
```

Remove the separate "Събития от организатори..." paragraph — it adds visual noise and the badge communicates credibility sufficiently.

---

## Change 2 — Unify ИЗБЕРИ ГРАД / ИЗБЕРИ ДАТА button styles

**Current:** Both buttons in `secondaryDiscoveryActions` use manually-written inline Tailwind classes that differ from the QuickChipsClient chip style:
```tsx
className={cn(
  "rounded-2xl border border-amber-200/40 bg-white/92 px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] shadow-sm ring-1 ring-amber-100/30 transition hover:border-amber-300/55 hover:bg-white",
  pub.focusRing,
)}
```

**New:** Replace with `pub.chip` + `pub.focusRing` — identical to the quick-filter chips below.
```tsx
className={cn(pub.chip, pub.focusRing)}
```

This applies to both the CitySelectClient trigger button and the "Избери дата" Link. CitySelectClient renders its own trigger — pass the class as a prop if needed, or apply directly to the Link wrapper.

**Note:** `CitySelectClient` has hardcoded button classes on line 163 of `components/home/CitySelectClient.tsx`:
```tsx
className="rounded-2xl border border-amber-200/40 bg-white/92 px-4 py-3 ..."
```
Replace that className with the equivalent of `pub.chip` + `pub.focusRing` (import `pub` from `@/lib/public-ui/styles` and `cn` from `@/lib/utils`). Also remove the inline classes from the `secondaryDiscoveryActions` Link in `RealHomePage.tsx` and replace with `cn(pub.chip, pub.focusRing)`.

---

## Change 3 — "Още →" → "+ N" with hidden count

**Current:** `QuickChipsClient` shows a static "Още →" button with no count information.

**New:** Show the number of hidden category chips: `+ N` where N = `categoryChips.length - firstSliceCategoryChips.length` (minus any selectedExtraChip already shown).

```tsx
// Compute hidden count
const hiddenCount = categoryChips.length - firstSliceCategoryChips.length - (selectedExtraChip ? 1 : 0);
// In JSX:
<button ...>+ {hiddenCount}</button>
```

"По-малко ←" collapse button stays as-is (it's fine).

---

## Design decisions

- The yellow border frame (`panelHero`) is intentionally kept — it is consistent with other pages.
- The folk SVG pattern background is kept unchanged.
- The "Избери дата" button continues to link to `/calendar` — inline date picker is a separate future task.
- No new dependencies introduced.
- No tests required — these are pure styling changes with no logic side-effects, verified visually.
