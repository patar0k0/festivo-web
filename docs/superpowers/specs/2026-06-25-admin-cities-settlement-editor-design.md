# Admin: ръчно редактиране на град/село (cities.is_village)

**Дата:** 2026-06-25
**Статус:** Approved

## Контекст

PR #659 поправи системно грешната `cities.is_village` класификация (default `false` →
ингестваните села грешно се показваха като „гр."). Поправката затваря дупката за бъдещи
ingest-нати населени места, но не дава на оператора начин да коригира ръчно бъдещи грешки
без SQL/Supabase MCP. Нужна е минимална admin страница: списък на всички населени места с
възможност за бърза смяна на тип.

## Обхват

**Влиза:**
- Списък на всички ~262 реда от `cities`: `name_bg`, `slug`, `region`, `is_village`.
- Клиентско търсене (по name_bg/slug) + филтър по тип (всички/град/село/без тип).
- Тристъпков inline toggle за `is_village` (Град / Село / Без тип = `NULL`).
- Audit log запис при всяка промяна.

**Не влиза (съзнателно изключено):**
- Редакция на `name_bg`, `slug`, `region` — по-рисково (засяга URL-и, FK repoint, merge
  логика); извън нуждата, която предизвика тази задача.
- Create / delete на `cities` — нови записи вече се създават автоматично през ingest
  resolve (`resolveOrCreateCity`); ръчно изтриване изисква FK repoint на festivals/follows
  (виж follow-up task за счупените дублирани записи от PR #659).
- Сървърна пагинация — 262 реда е малък, практически фиксиран датасет (БГ населени места).
- Отделна admin роля/permission — стандартният admin gate е достатъчен.

## Архитектура

```
app/admin/(protected)/cities/page.tsx   (server component: auth gate + initial fetch)
  → components/admin/CitiesManager.tsx  (client component: search/filter/toggle)
      → PATCH /admin/api/cities          (mutation)
app/admin/api/cities/route.ts            (GET list + PATCH mutation)
lib/admin/adminNavConfig.ts              (нов nav entry в групата "Съдържание")
```

Следва точно модела на `app/admin/(protected)/categories/page.tsx` +
`components/admin/CategoriesManager.tsx` + `app/admin/api/festival-categories/route.ts`.

## Auth

Стандартен admin gate: `getAdminContext()` в page (server) и API route — същия модел като
`categories`. Без отделна роля.

## Данни / API

**`GET /admin/api/cities`**
- Връща `{ cities: Array<{ id, name_bg, slug, region, is_village }> }`, сортирани по
  `name_bg` (Bulgarian locale-aware).
- Цял датасет наведнъж (без пагинация) — payload е малък (~15KB за 262 реда).

**`PATCH /admin/api/cities`**
- Body: `{ id: number, is_village: boolean | null }`.
- Валидация: `id` трябва да съществува в `cities`; `is_village` трябва да е точно
  `true`/`false`/`null` (reject друг тип, напр. string `"true"`).
- На успех: update + `logAdminAction({ action: "update_is_village", entity_type: "city",
  entity_id: String(id), details: { from: previousValue, to: newValue } })` (best-effort,
  не блокира отговора при audit failure — следва съществуващия `logAdminAction` контракт).
- Грешки: невалиден `id` → 404; невалиден тип на `is_village` → 400; admin gate fail → 403.

## UI (`CitiesManager`)

- Текстово търсене (client-side filter по `name_bg`/`slug`, case-insensitive,
  `toLocaleLowerCase("bg-BG")`).
- 4 филтър-чипа: Всички / Град / Село / Без тип.
- Таблица: `name_bg` · `slug` (приглушен текст) · сегментиран 3-бутонен toggle
  (Град/Село/Без тип) вместо dropdown — по-бързо за повтарящи се корекции.
- Optimistic update: клик веднага сменя локалния стейт + изпраща PATCH; при грешка от
  сървъра — revert на toggle-а + inline съобщение за грешка под реда (същия UX модел като
  `is_active` toggle-ите в `CategoriesManager`).
- Без отделен save бутон — всяка промяна е незабавна.

## Edge cases

- Курортни комплекси (Боровец, к.к. Мальовица) се показват като всеки друг ред — admin
  вижда текущото `NULL` и може съзнателно да зададе друг тип, ако реши.
- Конкурентни редакции от двама admin-и: последният запис печели; без оптимистично
  заключване (не си струва сложността за датасет с рядко редактирани 262 реда).
- Невалидни/счупени `name_bg` записи (напр. „Китен и Приморско") се показват както са —
  почистването им е отделен follow-up (FK repoint + merge), не част от тази задача.

## Тестове

- Unit тестове за PATCH route валидацията: невалиден `is_village` тип → 400; невалиден
  `id` → 404; happy path → 200 + audit log call.
- Без UI/component тест — извън конвенцията на проекта за admin manager компоненти
  (`CategoriesManager` също няма unit/UI тест).

## Документация

Без промяна в `PROJECT_CONTEXT.md`/`CLAUDE.md` — UI-only admin tooling около вече
документираната `cities.is_village` колона (документирана в PR #659).
