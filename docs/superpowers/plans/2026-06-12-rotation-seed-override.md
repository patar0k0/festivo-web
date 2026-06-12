# Rotation Seed Override Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавяне на preview-only query параметър (`?rotday=YYYY-MM-DD` / `?rotseed=<число>`), който замества дневния ротационен seed на началната страница, за да може ротацията да се тества веднага.

**Architecture:** `app/page.tsx` (вече `force-dynamic`, вече чете preview cookie) parse-ва параметрите само при preview достъп и подава `seedOverride?: number` на `loadHomePageData`. При наличие на override `loadHomePageData` заобикаля `_loadDbDataCached` и смята uncached, така нормалният кешируем path остава буквално непроменен.

**Tech Stack:** Next.js 14 App Router · TypeScript. **Няма unit test runner в проекта** — верификацията е `tsc --noEmit` + `next lint` + две ръчни browser проверки.

**Spec:** `docs/superpowers/specs/2026-06-12-rotation-seed-override-design.md`

---

## File Structure

| Файл | Отговорност | Промяна |
|---|---|---|
| `lib/home/loadHomePageData.ts` | DB load + rail подредба | Нов `seedOverride?` param; условен loader (cached vs uncached); seed избор |
| `app/page.tsx` | Home route — gate + param parse | Parse `rotday`/`rotseed` зад preview gate; нов import; подаване на seedOverride |
| `lib/home/dailyRotation.ts` | Чисти ротационни функции | **Без промяна** (остава I/O-free) |

---

## Task 1: `loadHomePageData` приема `seedOverride` и заобикаля кеша при override

**Files:**
- Modify: `lib/home/loadHomePageData.ts:318` (сигнатура) и `:323-346` (dbData load блок) и `:372` (seed)

- [ ] **Step 1: Промени сигнатурата на `loadHomePageData`**

Текущо (`lib/home/loadHomePageData.ts:318`):

```ts
export async function loadHomePageData(citySlug: string | undefined): Promise<HomePageViewProps> {
```

Ново:

```ts
export async function loadHomePageData(
  citySlug: string | undefined,
  seedOverride?: number,
): Promise<HomePageViewProps> {
```

- [ ] **Step 2: Условен loader — override заобикаля `_loadDbDataCached`**

Текущо (`lib/home/loadHomePageData.ts:323-346`):

```ts
  let dbData: CachedDbData;
  try {
    dbData = await _loadDbDataCached(params);
  } catch (cachedErr) {
    // A query failed during a cache miss. `unstable_cache` does NOT persist a
    // rejected promise, so the empty result is never frozen for 5 minutes.
    // Retry once uncached so this visitor still sees real data, and the next
    // request re-attempts the cache cleanly.
    console.error("[loadHomePageData] cached load failed, retrying uncached:", cachedErr);
    try {
      dbData = await fetchHomeDbData(params);
    } catch (uncachedErr) {
      console.error("[loadHomePageData] uncached load also failed; serving empty (not cached):", uncachedErr);
      dbData = {
        nearestFestivalsRaw: [],
        currentFestivalsRaw: [],
        weekendFestivalsRaw: [],
        upcomingCategoryCounts: [],
        totalFestivalsCount: 0,
        citiesResult: [],
        categorySlugs: [],
      };
    }
  }
```

Ново — добави избор на loader непосредствено преди `let dbData`:

```ts
  // Preview seed override (?rotday / ?rotseed) НЕ трябва да докосва споделения
  // unstable_cache: ползваме `fetchHomeDbData` директно (uncached). Нормалните
  // заявки минават през `_loadDbDataCached` както досега — 100% непроменено.
  const loadDbData = seedOverride !== undefined ? fetchHomeDbData : _loadDbDataCached;

  let dbData: CachedDbData;
  try {
    dbData = await loadDbData(params);
  } catch (cachedErr) {
    // A query failed during a cache miss. `unstable_cache` does NOT persist a
    // rejected promise, so the empty result is never frozen for 5 minutes.
    // Retry once uncached so this visitor still sees real data, and the next
    // request re-attempts the cache cleanly.
    console.error("[loadHomePageData] cached load failed, retrying uncached:", cachedErr);
    try {
      dbData = await fetchHomeDbData(params);
    } catch (uncachedErr) {
      console.error("[loadHomePageData] uncached load also failed; serving empty (not cached):", uncachedErr);
      dbData = {
        nearestFestivalsRaw: [],
        currentFestivalsRaw: [],
        weekendFestivalsRaw: [],
        upcomingCategoryCounts: [],
        totalFestivalsCount: 0,
        citiesResult: [],
        categorySlugs: [],
      };
    }
  }
```

- [ ] **Step 3: Използвай override seed-а при ротацията**

Текущо (`lib/home/loadHomePageData.ts:372`):

```ts
  const rotationSeed = dailyRotationSeed(today);
```

Ново:

```ts
  const rotationSeed = seedOverride ?? dailyRotationSeed(today);
```

- [ ] **Step 4: Verify — типове компилират**

Run: `npx tsc --noEmit`
Expected: PASS (no errors). `loadHomePageData` с един аргумент остава валидно (вторият е optional).

- [ ] **Step 5: Commit**

```bash
git add lib/home/loadHomePageData.ts
git commit -m "feat(home): accept optional rotation seedOverride, bypass cache for preview"
```

---

## Task 2: `app/page.tsx` parse-ва preview параметрите и ги подава

**Files:**
- Modify: `app/page.tsx:5` (import) и `app/page.tsx:51-57` (parse + извикване)

- [ ] **Step 1: Добави import на `dailyRotationSeed`**

Текущо (`app/page.tsx:5`):

```ts
import { firstHomeSearchParam, loadHomePageData } from "@/lib/home/loadHomePageData";
```

Добави нов ред под него:

```ts
import { dailyRotationSeed } from "@/lib/home/dailyRotation";
```

- [ ] **Step 2: Parse параметрите зад preview gate и подай seedOverride**

Текущо (`app/page.tsx:51-57`):

```ts
  const city = firstHomeSearchParam(searchParams.city)?.trim();

  if (comingSoonMode && !hasPreviewAccess) {
    return <ComingSoonPublic />;
  }

  const props = await loadHomePageData(city);
```

Ново:

```ts
  const city = firstHomeSearchParam(searchParams.city)?.trim();

  if (comingSoonMode && !hasPreviewAccess) {
    return <ComingSoonPublic />;
  }

  // Preview-only ротационен seed override. Само при наличие на festivo_preview
  // cookie — иначе параметрите изобщо не се четат, нормалното кешируемо
  // поведение остава непроменено. `?rotday=YYYY-MM-DD` има предимство пред
  // `?rotseed=<число>`; невалидни стойности се игнорират.
  let seedOverride: number | undefined;
  if (hasPreviewAccess) {
    const rawRotday = firstHomeSearchParam(searchParams.rotday)?.trim();
    const rawRotseed = firstHomeSearchParam(searchParams.rotseed)?.trim();
    if (rawRotday && /^\d{4}-\d{2}-\d{2}$/.test(rawRotday)) {
      seedOverride = dailyRotationSeed(rawRotday);
    } else if (rawRotseed) {
      const parsed = Number.parseInt(rawRotseed, 10);
      if (Number.isFinite(parsed)) seedOverride = parsed >>> 0;
    }
  }

  const props = await loadHomePageData(city, seedOverride);
```

- [ ] **Step 3: Verify — типове + lint**

Run: `npx tsc --noEmit`
Expected: PASS

Run: `npm run lint`
Expected: PASS (no new warnings/errors за `app/page.tsx`)

- [ ] **Step 4: Ръчна верификация (а) — нормалното поведение е непроменено**

Стартирай dev сървъра (`npm run dev`), отвори `http://localhost:3000/` БЕЗ параметри и без `festivo_preview` cookie.
Презареди няколко пъти → редът на „Този уикенд" и „Предстоящи" е стабилен и идентичен на сегашния (kешируем path). Добави `?rotday=2026-06-13` без cookie → редът НЕ се променя (gate работи).

- [ ] **Step 5: Ръчна верификация (б) — override работи при preview cookie**

Сетни `festivo_preview` cookie (стойност от `FESTIVO_PREVIEW_SECRET` flow / DevTools). Отвори `http://localhost:3000/?rotday=2026-06-13` → редът на органичните позиции в „Този уикенд"/„Предстоящи" се различава от реда без параметър (платените позиции остават отпред). Смени на утрешна/друга дата → редът пак се променя. `?rotseed=12345` → също различен детерминистичен ред.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx
git commit -m "feat(home): preview-gated rotation seed override via ?rotday/?rotseed"
```

---

## Финален gate (преди PR)

- [ ] `npx tsc --noEmit` → чисто
- [ ] `npm run lint` → чисто
- [ ] Ръчни проверки (а) и (б) минават
- [ ] `git push -u origin feat/home-rotation-seed-preview`
- [ ] `gh pr create` + `gh pr merge --merge --delete-branch`

> Документ: spec вече покрива промяната; CLAUDE.md НЕ изисква update (няма нов
> архитектурен patten, env var, job или API контракт — само preview query param).
