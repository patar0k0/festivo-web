# Rotation Seed Override — Preview параметър за дневна ротация

**Дата:** 2026-06-12  
**Статус:** Одобрен  
**Засегнати файлове:** `lib/home/loadHomePageData.ts`, `app/page.tsx`

---

## Цел

Добавяне на preview-only query параметър, с който редакторите могат да тестват
дневната ротация на началната страница за различни дни, без да чакат смяна на
календарния ден.

---

## Обхват

- **Извън обхвата:** промени в DB схема, API контракти, кеш стратегия за нормални
  посетители, admin role check (Preview cookie е достатъчна).

---

## Архитектура

### Ключово свойство на текущата реализация

`loadHomePageData` разделя две неща:

1. **DB данни** — кешират се от `unstable_cache` по `{today, citySlug, weekendStart, weekendEnd, monthStart, monthEnd}`.
2. **Seed** — изчислява се POST-cache като `dailyRotationSeed(today)` (чиста FNV-1a функция, нула I/O).

Override стратегия: при наличие на `seedOverride` заявката (а) изчислява
ротацията с подадения seed вместо от `today`, и (б) **заобикаля
`_loadDbDataCached` напълно** — вика `fetchHomeDbData(params)` директно, така
preview заявката нито чете, нито пише в споделения кеш. `params` не съдържа
`seedOverride`, затова нормалният кешов ключ остава непроменен.

---

## Поддържани параметри

| Параметър | Формат | Ефект |
|---|---|---|
| `?rotday=YYYY-MM-DD` | ISO дата | Изчислява seed от тази дата вместо от `today` |
| `?rotseed=<число>` | Unsigned 32-bit integer | Подава се директно като seed |

Ако и двата са налице — `rotday` взима предимство. При invalid стойност и двата
се игнорират → нормален ред.

---

## Gate (сигурност)

Параметрите се четат **само** когато `hasPreviewAccess === true`
(cookie `festivo_preview` е налична). При нормални посетители `rawRotday` и
`rawRotseed` са `undefined` преди parse — параметрите не се четат изобщо.

Не се изисква admin роля; `festivo_preview` cookie е достатъчна и вече
се проверява в `app/page.tsx`.

---

## Промени

### `lib/home/loadHomePageData.ts`

```ts
export async function loadHomePageData(
  citySlug: string | undefined,
  seedOverride?: number,
): Promise<HomePageViewProps>
```

Две промени в тялото:

**1. Избор на loader — override никога не докосва споделения кеш.** Текущият
код вика винаги `_loadDbDataCached(params)`. Заменя се с условен избор:

```ts
// Преди:
let dbData: CachedDbData;
try {
  dbData = await _loadDbDataCached(params);
} catch (cachedErr) {
  // ...uncached retry + empty fallback...
}

// След:
// Preview override → fetchHomeDbData директно (uncached, не докосва кеша).
// Нормално → _loadDbDataCached (100% непроменен path).
const loadDbData = seedOverride !== undefined ? fetchHomeDbData : _loadDbDataCached;
let dbData: CachedDbData;
try {
  dbData = await loadDbData(params);
} catch (cachedErr) {
  // ...uncached retry + empty fallback остава непроменен...
}
```

**2. Seed:**

```ts
// Преди:
const rotationSeed = dailyRotationSeed(today);

// След:
const rotationSeed = seedOverride ?? dailyRotationSeed(today);
```

Когато `seedOverride` е зададен, заявката не вика `_loadDbDataCached` изобщо —
смята се uncached, нула contamination на споделения кеш. `params` не съдържа
`seedOverride`, затова нормалният кешов ключ остава непроменен.

### `app/page.tsx`

След реда, където се parse-ва `city`:

```ts
const rawRotday = hasPreviewAccess
  ? firstHomeSearchParam(searchParams.rotday)
  : undefined;
const rawRotseed = hasPreviewAccess
  ? firstHomeSearchParam(searchParams.rotseed)
  : undefined;

let seedOverride: number | undefined;
if (rawRotday && /^\d{4}-\d{2}-\d{2}$/.test(rawRotday)) {
  seedOverride = dailyRotationSeed(rawRotday);
} else if (rawRotseed) {
  const parsed = parseInt(rawRotseed, 10);
  if (!isNaN(parsed)) seedOverride = parsed >>> 0;
}

const props = await loadHomePageData(city, seedOverride);
```

`dailyRotationSeed` се импортира от `@/lib/home/dailyRotation` (вече е `export`).

---

## Гаранции за качество

| Сценарий | Очакван резултат |
|---|---|
| Нормален посетител (без cookie) | Идентично поведение, нула промяна |
| Preview потребител без параметър | Идентично поведение |
| `?rotday=2026-06-13` + preview cookie | Редът от утрешния seed; DB данните са днешни |
| `?rotseed=12345` + preview cookie | Ред от seed 12345 |
| `?rotday=invalid` + preview cookie | Игнорирано → нормален ред |
| `?rotseed=abc` + preview cookie | Игнорирано → нормален ред |

---

## Верификация

```bash
tsc --noEmit
next lint
```

Ръчна проверка:
- (а) Без параметър — редът е идентичен на сегашния (кешируем path непроменен)
- (б) С `?rotday=<утрешна дата>` + preview cookie — редът се различава от днешния
