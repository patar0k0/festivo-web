# /admin/organizers/duplicates — подобрения

**Дата:** 2026-06-03
**Статус:** одобрен дизайн, предстои implementation plan

## Контекст

`/admin/organizers/duplicates` показва кандидати за дублирани организатори и позволява ръчен merge. Текущо:

- **Детекция** ([app/admin/(protected)/organizers/duplicates/page.tsx](../../../app/admin/(protected)/organizers/duplicates/page.tsx)) — само точни съвпадения по 3 нормализирани полета: `name`, `slug`, `facebook_url` (bucket-базирано).
- **UI** ([components/admin/OrganizerDuplicatesTable.tsx](../../../components/admin/OrganizerDuplicatesTable.tsx)) — таблица с ляв/десен организатор, причини, два merge бутона. Проблеми: дублиран `<h1>`, имената не са линкове, няма брой фестивали/лого/описание за сравнение, merge е с едно кликване (необратим), няма отхвърляне на фалшиви двойки.
- **Merge API** ([app/admin/api/organizers/merge/route.ts](../../../app/admin/api/organizers/merge/route.ts)) — коректен: fill-null-only на target, мести `festival_organizers` / `festivals` / `pending_festivals`, audit log, `merged_into`. **Не се променя.**

## Цели

1. Хващане на повече дубликати (детерминистична bucket-детекция, без O(n²)).
2. По-безопасен merge (видимост + двустъпково потвърждение).
3. Отхвърляне на фалшиви двойки (персистентно).

Извън обхват: промяна на merge логиката; Levenshtein/fuzzy на свободен текст.

---

## Част 1 — По-добра детекция

Запазваме текущите 3 точни съвпадения като **high confidence**. Добавяме слой **medium confidence**, всичко bucket-базирано (O(n)).

### Нови нормализатори (в `lib/admin/organizerNormalization.ts`)

| Функция | Логика | Reason етикет |
|---|---|---|
| `normalizeOrganizerNameAggressive(name)` | взима `normalizeOrganizerNameForMatch`, после маха всичко освен букви (вкл. кирилица) и цифри; lowercase `bg-BG`; `null` ако празно | `similar name (normalized)` |
| `extractWebsiteDomain(url)` | парсва URL, връща hostname без водещ `www.`, lowercase; `null` при невалиден | `same website domain` |
| `extractEmailDomain(email)` | дясната част след последния `@`, lowercase, trim; `null` ако няма `@` | `same email domain` |

`page.tsx` добавя `select` на `website_url`, `email` към заявката и три нови `bucketize(...)` извиквания.

### Confidence

Тип `DuplicateRow` получава поле `confidence: "high" | "medium"`:
- `high` — двойката има поне една причина от точните три (`exact normalized name` / `exact slug` / `exact facebook_url`).
- `medium` — само нови причини.

Изчислява се след събиране на причините. Сортиране: high преди medium, после по `reasons.length` desc, после по име.

UI показва бадж (high = тъмен/плътен, medium = по-блед).

---

## Част 2 — По-безопасен merge

Промени само в `page.tsx` (данни) и `OrganizerDuplicatesTable.tsx` (UI). Merge API непроменено.

### Брой фестивали

В `page.tsx`, след `buildDuplicateRows`:
1. Събери множеството organizer id-та, участващи в показаните двойки.
2. Една заявка: `festival_organizers.select("organizer_id").in("organizer_id", ids)`.
3. Преброй в паметта → `Map<organizerId, number>`.
4. Подай броевете към таблицата (напр. разшири `OrganizerRow` с `festivalCount`).

Това е сигнал за „богатство", не строга истина (фестивали се свързват и през `festivals.organizer_id`, и през `festival_organizers`); за целта на сравнението броят от `festival_organizers` е достатъчен.

### UI на реда

- Името → линк към `/admin/organizers/[id]`, `target="_blank"`.
- Под името: „N фестивала".
- Сравнителни редове: лого (малка `<img>` ако има `logo_url`), отрязано описание, `website_url` / `email` / `phone`. (page.tsx добавя тези полета в `select`.)
- Дублираният `<h1>` в таблицата се маха (заглавието остава само в `page.tsx`).
- Текст на български, в тон с останалия admin.

### Двустъпков merge

Състояние в компонента: `confirming: { sourceId, targetId } | null`.
- Клик на „Merge A → B" → задава `confirming`, разгъва инлайн панел в реда:
  > „**A** ще се слее в **B**. A се деактивира (`is_active=false`). N фестивала се местят към B. Действието е необратимо."
  + бутони **Потвърди** (вика съществуващия `merge(source, target)`) и **Откажи** (нулира `confirming`).
- Докато тече заявка — disabled, „Сливане…".
- Без native `confirm()`.

---

## Част 3 — Отхвърляне на двойки

### Миграция `scripts/sql/20260603_organizer_duplicate_dismissals.sql`

```sql
create table if not exists public.organizer_duplicate_dismissals (
  id uuid primary key default gen_random_uuid(),
  organizer_a uuid not null references public.organizers(id) on delete cascade,
  organizer_b uuid not null references public.organizers(id) on delete cascade,
  dismissed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint organizer_duplicate_dismissals_ordered check (organizer_a < organizer_b),
  constraint organizer_duplicate_dismissals_unique unique (organizer_a, organizer_b)
);

create index if not exists idx_org_dup_dismissals_b
  on public.organizer_duplicate_dismissals (organizer_b);

alter table public.organizer_duplicate_dismissals enable row level security;
-- Без публични политики: достъп само през service-role (admin). RLS заключва anon/authenticated.
```

- Каноничен ред: винаги `organizer_a = min(id)`, `organizer_b = max(id)` (UUID lexical) — `check` го гарантира; кодът подрежда преди insert.
- `unique` → идемпотентен dismiss.
- Индекс по `organizer_a` идва от unique-а; добавяме отделен по `organizer_b` за обратни справки/cascade.

### API `app/admin/api/organizers/duplicates/dismiss/route.ts`

- Admin-gated (`getAdminContext`), service-role клиент.
- `POST { a, b }` → подрежда канонично → `upsert` (или insert ignore on conflict) с `dismissed_by = ctx.user.id`. `logAdminAction("organizer.duplicate_dismissed")`.
- `DELETE { a, b }` → подрежда канонично → изтрива реда. `logAdminAction("organizer.duplicate_dismissal_restored")`.
- Връща `{ ok: true }`.

### Интеграция в `page.tsx`

- Зареди всички dismissals → `Set<pairKey>`.
- Филтрирай двойките: ако `pairKey(left.id, right.id)` е в множеството → изключи от активния списък, но събери в отделен `dismissedRows` (с имената за показване).
- Подай `dismissedRows` към таблицата.

### Интеграция в `OrganizerDuplicatesTable.tsx`

- Нов бутон на всеки активен ред: **„Не са дубликати"** → `POST` dismiss → reload (или оптимистично махане).
- Долу сгъната секция **„Отхвърлени двойки"** (ако има) с бутон **„Върни"** → `DELETE` → reload.
- При merge не пишем dismissal — source става неактивен и двойката изчезва естествено.

---

## Файлове, които се пипат

| Файл | Промяна |
|---|---|
| `lib/admin/organizerNormalization.ts` | + 3 нормализатора |
| `app/admin/(protected)/organizers/duplicates/page.tsx` | нови select полета, нови bucket-и, confidence, festival counts, зареждане/филтриране на dismissals |
| `components/admin/OrganizerDuplicatesTable.tsx` | confidence бадж, линкове, festival count, сравнителни полета, двустъпков merge, dismiss/restore, махнат дублиран h1, BG текст |
| `app/admin/api/organizers/duplicates/dismiss/route.ts` | **нов** POST/DELETE |
| `scripts/sql/20260603_organizer_duplicate_dismissals.sql` | **нова** миграция (таблица + индекс + RLS) |

Merge API ([app/admin/api/organizers/merge/route.ts](../../../app/admin/api/organizers/merge/route.ts)) — **без промяна**.

## Тестване / верификация

- Детекция: unit-тест на новите нормализатори (вход → очакван ключ) ако има тестова инфраструктура; иначе ръчна проверка с примери.
- Миграцията се прилага в Supabase преди UI да я ползва.
- Ръчна проверка на страницата: confidence баджове, festival counts, двустъпков merge, dismiss → изчезва, restore → връща се.
