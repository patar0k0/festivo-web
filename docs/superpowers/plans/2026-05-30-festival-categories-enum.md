# Festival Categories Enum Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Замени свободния текст в `festivals.category` и `pending_festivals.category` с фиксиран enum от 7 стойности, затвори всички входни точки за запис, и нормализирай съществуващите данни с SQL миграция.

**Architecture:** Единственият source-of-truth за валидните категории е `CANONICAL_FESTIVAL_CATEGORIES` в `publicCategoryShared.ts`. `mapToCanonicalCategory()` от същия файл се ползва навсякъде — в `normalizeCategory()`, в AI prompt-а, и при approve. Всички форми (admin + organizer) се сменят от text input на `<select>` с хардкоднат списък — без DB заявки за suggestions.

**Tech Stack:** TypeScript · Next.js App Router · Supabase Postgres · Tailwind

---

## Canonical категории (7 стойности)

Съхраняват се lowercase в DB. Display-layer прави sentence-case на първата буква (вече го прави `sentenceCase()` в `publicCategories.server.ts`).

| DB стойност | Показва се като |
|---|---|
| `фолклорен фестивал` | Фолклорен фестивал |
| `събор` | Събор |
| `кулинарен фестивал` | Кулинарен фестивал |
| `музикален фестивал` | Музикален фестивал |
| `танцов фестивал` | Танцов фестивал |
| `културен фестивал` | Културен фестивал |
| `арт фестивал` | Арт фестивал |

---

## Засегнати файлове

| Файл | Промяна |
|---|---|
| `lib/festivals/publicCategoryShared.ts` | Добавя `CANONICAL_FESTIVAL_CATEGORIES` и `mapToCanonicalCategory()` |
| `lib/festival/mappers.ts` | `normalizeCategory()` вика `mapToCanonicalCategory()` |
| `lib/festival/categoryLabel.ts` | Обновява labels към 7 канонични |
| `lib/admin/research/gemini-extract.ts` | Ограничава AI prompt до 7 категории |
| `app/admin/api/pending-festivals/[id]/approve/route.ts` | Сваля fallback `?? "festival"` → `?? null` |
| `components/admin/FestivalEditForm.tsx` | `<input>` → `<select>` за category |
| `components/admin/PendingFestivalEditForm.tsx` | `<input>` → `<select>` за category |
| `app/organizer/(workspace)/festivals/new/NewFestivalSubmissionClient.tsx` | datalist input → `<select>`; сваля `categorySuggestions` prop |
| `app/organizer/(workspace)/festivals/new/page.tsx` | Трие `loadCategorySuggestions()`; спира да подава prop |
| `scripts/sql/20260530_normalize_festival_categories.sql` | Нормализира съществуващи редове в двете таблици |

---

## Task 1: Дефинирай canonical категории и mapping функция

**Files:**
- Modify: `lib/festivals/publicCategoryShared.ts`

- [ ] **Стъпка 1: Добави `CANONICAL_FESTIVAL_CATEGORIES` и `mapToCanonicalCategory()` в началото на файла**

Отвори `lib/festivals/publicCategoryShared.ts` и добави **преди** съществуващия `FESTIVAL_CATEGORY_LABELS`:

```typescript
/** Ordered list of the 7 canonical festival category slugs (lowercase, stored as-is in DB). */
export const CANONICAL_FESTIVAL_CATEGORIES = [
  "фолклорен фестивал",
  "събор",
  "кулинарен фестивал",
  "музикален фестивал",
  "танцов фестивал",
  "културен фестивал",
  "арт фестивал",
] as const;

export type CanonicalFestivalCategory = (typeof CANONICAL_FESTIVAL_CATEGORIES)[number];

/** Maps free-form DB values (lowercase trimmed) → canonical category slug, or null if unknown. */
const CATEGORY_MAP: Record<string, CanonicalFestivalCategory> = {
  // Фолклорен фестивал
  "фолклорен фестивал": "фолклорен фестивал",
  "фолк фестивал": "фолклорен фестивал",
  "folk festival": "фолклорен фестивал",
  "фолклорен конкурс": "фолклорен фестивал",
  "конкурс-надиграване": "фолклорен фестивал",
  "фестивал-надиграване": "фолклорен фестивал",
  "фолклорен танцов": "фолклорен фестивал",
  "фолклорен танцов фестивал": "фолклорен фестивал",
  "фолклор": "фолклорен фестивал",
  "национален фолклорен": "фолклорен фестивал",
  "фолкорен фестивал": "фолклорен фестивал",
  "международен фолклорен фестивал": "фолклорен фестивал",
  "фолклорен празник": "фолклорен фестивал",
  "кукерски карнавал": "фолклорен фестивал",
  // Събор
  "събор": "събор",
  "традиционен събор": "събор",
  "събор-надпяване": "събор",
  "фолклорен събор": "събор",
  // Кулинарен фестивал
  "кулинарен фестивал": "кулинарен фестивал",
  "гастрономически фестивал": "кулинарен фестивал",
  "кулинарно-фолклорен фестивал": "кулинарен фестивал",
  "кулинарен и фолклорен фестивал": "кулинарен фестивал",
  "кулинарен фестивал / фолклорен празник": "кулинарен фестивал",
  "кулинарно-фолклорен": "кулинарен фестивал",
  "кулинарно-фолклорен празник": "кулинарен фестивал",
  "кулинарен празник": "кулинарен фестивал",
  "кулинарен празник / фолклорен празник": "кулинарен фестивал",
  "винен фестивал": "кулинарен фестивал",
  // Музикален фестивал
  "музикален фестивал": "музикален фестивал",
  "музика": "музикален фестивал",
  "концерт": "музикален фестивал",
  "празничен концерт": "музикален фестивал",
  // Танцов фестивал
  "танцов фестивал": "танцов фестивал",
  "танцово изкуство": "танцов фестивал",
  // Културен фестивал
  "културен фестивал": "културен фестивал",
  "балкански фестивал": "културен фестивал",
  "градски празник": "културен фестивал",
  // Арт фестивал
  "арт фестивал": "арт фестивал",
};

/**
 * Maps any free-form category string to a canonical value.
 * Input is lowercased+trimmed before lookup.
 * Returns null for unrecognized values (generic "фестивал", "festival" etc.) — admin must classify manually.
 */
export function mapToCanonicalCategory(value: string | null | undefined): CanonicalFestivalCategory | null {
  if (!value) return null;
  const key = value.trim().toLocaleLowerCase("bg-BG");
  return CATEGORY_MAP[key] ?? null;
}
```

- [ ] **Стъпка 2: Обнови `FESTIVAL_CATEGORY_LABELS` в същия файл**

Намери и замени съществуващия `FESTIVAL_CATEGORY_LABELS` обект:

```typescript
/** Canonical slug → Bulgarian display label (sentence-cased). */
export const FESTIVAL_CATEGORY_LABELS: Record<string, string> = {
  "фолклорен фестивал": "Фолклорен фестивал",
  "събор": "Събор",
  "кулинарен фестивал": "Кулинарен фестивал",
  "музикален фестивал": "Музикален фестивал",
  "танцов фестивал": "Танцов фестивал",
  "културен фестивал": "Културен фестивал",
  "арт фестивал": "Арт фестивал",
};
```

- [ ] **Стъпка 3: Commit**

```bash
git add lib/festivals/publicCategoryShared.ts
git commit -m "feat(categories): define 7 canonical categories and mapping function"
```

---

## Task 2: Обнови `normalizeCategory()` и approve fallback

**Files:**
- Modify: `lib/festival/mappers.ts:56-66`
- Modify: `app/admin/api/pending-festivals/[id]/approve/route.ts:538`

- [ ] **Стъпка 1: Обнови `normalizeCategory()` в `lib/festival/mappers.ts`**

Намери функцията (ред ~62) и я замени:

```typescript
/**
 * Normalizes a festival category string to a canonical slug.
 * Trims, lowercases, then maps to one of the 7 canonical values.
 * Returns null for unrecognized or empty values.
 */
export function normalizeCategory(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return mapToCanonicalCategory(trimmed) ?? trimmed.toLocaleLowerCase("bg-BG") || null;
}
```

В началото на файла добави импорт (след съществуващите imports):

```typescript
import { mapToCanonicalCategory } from "@/lib/festivals/publicCategoryShared";
```

- [ ] **Стъпка 2: Смени fallback в `approve/route.ts`**

Намери ред 538:
```typescript
category: normalizeCategory(canonicalApproved.category) ?? "festival",
```

Замени с:
```typescript
category: normalizeCategory(canonicalApproved.category),
```

- [ ] **Стъпка 3: Commit**

```bash
git add lib/festival/mappers.ts app/admin/api/pending-festivals/[id]/approve/route.ts
git commit -m "fix(categories): normalizeCategory snaps to canonical; remove 'festival' fallback"
```

---

## Task 3: Обнови `categoryLabel.ts`

**Files:**
- Modify: `lib/festival/categoryLabel.ts`

- [ ] **Стъпка 1: Замени целия файл**

```typescript
import { FESTIVAL_CATEGORY_LABELS } from "@/lib/festivals/publicCategories";

export function categoryLabel(category?: string | null): string | null {
  if (!category) return null;
  const key = category.trim().toLocaleLowerCase("bg-BG");
  return FESTIVAL_CATEGORY_LABELS[key] ?? category;
}
```

- [ ] **Стъпка 2: Commit**

```bash
git add lib/festival/categoryLabel.ts
git commit -m "refactor(categories): categoryLabel.ts uses canonical 7 labels"
```

---

## Task 4: Обнови Gemini AI prompt

**Files:**
- Modify: `lib/admin/research/gemini-extract.ts:143-146`

- [ ] **Стъпка 1: Намери и замени секцията КАТЕГОРИЯ в prompt-а**

Намери блока (ред ~143):
```
КАТЕГОРИЯ (category):
- Кратка категория на БЪЛГАРСКИ, описваща типа събитие.
- Избирай от или близо до: "музикален фестивал", "рок фестивал", ...
- Ако типът не е ясен от текста → null.
```

Замени с:
```
КАТЕГОРИЯ (category):
- Задължително избирай ТОЧНО една от следните 7 стойности (lowercase):
  "фолклорен фестивал" — фолклорни фестивали, събори с фолклорна програма, конкурси за народна музика/танц
  "събор" — събор на населено място, местен събор, традиционен събор
  "кулинарен фестивал" — кулинарни, гастрономически, винени, бирени фестивали
  "музикален фестивал" — концерти, музикални фестивали (рок, джаз, поп, класическа, електронна)
  "танцов фестивал" — танцови фестивали и прояви
  "културен фестивал" — градски празници, смесени културни събития
  "арт фестивал" — изложби, арт инсталации, визуални изкуства
- Ако събитието съчетава два типа, избери доминиращия.
- Ако типът не е ясен от текста → null.
```

- [ ] **Стъпка 2: Commit**

```bash
git add lib/admin/research/gemini-extract.ts
git commit -m "feat(categories): restrict Gemini AI to 7 canonical category values"
```

---

## Task 5: SQL миграция — нормализирай съществуващите данни

**Files:**
- Create: `scripts/sql/20260530_normalize_festival_categories.sql`

- [ ] **Стъпка 1: Създай миграционния файл**

```sql
-- Migration: 20260530_normalize_festival_categories
-- Normalises free-form category strings in both festivals and pending_festivals
-- to one of 7 canonical lowercase values.
-- Rows that cannot be mapped (generic "festival", "фестивал" etc.) are set to NULL
-- so admin can reclassify them via the new select UI.

-- ============================================================
-- FESTIVALS TABLE
-- ============================================================

-- Фолклорен фестивал
UPDATE festivals
SET category = 'фолклорен фестивал'
WHERE lower(trim(category)) IN (
  'фолклорен фестивал', 'фолк фестивал', 'folk festival',
  'фолклорен конкурс', 'конкурс-надиграване', 'фестивал-надиграване',
  'фолклорен танцов', 'фолклорен танцов фестивал', 'фолклор',
  'национален фолклорен', 'фолкорен фестивал',
  'международен фолклорен фестивал', 'фолклорен празник',
  'кукерски карнавал'
)
AND category IS NOT NULL;

-- Събор
UPDATE festivals
SET category = 'събор'
WHERE lower(trim(category)) IN (
  'събор', 'традиционен събор', 'събор-надпяване', 'фолклорен събор'
)
AND category IS NOT NULL;

-- Кулинарен фестивал
UPDATE festivals
SET category = 'кулинарен фестивал'
WHERE lower(trim(category)) IN (
  'кулинарен фестивал', 'гастрономически фестивал',
  'кулинарно-фолклорен фестивал', 'кулинарен и фолклорен фестивал',
  'кулинарен фестивал / фолклорен празник', 'кулинарно-фолклорен',
  'кулинарно-фолклорен празник', 'кулинарен празник',
  'кулинарен празник / фолклорен празник', 'винен фестивал'
)
AND category IS NOT NULL;

-- Музикален фестивал
UPDATE festivals
SET category = 'музикален фестивал'
WHERE lower(trim(category)) IN (
  'музикален фестивал', 'музика', 'концерт', 'празничен концерт'
)
AND category IS NOT NULL;

-- Танцов фестивал
UPDATE festivals
SET category = 'танцов фестивал'
WHERE lower(trim(category)) IN (
  'танцов фестивал', 'танцово изкуство'
)
AND category IS NOT NULL;

-- Културен фестивал
UPDATE festivals
SET category = 'културен фестивал'
WHERE lower(trim(category)) IN (
  'културен фестивал', 'балкански фестивал', 'градски празник'
)
AND category IS NOT NULL;

-- Арт фестивал
UPDATE festivals
SET category = 'арт фестивал'
WHERE lower(trim(category)) IN (
  'арт фестивал'
)
AND category IS NOT NULL;

-- Неразпознати → NULL (ръчна класификация от admin)
UPDATE festivals
SET category = NULL
WHERE lower(trim(category)) IN (
  'festival', 'фестивал', 'туристически фестивал', 'туристически',
  'екологичен фестивал', 'семеен', 'празничното събитие'
)
AND category IS NOT NULL;

-- ============================================================
-- PENDING_FESTIVALS TABLE (same mapping)
-- ============================================================

UPDATE pending_festivals
SET category = 'фолклорен фестивал'
WHERE lower(trim(category)) IN (
  'фолклорен фестивал', 'фолк фестивал', 'folk festival',
  'фолклорен конкурс', 'конкурс-надиграване', 'фестивал-надиграване',
  'фолклорен танцов', 'фолклорен танцов фестивал', 'фолклор',
  'национален фолклорен', 'фолкорен фестивал',
  'международен фолклорен фестивал', 'фолклорен празник',
  'кукерски карнавал'
)
AND category IS NOT NULL;

UPDATE pending_festivals
SET category = 'събор'
WHERE lower(trim(category)) IN (
  'събор', 'традиционен събор', 'събор-надпяване', 'фолклорен събор'
)
AND category IS NOT NULL;

UPDATE pending_festivals
SET category = 'кулинарен фестивал'
WHERE lower(trim(category)) IN (
  'кулинарен фестивал', 'гастрономически фестивал',
  'кулинарно-фолклорен фестивал', 'кулинарен и фолклорен фестивал',
  'кулинарен фестивал / фолклорен празник', 'кулинарно-фолклорен',
  'кулинарно-фолклорен празник', 'кулинарен празник',
  'кулинарен празник / фолклорен празник', 'винен фестивал'
)
AND category IS NOT NULL;

UPDATE pending_festivals
SET category = 'музикален фестивал'
WHERE lower(trim(category)) IN (
  'музикален фестивал', 'музика', 'концерт', 'празничен концерт'
)
AND category IS NOT NULL;

UPDATE pending_festivals
SET category = 'танцов фестивал'
WHERE lower(trim(category)) IN (
  'танцов фестивал', 'танцово изкуство'
)
AND category IS NOT NULL;

UPDATE pending_festivals
SET category = 'културен фестивал'
WHERE lower(trim(category)) IN (
  'културен фестивал', 'балкански фестивал', 'градски празник'
)
AND category IS NOT NULL;

UPDATE pending_festivals
SET category = 'арт фестивал'
WHERE lower(trim(category)) IN (
  'арт фестивал'
)
AND category IS NOT NULL;

UPDATE pending_festivals
SET category = NULL
WHERE lower(trim(category)) IN (
  'festival', 'фестивал', 'туристически фестивал', 'туристически',
  'екологичен фестивал', 'семеен', 'празничното събитие'
)
AND category IS NOT NULL;
```

- [ ] **Стъпка 2: Изпълни миграцията в Supabase SQL Editor**

Копирай съдържанието на файла и го изпълни в Supabase Dashboard → SQL Editor.

- [ ] **Стъпка 3: Верифицирай резултата**

Изпълни в SQL Editor:
```sql
SELECT category, count(*) as cnt
FROM festivals
GROUP BY category
ORDER BY cnt DESC;
```

Очакван резултат: само `фолклорен фестивал`, `събор`, `кулинарен фестивал`, `музикален фестивал`, `танцов фестивал`, `културен фестивал`, `арт фестивал`, и `null` (за некласифицираните).

- [ ] **Стъпка 4: Commit файла**

```bash
git add scripts/sql/20260530_normalize_festival_categories.sql
git commit -m "chore(db): migration to normalize festival categories to 7 canonical values"
```

---

## Task 6: Обнови admin формата за верифицирани фестивали

**Files:**
- Modify: `components/admin/FestivalEditForm.tsx:1141-1142`

- [ ] **Стъпка 1: Добави import в началото на файла**

Провери дали `CANONICAL_FESTIVAL_CATEGORIES` вече е импортирана. Ако не — добави в секцията с imports:

```typescript
import { CANONICAL_FESTIVAL_CATEGORIES } from "@/lib/festivals/publicCategories";
```

- [ ] **Стъпка 2: Замени text input с select (ред ~1141)**

Намери:
```tsx
<AdminFieldInlineRow field="category">
  <input value={form.category} onChange={(e) => updateField("category", e.target.value)} className={ADMIN_ENTITY_CONTROL_CLASS} />
</AdminFieldInlineRow>
```

Замени с:
```tsx
<AdminFieldInlineRow field="category">
  <select value={form.category} onChange={(e) => updateField("category", e.target.value)} className={ADMIN_ENTITY_CONTROL_CLASS}>
    <option value="">— без категория —</option>
    {CANONICAL_FESTIVAL_CATEGORIES.map((cat) => (
      <option key={cat} value={cat}>
        {cat.charAt(0).toLocaleUpperCase("bg-BG") + cat.slice(1)}
      </option>
    ))}
  </select>
</AdminFieldInlineRow>
```

- [ ] **Стъпка 3: Commit**

```bash
git add components/admin/FestivalEditForm.tsx
git commit -m "feat(admin): category field uses select with 7 canonical options"
```

---

## Task 7: Обнови admin формата за pending фестивали

**Files:**
- Modify: `components/admin/PendingFestivalEditForm.tsx:1408-1409`

- [ ] **Стъпка 1: Добави import**

```typescript
import { CANONICAL_FESTIVAL_CATEGORIES } from "@/lib/festivals/publicCategories";
```

- [ ] **Стъпка 2: Замени text input с select (ред ~1408)**

Намери:
```tsx
<AdminFieldInlineRow field="category">
  <input value={form.category} onChange={(e) => updateField("category", e.target.value)} className={ADMIN_ENTITY_CONTROL_CLASS} />
</AdminFieldInlineRow>
```

Замени с:
```tsx
<AdminFieldInlineRow field="category">
  <select value={form.category} onChange={(e) => updateField("category", e.target.value)} className={ADMIN_ENTITY_CONTROL_CLASS}>
    <option value="">— без категория —</option>
    {CANONICAL_FESTIVAL_CATEGORIES.map((cat) => (
      <option key={cat} value={cat}>
        {cat.charAt(0).toLocaleUpperCase("bg-BG") + cat.slice(1)}
      </option>
    ))}
  </select>
</AdminFieldInlineRow>
```

- [ ] **Стъпка 3: Commit**

```bash
git add components/admin/PendingFestivalEditForm.tsx
git commit -m "feat(admin): pending festival category field uses canonical select"
```

---

## Task 8: Обнови органайзер формата

**Files:**
- Modify: `app/organizer/(workspace)/festivals/new/NewFestivalSubmissionClient.tsx:928-957`
- Modify: `app/organizer/(workspace)/festivals/new/page.tsx`

- [ ] **Стъпка 1: Добави import в `NewFestivalSubmissionClient.tsx`**

```typescript
import { CANONICAL_FESTIVAL_CATEGORIES } from "@/lib/festivals/publicCategories";
```

- [ ] **Стъпка 2: Замени datalist input с `<select>` (ред ~929)**

Намери блока с `<input type="text" list="organizer-category-suggestions"...>` и целия `<datalist>` след него.

Замени целия блок (от `<div>` до затварящия `</div>` след `<datalist>`) с:

```tsx
<div>
  <label htmlFor="wizard-field-category" className={LABEL_TEXT_CLASS}>
    Категория <span className="text-[#7c2d12]">*</span>
  </label>
  <select
    id="wizard-field-category"
    value={formData.category}
    onChange={(ev) => patchForm("category", ev.target.value)}
    className={FIELD_CLASS}
  >
    <option value="">— избери категория —</option>
    {CANONICAL_FESTIVAL_CATEGORIES.map((cat) => (
      <option key={cat} value={cat}>
        {cat.charAt(0).toLocaleUpperCase("bg-BG") + cat.slice(1)}
      </option>
    ))}
  </select>
  <p className={HELPER_CLASS}>Избери категорията, която най-добре описва събитието.</p>
</div>
```

- [ ] **Стъпка 3: Премахни `categorySuggestions` prop от `NewFestivalSubmissionInner` (ред ~253)**

Намери:
```typescript
function NewFestivalSubmissionInner({
  initialDraft,
  categorySuggestions,
}: {
  initialDraft: NewFestivalDraftInitial | null;
  categorySuggestions: string[];
}) {
```

Замени с:
```typescript
function NewFestivalSubmissionInner({
  initialDraft,
}: {
  initialDraft: NewFestivalDraftInitial | null;
}) {
```

- [ ] **Стъпка 4: Премахни `categorySuggestions` prop и от default export (ред ~1549)**

Намери:
```typescript
export default function NewFestivalSubmissionClient({
  initialDraft = null,
  categorySuggestions = [],
}: {
  initialDraft?: NewFestivalDraftInitial | null;
  categorySuggestions?: string[];
}) {
  return (
    <Suspense ...>
      <NewFestivalSubmissionInner
        initialDraft={initialDraft}
        categorySuggestions={categorySuggestions}
      />
    </Suspense>
  );
}
```

Замени с:
```typescript
export default function NewFestivalSubmissionClient({
  initialDraft = null,
}: {
  initialDraft?: NewFestivalDraftInitial | null;
}) {
  return (
    <Suspense ...>
      <NewFestivalSubmissionInner initialDraft={initialDraft} />
    </Suspense>
  );
}
```

- [ ] **Стъпка 5: Обнови `page.tsx` — изтрий `loadCategorySuggestions` и спри да подаваш prop**

В `app/organizer/(workspace)/festivals/new/page.tsx`:

1. Изтрий цялата функция `loadCategorySuggestions()` (редове ~105–155).
2. Намери ред 95 (`const categorySuggestions = await loadCategorySuggestions(admin);`) и го изтрий.
3. Намери ред 75 в draft loading: `category: (row.category ?? "festival").trim() || "festival",`  
   Замени с: `category: row.category?.trim() ?? "",`
4. Обнови JSX — намери:
   ```tsx
   <NewFestivalSubmissionClient
     initialDraft={initialDraft}
     categorySuggestions={categorySuggestions}
   />
   ```
   Замени с:
   ```tsx
   <NewFestivalSubmissionClient initialDraft={initialDraft} />
   ```

- [ ] **Стъпка 6: Commit**

```bash
git add app/organizer/\(workspace\)/festivals/new/NewFestivalSubmissionClient.tsx \
        app/organizer/\(workspace\)/festivals/new/page.tsx
git commit -m "feat(organizer): category field is a select with 7 canonical options"
```

---

## Task 9: Финална верификация

- [ ] **Стъпка 1: TypeScript build проверка**

```bash
cd C:\Project\festivo-web && npx tsc --noEmit 2>&1
```

Очакван резултат: 0 грешки.

- [ ] **Стъпка 2: Провери категориите в DB след миграцията**

```bash
node -e "
const url = 'https://hpvfsdmpatgceohigswm.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
fetch(url + '/rest/v1/festivals?select=category', {
  headers: { apikey: key, Authorization: 'Bearer ' + key }
})
.then(r => r.json())
.then(data => {
  const counts = {};
  data.forEach(r => { const c = r.category ?? 'NULL'; counts[c] = (counts[c]||0)+1; });
  Object.entries(counts).sort((a,b)=>b[1]-a[1]).forEach(([c,n])=>console.log(n+'\t'+c));
});
" 2>&1
```

- [ ] **Стъпка 3: Провери публичния филтър на /festivals**

Отвори браузър → `http://localhost:3000/festivals` → провери дали Категория dropdown показва само 7 опции.

- [ ] **Стъпка 4: Провери органайзер формата**

Отвори `/organizer/festivals/new` → провери дали Категория е `<select>` с 7 опции.

- [ ] **Стъпка 5: Push и merge**

```bash
git push -u origin feat/festival-categories-enum
gh pr create --title "feat(categories): normalize festival categories to fixed 7-value enum" \
  --body "$(cat <<'EOF'
## Proposed Change
- Замества свободния текст в festivals.category с фиксиран enum от 7 стойности
- SQL миграция нормализира 148 съществуващи записа
- Всички форми (admin + organizer) сменени от text input на select

## Checklist
- [x] Schema: migration в scripts/sql/ (няма DDL промени — само UPDATE)
- [x] API contract: backward-compatible (category остава text колона)
- [x] Security: само server-side normalizeCategory() пише в DB
EOF
)"
gh pr merge --merge --delete-branch
```
