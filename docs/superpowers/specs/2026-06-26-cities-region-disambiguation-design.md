# Инфраструктура за разграничаване на едноименни населени места (region)

**Дата:** 2026-06-26
**Статус:** Approved

## Контекст

България има множество села с еднакво име в различни общини (напр. „Розино"). В
`cities` таблицата `name_bg` има `UNIQUE` constraint **само по себе си** — днес е
физически невъзможно да съществуват два реда със същото име, независимо от региона.

И двата текущи resolver-а (`lib/admin/resolveOrCreateCity.ts`,
`lib/admin/resolveCityReference.ts`) търсят по `slug`, който е детерминиран **само**
от името. При второ село с вече съществуващо име, resolver-ът намира съществуващия
(грешен) ред по slug **преди** да опита insert — т.е. тихо misattribution, не crash.

**Важно установено ограничение:** никой ingest path (FB events, poster OCR, Gemini
research extraction, admin форма) не извлича/подава регионален сигнал днес. Без вход
за сравнение, resolver логиката **не може** да бъде поправена да разпознава
двусмислие — няма две съвпадения за избор, има само едно (грешно) съвпадение по slug.
AI extraction промени за добавяне на regional сигнал са изрично извън обхвата на тази
задача (по избор на потребителя).

## Обхват

**Влиза:**
- Migration: разхлабва `UNIQUE(name_bg)` → `UNIQUE(name_bg, region)`. `slug` остава
  глобално уникален непроменен (URL-path инвариант).
- `PATCH /admin/api/cities`: приема опционално `region: string | null` редом до
  съществуващото `is_village` (поне едно от двете задължително присъства в body).
- `CitiesManager.tsx`: нова колона „Регион" с текстов инпут + explicit бутон „Запази"
  на ред, optimistic update + rollback при грешка (споделя `pendingIds`/`errorById`
  state с `is_village` toggle-а — per-row, не per-field).

**Не влиза (съзнателно изключено):**
- Промяна на resolver логиката (`resolveOrCreateCity.ts`, `resolveCityReference.ts`)
  — не е решимо без regional сигнал от ingest, който е изрично извън обхват.
- AI extraction промени (Gemini prompt, poster schema) за извличане на regional данни.
- UI за създаване на нов `city` ред — нови записи продължават да се създават само през
  ingest resolve; реален бъдещ дублат се добавя ръчно през SQL/Supabase MCP, използвайки
  вече отключения constraint.

## Migration

Файл: `scripts/sql/20260626_cities_name_region_unique.sql`

```sql
alter table public.cities drop constraint if exists cities_name_bg_key;
alter table public.cities add constraint cities_name_region_key unique (name_bg, region);
```

Чисто оптимистична — всичките 262 съществуващи реда имат `region = NULL` днес, без
конфликт за `DROP`+`ADD CONSTRAINT`. (Постгрес third-party note: `NULL` не се третира
като равен на `NULL` в `UNIQUE`, значи редове с еднакво име И двата `NULL` region НЕ
ще се блокират един друг — приемливо, защото `slug` constraint-ът продължава да пречи
на истински дубликати по тихия автоматичен ingest път; новият constraint отключва само
**ръчно** създаване на втори ред с различен `region`.)

## API: `PATCH /admin/api/cities`

Body: `{ id: number, is_village?: boolean | null, region?: string | null }`.

- Поне едно от `is_village`/`region` трябва да присъства → 400 ("nothing to update")
  ако никое от двете не е в body.
- `region` нормализация: `trim()`; празен низ (`""`) → `null` (за да няма двойна
  семантика между `""` и `NULL` в новия unique constraint).
- Audit log (`logAdminAction`): `details` включва **само** действително изпратените
  полета — `{ is_village?: {from, to}, region?: {from, to} }`. Не пишем поле, което не
  е било в request body.
- Грешки: невалиден тип на `is_village`/`region` → 400; невалиден `id` → 404; admin
  gate fail → 403 (непроменено от съществуващата логика).

## UI: `CitiesManager.tsx`

- Нова колона „Регион": текстов инпут с локален draft state (отделен от `cities`
  state, за да не PATCH-ва на всеки keystroke).
- Бутон „Запази" до инпута: disabled докато draft стойността съвпада с текущо
  записаната, или докато редът е в `pendingIds`.
- При клик: optimistic update на `cities` state + PATCH; при грешка — rollback на
  стария `region` + error message (същия модел като `is_village` toggle-а).
- `pendingIds`/`errorById` са споделени между `is_village` toggle и `region` save
  бутон (per-row, не per-field) — докато тече заявка за едното поле, целият ред
  (toggle + save бутон) е disabled. Приемлива simplification — мутациите са редки и
  бързи.

## Тестове

- Разширяване на `app/admin/api/cities/route.test.ts` (PATCH тестове):
  - body без `is_village` И без `region` → 400.
  - невалиден тип на `region` (не string, не null) → 400.
  - happy path само с `region` → audit log `details` съдържа **само** `region` ключ.
  - happy path с двете полета → audit log `details` съдържа и двете.
  - `region: ""` се записва като `null`.
- Без UI тест за новата колона — запазва конвенцията от `CitiesManager.tsx`.

## Документация

Без промяна в `CLAUDE.md`/`PROJECT_CONTEXT.md` — продължение на вече документираната
`cities.is_village`/admin editor работа от PR #664; resolver-ите остават изрично
недопрени, документирано тук като известно ограничение.
