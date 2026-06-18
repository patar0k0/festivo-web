# Дублирани фестивали: fuzzy откриване + сливане (merge)

**Дата:** 2026-06-18
**Статус:** Спецификация (за одобрение)

## Контекст и проблем

Страницата `/admin/festivals/duplicates`
([page.tsx](../../../app/admin/(protected)/festivals/duplicates/page.tsx))
открива дубликати само чрез **точно съвпадение** на нормализирано заглавие
(+ дата/град/slug). Реален случай, който НЕ се хваща:

- „Фолклорен **танцов** фестивал „С танците на дедите ни" 2026"
- „Фолклорен фестивал „С танците на дедите ни" 2026"

Разликата е една дума („танцов") → заглавията не влизат в един bucket → 0 двойки.

Освен това **няма функция за сливане**. Страницата дава само линкове
„Редактирай #1/#2". Снимки, програма, последователи не се обединяват.

## Цели

1. **Fuzzy откриване** — да хваща близки заглавия (добавена/липсваща дума).
2. **Сливане (merge)** — админът избира победител; свързаните данни се
   прехвърлят; загубилият се **архивира** (не се трие).

## Решения (потвърдени с потребителя)

| Тема | Решение |
|---|---|
| Fuzzy метод | **Токен-базиран containment** (множество думи) |
| Победител | **Админ избира**; загубилият → `status=archived` (обратимо) |
| Полета | Победителят запазва своите; **празните се пълнят** от загубилия (fill-null) |
| Снимки/последователи/организатори | **Адитивно** прехвърляне с дедупликация |

## Засегнати таблици (FK към `festivals`)

| Таблица | Връзка | Поведение при merge |
|---|---|---|
| `festival_media` (снимки/галерия) | `festival_id` | Адитивно, дедуп по `url` |
| `festival_days` (+ `festival_schedule_items` чрез `day_id`) | `festival_id` | Fill-null: repoint само ако победителят няма дни |
| `festival_organizers` (m2m) | `festival_id` + unique(`festival_id`,`organizer_id`) | Адитивно, дедуп |
| `user_plan_festivals` (последователи/планове) | PK(`user_id`,`festival_id`) | Адитивно, дедуп |
| `festival_likes` | PK(`user_id`,`festival_id`) | Адитивно, дедуп |
| `user_notifications` | unique(`user_id`,`festival_id`,`scheduled_for`) | Repoint, дедуп по конфликт |
| `user_plan_reminders` | `festival_id` | Repoint |
| `notification_jobs` | `festival_id` | Repoint |
| `outbound_clicks`, `analytics_events`, `festival_reports` | `festival_id` | Repoint (статистиката отива при победителя) |

## Архитектура

Три части + една миграция.

### 0. Миграция

`scripts/sql/20260618_festivals_merged_into.sql`

```sql
alter table public.festivals
  add column if not exists merged_into_festival_id uuid
  references public.festivals(id) on delete set null;

create index if not exists festivals_merged_into_idx
  on public.festivals (merged_into_festival_id)
  where merged_into_festival_id is not null;

comment on column public.festivals.merged_into_festival_id is
  'Когато е попълнено: този фестивал е слят в посочения и е архивиран.';
```

Целта: одит + бъдещо 301-пренасочване от архивирания slug към победителя.
RLS не се променя (колоната е видима само за admin/service-role четенето,
което вече покрива таблицата).

### 1. Fuzzy откриване (pure модул + страница)

Логиката от `buildDuplicateRows` се изнася в **тестваем** чист модул
`lib/admin/festivalDuplicates.ts` (входни редове → двойки). Страницата само
извиква модула.

Добавя се **fuzzy pass** върху съществуващите точни сигнали:

- Токенизация на нормализираното заглавие: split по интервали, премахват се
  токени с дължина < 2 и кратък stopword списък (`на`, `и`, `за`, `с`, `в`,
  `от`, `до`).
- За двойка с **≥ 2** токена всяка: `containment = |A ∩ B| / min(|A|, |B|)`.
- Кандидат за дубликат, ако `containment ≥ 0.8` **И** (същия `city_id` ИЛИ
  същата `start_date`). Гейтът ограничава фалшивите положителни и цената.
- Нов сигнал/етикет: `"близко заглавие"` (нов цвят в `SIGNAL_COLORS`).

317 фестивала → pairwise сравнението е тривиално по цена; гейтът по град/дата
допълнително го свива.

### 2. Merge backend

`POST /admin/api/festivals/merge` — admin-gated (`getAdminContext`),
service-role клиент. Тяло: `{ winnerId, loserId }`.

Стъпки (деца първо, архивиране последно — за да е възстановимо при частичен
провал; supabase-js няма транзакция между заявки, документира се):

1. Зареди двата фестивала; валидирай: съществуват, различни, `loser` не е вече
   слят.
2. **Fill-null patch** върху победителя — чист хелпър
   `computeFillNullPatch(winner, loser)`: за фиксиран списък колони, ако
   стойността на победителя е `null`/празна и загубилият има стойност → копира
   я. Никога не презаписва. `tags` се обединяват като union с дедуп.
3. **Прехвърляне на свързани данни** според таблицата по-горе (адитивно с
   дедуп / repoint / fill-null за програма).
4. **Архивирай** загубилия: `status='archived'`,
   `merged_into_festival_id=winnerId`, `updated_at`.
5. Одит лог: `festival.merged` с `{ winner_id, loser_id, moved: {...} }`.
6. Връща `{ ok, redirect_to: '/admin/festivals/{winnerId}' }`.

Чистите хелпъри (`computeFillNullPatch`, токен-съвпадение) живеят в `lib/` и са
покрити с unit тестове.

### 3. Merge UI

В [FestivalDuplicatesTable.tsx](../../../components/admin/FestivalDuplicatesTable.tsx):

- Нов бутон **„Слей"** на всяка двойка → отваря inline панел/модал.
- Панелът: radio избор на победител (default = `verified` пред `draft`, после
  по-старият по `start_date`/създаване), кратко предупреждение
  „снимки, програма, организатори и последователи се прехвърлят към избрания;
  другият се архивира", бутони „Откажи" / „Потвърди сливане".
- При потвърждение → `POST` към merge route; при успех `router.refresh()`.
- Без избор поле-по-поле (YAGNI) — fill-null покрива нуждата.

## Грешки и крайни случаи

- Един и същ id за двата → 400.
- Loser вече архивиран/слят → 409.
- Частичен провал по средата: децата вече преместени остават при победителя,
  loser **не** се архивира (остава видим) → админът може да повтори; повторното
  изпълнение е идемпотентно за вече преместени редове (дедуп/`merged_into` гард).
- `user_notifications` конфликт по unique → изтрий дублиращите редове на loser
  преди repoint.

## Тестове

- Unit: токен containment (хваща „танцов" случая; отхвърля несвързани).
- Unit: `computeFillNullPatch` (не презаписва попълнени; пълни празни; union на
  tags).
- Ръчна проверка в prod admin (UI е auth + service-role gated — без локален
  preview, виж memory).

## Извън обхвата (YAGNI)

- 301 redirect от архивиран slug (колоната `merged_into_festival_id` подготвя
  това за по-късно).
- Избор поле-по-поле в UI.
- Автоматично сливане без админ.
