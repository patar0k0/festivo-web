# Свободен избор на населено място в организаторския профил — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Организаторът да може да зададе всяко населено място в публичния си профил — чрез autocomplete търсачка с обмислено auto-create — вместо да е ограничен до вече вкараните в `cities`.

**Architecture:** Нов organizer-достъпен search endpoint връща предложения от `cities`. Клиентският picker заменя `<select>` с autocomplete; при липса на съвпадение показва изричен ред „➕ Добави «име»". При запис PATCH route-ът приема или `city_id` (съществуващ), или `city_name` (нов → `resolveOrCreateCity`). Без schema промени.

**Tech Stack:** Next.js 14 App Router · TypeScript · Supabase (`@supabase/supabase-js`) · vitest (pure-logic тестове в `lib/**/*.test.ts`).

**Verification бележки:**
- Pure helper-ите се покриват с vitest (`lib/**/*.test.ts` — единственото, което vitest config включва).
- API routes и React компонентът НЕ се тестват с unit тестове в този проект — верифицират се с `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- Организаторският портал е auth-gated → реалната UI проверка става в prod след deploy (потребителят преглежда). Вж. memory „admin-pages-verify-in-prod".

---

### Task 1: Чист helper за ранкиране на градове-предложения

**Files:**
- Create: `lib/cities/citySearch.ts`
- Test: `lib/cities/citySearch.test.ts`

- [ ] **Step 1: Напиши падащ тест**

Create `lib/cities/citySearch.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { rankCitySuggestions, type CitySuggestion } from "./citySearch";

const row = (id: number, name_bg: string, slug: string, is_village: boolean | null = false): CitySuggestion => ({
  id,
  name_bg,
  slug,
  is_village,
});

describe("rankCitySuggestions", () => {
  it("dedups by id, preserving first occurrence", () => {
    const rows = [row(1, "София", "sofia"), row(1, "София", "sofia"), row(2, "Сливен", "sliven")];
    const result = rankCitySuggestions(rows, "сли");
    expect(result.suggestions.map((s) => s.id)).toEqual([2, 1]);
  });

  it("puts exact name match first and flags hasExactMatch", () => {
    const rows = [row(1, "Старо село", "staro-selo"), row(2, "Стара Загора", "stara-zagora")];
    const result = rankCitySuggestions(rows, "Стара Загора");
    expect(result.suggestions[0].id).toBe(2);
    expect(result.hasExactMatch).toBe(true);
  });

  it("treats Bulgarian locality prefixes and case as equal for exact match", () => {
    const rows = [row(5, "Баня", "banya")];
    const result = rankCitySuggestions(rows, "с. баня");
    expect(result.hasExactMatch).toBe(true);
    expect(result.normalizedInput).toBe("баня");
  });

  it("reports no exact match when only partial hits exist", () => {
    const rows = [row(3, "Пловдив", "plovdiv")];
    const result = rankCitySuggestions(rows, "плов");
    expect(result.hasExactMatch).toBe(false);
  });

  it("limits the number of suggestions", () => {
    const rows = Array.from({ length: 20 }, (_, i) => row(i + 1, `Град${i}`, `grad-${i}`));
    const result = rankCitySuggestions(rows, "град", 8);
    expect(result.suggestions).toHaveLength(8);
  });

  it("returns empty suggestions and no exact match for blank query", () => {
    const result = rankCitySuggestions([row(1, "София", "sofia")], "   ");
    expect(result.hasExactMatch).toBe(false);
    expect(result.normalizedInput).toBe("");
  });
});
```

- [ ] **Step 2: Пусни теста — трябва да падне**

Run: `npm run test -- lib/cities/citySearch.test.ts`
Expected: FAIL — `Cannot find module './citySearch'` (файлът още не съществува).

- [ ] **Step 3: Имплементирай helper-а**

Create `lib/cities/citySearch.ts`:

```ts
import { normalizeSettlementInput } from "@/lib/settlements/normalizeSettlementInput";

export type CitySuggestion = {
  id: number;
  name_bg: string;
  slug: string;
  is_village: boolean | null;
};

export type CitySearchResult = {
  suggestions: CitySuggestion[];
  hasExactMatch: boolean;
  normalizedInput: string;
};

/** Lowercased, prefix-stripped key for comparing settlement names (Bulgarian collation). */
function compareKey(value: string): string {
  return normalizeSettlementInput(value).toLocaleLowerCase("bg-BG");
}

/**
 * Pure ranking for the organizer city autocomplete.
 * - dedups rows by id (first occurrence wins)
 * - exact-name matches float to the top, rest keep input order
 * - reports whether an exact match exists (drives the "➕ Добави …" affordance)
 */
export function rankCitySuggestions(rows: CitySuggestion[], query: string, limit = 8): CitySearchResult {
  const normalizedInput = compareKey(query);

  const seen = new Set<number>();
  const unique: CitySuggestion[] = [];
  for (const row of rows) {
    if (!row || typeof row.id !== "number" || seen.has(row.id)) continue;
    seen.add(row.id);
    unique.push(row);
  }

  const exact: CitySuggestion[] = [];
  const rest: CitySuggestion[] = [];
  for (const row of unique) {
    if (normalizedInput.length > 0 && compareKey(row.name_bg) === normalizedInput) {
      exact.push(row);
    } else {
      rest.push(row);
    }
  }

  return {
    suggestions: [...exact, ...rest].slice(0, limit),
    hasExactMatch: exact.length > 0,
    normalizedInput,
  };
}
```

- [ ] **Step 4: Пусни теста — трябва да мине**

Run: `npm run test -- lib/cities/citySearch.test.ts`
Expected: PASS (6 passed).

- [ ] **Step 5: Commit**

```bash
git add lib/cities/citySearch.ts lib/cities/citySearch.test.ts
git commit -m "feat(cities): add pure city suggestion ranking helper"
```

---

### Task 2: Organizer-достъпен city search endpoint

**Files:**
- Create: `app/api/cities/search/route.ts`

- [ ] **Step 1: Имплементирай route-а**

Create `app/api/cities/search/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getPortalAdminClient, getPortalSessionUser } from "@/lib/organizer/portal";
import { rankCitySuggestions, type CitySuggestion } from "@/lib/cities/citySearch";

export const dynamic = "force-dynamic";

const MAX_SUGGESTIONS = 8;

export async function GET(request: Request) {
  const session = await getPortalSessionUser();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let admin;
  try {
    admin = getPortalAdminClient();
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (!q) {
    return NextResponse.json({ suggestions: [], hasExactMatch: false, normalizedInput: "" });
  }

  const [byName, bySlug] = await Promise.all([
    admin.from("cities").select("id,name_bg,slug,is_village").ilike("name_bg", `%${q}%`).limit(MAX_SUGGESTIONS),
    admin.from("cities").select("id,name_bg,slug,is_village").ilike("slug", `%${q}%`).limit(MAX_SUGGESTIONS),
  ]);

  if (byName.error || bySlug.error) {
    console.error("[api/cities/search] query failed", {
      name: byName.error?.message ?? null,
      slug: bySlug.error?.message ?? null,
    });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }

  const rows = [...(byName.data ?? []), ...(bySlug.data ?? [])] as CitySuggestion[];
  return NextResponse.json(rankCitySuggestions(rows, q, MAX_SUGGESTIONS));
}
```

- [ ] **Step 2: Type-check и lint**

Run: `npx tsc --noEmit`
Expected: без грешки.
Run: `npm run lint`
Expected: без нови грешки за `app/api/cities/search/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/api/cities/search/route.ts
git commit -m "feat(api): add organizer-accessible city search endpoint"
```

---

### Task 3: Чист helper за решение коя резолюция на града да се приложи при запис

**Files:**
- Create: `lib/organizer/resolveCityUpdate.ts`
- Test: `lib/organizer/resolveCityUpdate.test.ts`

- [ ] **Step 1: Напиши падащ тест**

Create `lib/organizer/resolveCityUpdate.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { decideCityResolution } from "./resolveCityUpdate";

describe("decideCityResolution", () => {
  it("returns create mode when a non-empty city_name is provided", () => {
    expect(decideCityResolution({ city_name: "  Ново село  " })).toEqual({ mode: "create", name: "Ново село" });
  });

  it("city_name takes precedence over city_id", () => {
    expect(decideCityResolution({ city_name: "Банкя", city_id: 7 })).toEqual({ mode: "create", name: "Банкя" });
  });

  it("returns existing mode for a valid positive city_id", () => {
    expect(decideCityResolution({ city_id: 42 })).toEqual({ mode: "existing", id: 42 });
  });

  it("accepts numeric-string city_id", () => {
    expect(decideCityResolution({ city_id: "42" })).toEqual({ mode: "existing", id: 42 });
  });

  it("returns none for blank city_name and missing city_id", () => {
    expect(decideCityResolution({ city_name: "   " })).toEqual({ mode: "none" });
  });

  it("returns none for null/zero/invalid city_id", () => {
    expect(decideCityResolution({ city_id: null })).toEqual({ mode: "none" });
    expect(decideCityResolution({ city_id: 0 })).toEqual({ mode: "none" });
    expect(decideCityResolution({ city_id: "abc" })).toEqual({ mode: "none" });
  });
});
```

- [ ] **Step 2: Пусни теста — трябва да падне**

Run: `npm run test -- lib/organizer/resolveCityUpdate.test.ts`
Expected: FAIL — `Cannot find module './resolveCityUpdate'`.

- [ ] **Step 3: Имплементирай helper-а**

Create `lib/organizer/resolveCityUpdate.ts`:

```ts
export type CityResolution =
  | { mode: "create"; name: string }
  | { mode: "existing"; id: number }
  | { mode: "none" };

function normalizeOptionalCityId(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const n = Math.trunc(value);
    return n > 0 ? n : null;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    return n > 0 ? n : null;
  }
  return null;
}

/**
 * Decides how the PATCH route should resolve the organizer's city.
 * A non-empty `city_name` signals an explicit "add new place" intent and wins over
 * `city_id`; the route then runs resolveOrCreateCity (which dedups against existing rows).
 */
export function decideCityResolution(input: { city_name?: unknown; city_id?: unknown }): CityResolution {
  if (typeof input.city_name === "string") {
    const name = input.city_name.trim();
    if (name.length > 0) {
      return { mode: "create", name };
    }
  }

  const id = normalizeOptionalCityId(input.city_id);
  if (id != null) {
    return { mode: "existing", id };
  }

  return { mode: "none" };
}
```

- [ ] **Step 4: Пусни теста — трябва да мине**

Run: `npm run test -- lib/organizer/resolveCityUpdate.test.ts`
Expected: PASS (6 passed).

- [ ] **Step 5: Commit**

```bash
git add lib/organizer/resolveCityUpdate.ts lib/organizer/resolveCityUpdate.test.ts
git commit -m "feat(organizer): add city resolution decision helper"
```

---

### Task 4: PATCH route приема `city_name` и резолвва/създава града

**Files:**
- Modify: `app/api/organizers/[id]/route.ts`

- [ ] **Step 1: Добави импорти**

В `app/api/organizers/[id]/route.ts`, под съществуващите импорти (след реда `import { getPortalAdminClient, getPortalSessionUser } from "@/lib/organizer/portal";`) добави:

```ts
import { decideCityResolution } from "@/lib/organizer/resolveCityUpdate";
import { resolveOrCreateCity } from "@/lib/admin/resolveOrCreateCity";
```

- [ ] **Step 2: Разшири body типа**

Замени `OrganizerPatchBody` типа:

```ts
type OrganizerPatchBody = {
  name?: unknown;
  description?: unknown;
  logo_url?: unknown;
  website_url?: unknown;
  facebook_url?: unknown;
  instagram_url?: unknown;
  email?: unknown;
  phone?: unknown;
  city_id?: unknown;
  city_name?: unknown;
};
```

- [ ] **Step 3: Премахни стария `normalizeOptionalCityId` и резолвни града**

Изтрий цялата функция `normalizeOptionalCityId` (редове ~23-35 — вече живее в `resolveCityUpdate.ts`).

Замени реда `const cityId = normalizeOptionalCityId(body.city_id);` с:

```ts
let cityId: number | null = null;
const cityResolution = decideCityResolution({ city_name: body.city_name, city_id: body.city_id });
if (cityResolution.mode === "create") {
  try {
    const resolved = await resolveOrCreateCity(cityResolution.name);
    cityId = resolved.city?.id ?? null;
  } catch (error) {
    console.error("[api/organizers/[id]] city resolve failed", error);
    return NextResponse.json({ error: "Невалидно населено място." }, { status: 400 });
  }
} else if (cityResolution.mode === "existing") {
  cityId = cityResolution.id;
}
```

- [ ] **Step 4: Върни резолвнатия град в отговора**

Промени `.select("verified")` на `.select("verified,city_id")` в `.update(...)` веригата, и замени финалния success ред:

```ts
  return NextResponse.json({ ok: true, verified: Boolean(updated.verified), city_id: updated.city_id ?? null });
```

- [ ] **Step 5: Type-check и lint**

Run: `npx tsc --noEmit`
Expected: без грешки.
Run: `npm run lint`
Expected: без нови грешки.

- [ ] **Step 6: Commit**

```bash
git add app/api/organizers/[id]/route.ts
git commit -m "feat(api): accept city_name and resolve-or-create city on organizer PATCH"
```

---

### Task 5: Страницата подава `initialCity` вместо целия списък градове

**Files:**
- Modify: `app/organizer/(workspace)/organizations/[id]/edit/page.tsx`

- [ ] **Step 1: Замени bulk cities заявката с lookup на текущия град**

Изтрий блока, който зарежда всички градове (заявката към `cities` с `.order("name_bg")` и `cityOptions` map-а, редове ~51-70).

Веднага след зареждането на `organizer` (след `if (!organizer) { redirect("/organizer"); }`) добави:

```ts
  const currentCityId =
    organizer.city_id != null && Number.isFinite(Number(organizer.city_id)) ? Number(organizer.city_id) : null;

  let initialCity: { id: number; name_bg: string } | null = null;
  if (currentCityId != null) {
    const { data: cityRow, error: cityError } = await admin
      .from("cities")
      .select("id,name_bg")
      .eq("id", currentCityId)
      .maybeSingle();
    if (cityError) {
      console.error("[organizer/organizations/[id]/edit] load city failed", cityError.message);
    } else if (cityRow && typeof cityRow.name_bg === "string") {
      initialCity = { id: cityRow.id as number, name_bg: fixMojibakeBG(cityRow.name_bg.trim()) };
    }
  }
```

- [ ] **Step 2: Обнови props към формата**

Замени `cities={cityOptions}` с `initialCity={initialCity}` в `<OrganizerProfileEditForm ... />`, и в `initial={{...}}` замени блока за `city_id` с:

```ts
          city_id: currentCityId,
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: ще има грешка, че `OrganizerProfileEditForm` все още очаква `cities` props — това се оправя в Task 6. Засега очаквай само тази грешка относно `cities`/`initialCity`.

- [ ] **Step 4: Commit**

```bash
git add "app/organizer/(workspace)/organizations/[id]/edit/page.tsx"
git commit -m "refactor(organizer): pass initialCity to profile edit form instead of full list"
```

---

### Task 6: Autocomplete city picker в формата

**Files:**
- Modify: `components/organizer/OrganizerProfileEditForm.tsx`

- [ ] **Step 1: Обнови props, типове и state**

Замени `export type OrganizerCityOption = { id: number; name_bg: string };` (остава същият) и в `OrganizerProfileEditFormProps` замени реда `cities: OrganizerCityOption[];` с:

```ts
  initialCity: OrganizerCityOption | null;
```

Добави нов тип за suggestion (до другите типове, напр. под `OrganizerCityOption`):

```ts
type CitySuggestionApi = { id: number; name_bg: string; slug: string; is_village: boolean | null };
```

Разшири `PatchSnapshot` и `normalizeFormData` да носят `city_name`:

В `PatchSnapshot` добави след `city_id: number | null;`:

```ts
  city_name: string | null;
```

В сигнатурата на `normalizeFormData` добави `city_name: string | null;` към обектния параметър, и в върнатия обект добави след `city_id: f.city_id ?? null,`:

```ts
    city_name: f.city_name ?? null,
```

В `initialPatchSnapshot` добави `city_name: null,` в обекта подаден към `normalizeFormData`.

- [ ] **Step 2: Обнови сигнатурата на компонента и form state**

Замени `cities,` с `initialCity,` в деструктурирането на props.

В `useState` за `form` добави `city_name: null as string | null,` след `city_id: initial.city_id,`.

Добави нови state-ове и ref-ове след съществуващите useState декларации (напр. след `const [touched, setTouched] = useState<...>({});`):

```ts
  const [cityQuery, setCityQuery] = useState(initialCity?.name_bg ?? "");
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestionApi[]>([]);
  const [cityHasExactMatch, setCityHasExactMatch] = useState(false);
  const [cityBusy, setCityBusy] = useState(false);
  const cityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

- [ ] **Step 3: Добави debounced city search effect**

Добави този effect до другите `useEffect`-и:

```ts
  useEffect(() => {
    if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current);
    const q = cityQuery.trim();

    // Picked existing city whose name matches the field → nothing to search.
    if (form.city_id != null && q === (initialCity?.id === form.city_id ? initialCity?.name_bg.trim() : q)) {
      // fall through; handled below by clearing suggestions when query unchanged
    }

    if (!q) {
      setCitySuggestions([]);
      setCityHasExactMatch(false);
      setCityBusy(false);
      return;
    }

    setCityBusy(true);
    cityDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/cities/search?q=${encodeURIComponent(q)}`);
        const data = (await res.json().catch(() => ({}))) as {
          suggestions?: CitySuggestionApi[];
          hasExactMatch?: boolean;
        };
        setCitySuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
        setCityHasExactMatch(Boolean(data.hasExactMatch));
      } catch {
        setCitySuggestions([]);
        setCityHasExactMatch(false);
      } finally {
        setCityBusy(false);
      }
    }, 250);

    return () => {
      if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current);
    };
  }, [cityQuery, form.city_id, initialCity]);
```

- [ ] **Step 4: Обнови preview и payload да ползват новия модел**

Замени реда `const previewCityName = cities.find((c) => c.id === form.city_id)?.name_bg ?? null;` с:

```ts
  const previewCityName =
    form.city_name?.trim() ||
    (form.city_id != null && initialCity?.id === form.city_id ? initialCity?.name_bg : null) ||
    citySuggestions.find((c) => c.id === form.city_id)?.name_bg ||
    null;
```

В `executePatch`, в `payload` обекта, замени `city_id: snap.city_id,` с:

```ts
      city_id: snap.city_id,
      city_name: snap.city_name,
```

- [ ] **Step 5: Реконсилирай града след успешен запис (без autosave цикъл)**

В `executePatch`, разшири типа на `body` да включва `city_id`:

```ts
      const body = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        verified?: boolean;
        city_id?: number | null;
        error?: string;
      };
```

След `if (typeof body.verified === "boolean") { setVerifiedPreview(body.verified); }` добави реконсилиация: ако сме създали град (`snap.city_name`), фиксирай върнатото `city_id` и изчисти `city_name`, и в самия snapshot който записваме като baseline:

```ts
      const reconciled =
        snap.city_name && typeof body.city_id === "number"
          ? { ...snap, city_id: body.city_id, city_name: null }
          : snap;
      if (reconciled !== snap) {
        setForm((f) => ({ ...f, city_id: body.city_id ?? f.city_id, city_name: null }));
        setCityQuery((prev) => prev); // запазваме показаното име
      }
```

Замени `setLastSaved(snap);` с `setLastSaved(reconciled);`.

- [ ] **Step 6: Замени `<select>` блока с autocomplete UI**

Замени целия `<div>` около `<label htmlFor="city_id">` + `<select id="city_id">` (вътре в `FormSection title="Локация"`) с:

```tsx
                <div className="relative">
                  <label htmlFor="city_query" className={pub.label}>
                    Град
                  </label>
                  <input
                    id="city_query"
                    name="city_query"
                    type="text"
                    autoComplete="off"
                    placeholder="Започни да пишеш населено място…"
                    value={cityQuery}
                    onChange={(e) => {
                      handleFieldChange("city_id");
                      const v = e.target.value;
                      setCityQuery(v);
                      // Editing the text invalidates any picked/created city until re-selected.
                      setForm((f) => ({ ...f, city_id: null, city_name: null }));
                    }}
                    className={inputClass(false)}
                  />
                  {cityBusy ? <p className="mt-1 text-xs text-black/45">Търсене…</p> : null}

                  {form.city_id != null || form.city_name ? (
                    <p className="mt-1 flex items-center gap-2 text-xs font-medium text-[#1f7a37]">
                      Избрано: {form.city_name?.trim() || cityQuery.trim()}
                      <button
                        type="button"
                        onClick={() => {
                          handleFieldChange("city_id");
                          setForm((f) => ({ ...f, city_id: null, city_name: null }));
                          setCityQuery("");
                          setCitySuggestions([]);
                          setCityHasExactMatch(false);
                        }}
                        className="text-black/45 underline-offset-2 hover:text-black hover:underline"
                      >
                        Изчисти
                      </button>
                    </p>
                  ) : null}

                  {(citySuggestions.length > 0 || (cityQuery.trim() && !cityHasExactMatch && !cityBusy)) &&
                  form.city_id == null &&
                  !form.city_name ? (
                    <ul className="mt-2 divide-y divide-black/[0.06] overflow-hidden rounded-lg border border-black/[0.12] bg-white">
                      {citySuggestions.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => {
                              handleFieldChange("city_id");
                              setForm((f) => ({ ...f, city_id: c.id, city_name: null }));
                              setCityQuery(c.name_bg);
                              setCitySuggestions([]);
                              setCityHasExactMatch(true);
                            }}
                            className="flex w-full items-center px-3 py-2 text-left text-sm hover:bg-black/[0.03]"
                          >
                            {c.name_bg}
                          </button>
                        </li>
                      ))}
                      {cityQuery.trim() && !cityHasExactMatch ? (
                        <li>
                          <button
                            type="button"
                            onClick={() => {
                              handleFieldChange("city_id");
                              const name = cityQuery.trim();
                              setForm((f) => ({ ...f, city_id: null, city_name: name }));
                              setCitySuggestions([]);
                            }}
                            className="flex w-full items-center px-3 py-2 text-left text-sm font-medium text-[#7c2d12] hover:bg-amber-50/60"
                          >
                            ➕ Добави „{cityQuery.trim()}“
                          </button>
                        </li>
                      ) : null}
                    </ul>
                  ) : null}
                </div>
```

- [ ] **Step 7: Type-check, lint, тестове, build**

Run: `npx tsc --noEmit`
Expected: без грешки.
Run: `npm run lint`
Expected: без нови грешки.
Run: `npm run test`
Expected: всички тестове минават (вкл. citySearch + resolveCityUpdate).
Run: `npm run build`
Expected: build успешен.

- [ ] **Step 8: Commit**

```bash
git add components/organizer/OrganizerProfileEditForm.tsx
git commit -m "feat(organizer): autocomplete city picker with deliberate add-new"
```

---

### Task 7: Финална верификация и PR

**Files:** (без промени по код — верификация)

- [ ] **Step 1: Пусни целия verification набор**

Run: `npm run test`
Expected: PASS — всички pure helper тестове минават.
Run: `npx tsc --noEmit`
Expected: без грешки.
Run: `npm run lint`
Expected: без нови грешки.
Run: `npm run build`
Expected: успешен production build.

- [ ] **Step 2: Push и PR**

```bash
git push -u origin feat/organizer-city-free-select
gh pr create --title "feat(organizer): свободен избор на населено място в профила" --body "Заменя ограничения dropdown с autocomplete търсачка + обмислено auto-create (resolveOrCreateCity). Вж. docs/superpowers/specs/2026-06-24-organizer-city-free-select-design.md"
gh pr merge --merge --delete-branch
```

- [ ] **Step 3: Ръчна проверка в prod (потребител)**

След deploy: организатор отваря `/organizer/organizations/<id>/edit`, въвежда населено място, което не е в базата, цъка „➕ Добави …", записва, и проверява, че градът се появява в публичния профил `/organizers/<slug>`.

---

## Self-Review

**Spec coverage:**
- Нов search endpoint (spec §1) → Task 1 (pure ranking) + Task 2 (route). ✓
- Клиентски picker с „➕ Добави" (spec §2) → Task 5 (props) + Task 6 (UI/state). ✓
- PATCH приема `city_name` → resolveOrCreateCity (spec §3) → Task 3 (decision helper) + Task 4 (route). ✓
- Data flow таблица (spec) → покрита от decideCityResolution + payload логиката. ✓
- Без schema промени → потвърдено, никоя задача не пипа DDL. ✓
- Извън обхвата (master списък, admin форма) → не се пипат. ✓

**Placeholder scan:** Няма TBD/TODO; всички стъпки имат конкретен код/команди. ✓

**Type consistency:**
- `CitySuggestion` (Task 1) ↔ `CitySuggestionApi` (Task 6) — еднакви полета (`id,name_bg,slug,is_village`); route-ът връща `rankCitySuggestions` резултат, клиентът чете `suggestions`/`hasExactMatch`. ✓
- `decideCityResolution({ city_name, city_id })` (Task 3) ↔ извикване в route (Task 4) — еднакви имена на ключове. ✓
- PATCH връща `{ ok, verified, city_id }` (Task 4) ↔ клиентът чете `body.city_id` (Task 6 Step 5). ✓
- `initialCity: OrganizerCityOption | null` (Task 6 props) ↔ подадено от page (Task 5). ✓
- `PatchSnapshot.city_name` добавено навсякъде, където `city_id` присъства (normalizeFormData, initialPatchSnapshot, payload). ✓
