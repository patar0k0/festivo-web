# Дизайн: Множествени организатори на фестивал (owner + co_host)

**Дата:** 2026-06-01
**Статус:** Draft / awaiting review

## Контекст и проблем

Festivo подкрепя множество организатори на един фестивал чрез `festival_organizers` join таблицата. До момента всички организатори са равнопоставени на ниво данни — нямаме модел кой „притежава" фестивала и кой може да го редактира.

С пускането на organizer portal-а реални хора (`organizer_members`) вече управляват организаторски профили. Възниква въпросът: когато организатор A създаде фестивал и закачи B и V като съ-организатори, какво могат да правят B и V?

## Решение: owner + co_host MVP

Точно **един owner organizer** на фестивал (пълни edit права) + **N display-only co_hosts** (показват се публично, виждат фестивала в dashboard read-only, никакви edit права).

Това е минималистичен MVP, насочен към най-честия реален сценарий: един главен организатор + 1–2 партньора (медия, община, спонсор), които искат само да се покажат.

Co-editor роля (двама равнопоставени редактори) и transfer-of-ownership flow са изрично извън scope-а на тази итерация — заложени са като бъдещо разширение, но не се имплементират сега.

## Схема

### Промени по `festival_organizers`

```sql
alter table festival_organizers
  add column role text not null default 'co_host'
    check (role in ('owner', 'co_host'));

-- Точно един owner на фестивал
create unique index festival_organizers_one_owner
  on festival_organizers (festival_id)
  where role = 'owner';
```

**Семантика:**
- `owner` — пълни права. Точно един на festival (enforced от partial unique index). Може да липсва изобщо (orphan фестивал — admin-managed).
- `co_host` — display-only. Показва се публично, вижда фестивала read-only в dashboard на своя организатор, не може да edit-ва нищо.

### Determination на owner при approve

При `POST /admin/api/pending-festivals/[id]/approve`:

- Ако `pending_festivals.submission_source = 'organizer_portal'` → organizer-ът, посочен от `pending_festivals.organizer_id`, се записва като `owner` в `festival_organizers`. Останалите organizer entries → `co_host`.
- Иначе (admin / ingest / research) → всички organizer entries остават `co_host`. Фестивалът е „orphan" — няма owner. Admin продължава да го управлява през съществуващите admin редактори.

**Защо orphan по default за non-portal sources:** owner-ship носи отговорност (edit права, бъдеща възможност за transfer). Auto-assign-ването му на първия organizer от admin-създаден фестивал означава да дадем edit права на хора, които не са поискали отговорност. По-добре: ясен claim flow през admin по-късно.

## Permission gating (server-side)

### Helper

```ts
// lib/organizer/festivalAccess.ts
type FestivalRole = 'owner' | 'co_host' | null;

async function getUserFestivalRole(
  userId: string,
  festivalId: string
): Promise<FestivalRole>
```

**Логика:**
1. Намери всички `organizers` където user е `active` член в `organizer_members` (`status = 'active'`, ролята в `organizer_members` няма значение тук — owner/admin/editor на organizer профила имат еднакъв ефект върху festival permissions за MVP).
2. Намери реда в `festival_organizers` с този `festival_id` и `organizer_id` ∈ горния списък.
3. Върни `role` (`'owner'` или `'co_host'`) или `null`, ако няма match.

Ако user-ът е свързан с няколко организатора на същия фестивал и един от тях е `owner`, върни `'owner'` (приоритет).

### Endpoints

| Action | Required role |
|---|---|
| `GET /api/organizer/festivals/[id]` (view in dashboard) | `owner` или `co_host` |
| `PATCH /api/organizer/festivals/[id]` (edit content) | `owner` |
| `DELETE /api/organizer/festivals/[id]` | `owner` |
| Edit programme / media endpoints | `owner` |
| Add / remove co_host | `owner` |
| `POST /api/organizer/festivals/[id]/transfer-ownership` (future) | `owner` |

Admin (`is_admin()`) bypass-ва всичко, както е сега.

**RLS забележка:** organizer portal-ът минава през server routes със service-role (вж. `lib/organizer/portal.ts`). Permission проверките са в route handler-ите, не в RLS политики. RLS на `festival_organizers` се запазва както сега.

## UI changes (organizer portal)

### Dashboard — „Моите фестивали"

- Всеки ред: badge **„Собственик"** или **„Съ-организатор"**.
- При `owner`: бутони Edit / View / Delete / Manage co-organizers.
- При `co_host`: само View. View страницата е read-only с бележка „Участвате като съ-организатор. За промени се свържете с [owner organizer name]".

### Edit страница (`/organizer/festivals/[id]/edit`)

- Сървърен guard: ако `getUserFestivalRole(...) !== 'owner'` → 403 или redirect към read-only view.
- Нова секция „Съ-организатори":
  - Списък на текущите `co_host`-ове (име + logo + бутон „Премахни").
  - Бутон „Добави съ-организатор" → autocomplete search по `organizers` таблицата → директно добавя като `co_host`.
  - Placeholder бутон „Прехвърли собствеността" — disabled с tooltip „Скоро" (показваме UI affordance, но flow-ът не е имплементиран).

### Add co-organizer flow

**Директно добавяне без invite/accept.** Owner избира organizer от съществуващите и той става `co_host` веднага. Без notification, без потвърждение от страна на co_host организатора.

Обосновка: `co_host` е display-only, не получава никакви права, така че няма security риск от това, че го „слагат" в списък. Ако co_host организаторът не иска да е там — пише на admin или owner-а го маха.

Invite/accept flow е бъдещо подобрение (особено ако някога добавим co_editor role).

### Публична страница на фестивала

**Без визуална промяна.** `owner` и `co_host`-ове се показват еднакво в текущата секция „Организатори". Целта на co_host: външно равни, вътрешно различни.

## Transfer ownership — бъдещ flow (не имплементиран)

Дизайнът на текущата схема трябва да го издържа без промени по schema-та. Не правим нищо сега, освен placeholder бутона в UI.

**Бъдещ flow:**
1. Owner кликва „Прехвърли собствеността" → избира един от текущите co_hosts.
2. Системата създава ред в нова таблица `ownership_transfer_requests` със статус `pending` + 7-дневен expiry.
3. Notification (push + email) към активните `organizer_members` на target организатора.
4. Target accept/decline от своя dashboard.
5. При приемане: атомарна транзакция → стар owner става `co_host`, нов става `owner`. Записва се audit log в `admin_audit_logs`.

**Защо текущата схема покрива final state-а:**
- `festival_organizers.role` + partial unique index за един owner = correct end state. Transfer = swap на role-ите в транзакция.
- Pending transfers живеят в отделна бъдеща таблица, изолирани от owner-ship модела.

**Какво НЕ правим сега, за да не заковем грешен дизайн:**
- Не добавяме `transfer_pending` статус към `festival_organizers`.
- Не добавяме `previous_owner_id` колона.
- Не правим owner-ship history таблица.

## Миграция на съществуващи данни

Целта: за съществуващи фестивали, за които има ясен submitter през organizer portal, backfill-ваме `role = 'owner'` на този organizer. Всички останали остават `co_host` (default-а от `alter table`).

```sql
-- 1. Default-ът от alter table вече прави всички съществуващи редове co_host.

-- 2. Backfill owner за organizer-portal фестивали.
-- ВАЖНО: точният JOIN зависи от това дали festivals има реална
-- връзка обратно към pending_festivals. Преди писане на migration
-- файла трябва да се валидира на живо в Supabase кой ключ да се ползва
-- (source_pending_id, pending_festival_id, или match по slug/source_url).
-- Ако няма стабилна връзка → backfill-ваме само бъдещи approve-и
-- (т.е. logic-а в approve route handler-а) и оставяме историческите orphan.

update festival_organizers fo
set role = 'owner'
from festivals f
join pending_festivals pf on pf.id = f.<pending_link_column>
where fo.festival_id = f.id
  and fo.organizer_id = pf.organizer_id
  and pf.submission_source = 'organizer_portal';
```

**Open question за migration файла:** как да направим historical backfill ако `festivals` няма колона, която сочи към `pending_festivals`. Опции:
- (a) Pre-migration audit — query-ваме за такава колона; ако няма, се отказваме от backfill-а и оставяме само forward-only логиката в approve route handler-а.
- (b) Best-effort match по `source_url` (където `pending.source_url IS NOT NULL`).

Това се решава при писане на migration файла, **не** в spec-а.

## Out of scope (изрично)

- **Co-editor роля** — двама равнопоставени редактори. Отложено докато не видим реален need.
- **Invite / accept flow** за co_host добавяне.
- **Transfer ownership UI flow** (placeholder бутон „Скоро" е достатъчно за signal).
- **Email / push notifications** при добавяне като co_host.
- **Bulk add** на множество co_hosts наведнъж.
- **Admin UI за reassign на owner** — admin продължава да минава през съществуващите admin/festival редактори, които bypass-ват gating-а.
- **Public UI промяна** — owner / co_host се показват еднакво публично.

## Файлове, които ще се пипат

| Файл / директория | Промяна |
|---|---|
| `scripts/sql/<date>_festival_organizers_role.sql` | Нова migration: колона `role` + partial unique index + backfill |
| `lib/organizer/festivalAccess.ts` | Нов helper `getUserFestivalRole` |
| `app/admin/api/pending-festivals/[id]/approve/route.ts` | При approve, set `role = 'owner'` на submitting organizer (за `submission_source = 'organizer_portal'`) |
| `app/organizer/dashboard/...` | Badge „Собственик" / „Съ-организатор", различни actions per role |
| `app/organizer/festivals/[id]/edit/...` | Server guard за `owner`-only, нова секция „Съ-организатори" |
| `app/api/organizer/festivals/[id]/route.ts` (и дъщерни) | Gate на mutation endpoints |
| `app/api/organizer/festivals/[id]/co-organizers/route.ts` | Нов: add / remove co_host (`owner`-only) |
| `lib/types/database.ts` | Update на типа за `festival_organizers` |
| `docs/system-architecture.md` | Секция „Organizer portal" — нова под-секция за festival-level роли |
| `CLAUDE.md` | Кратко споменаване в Notification / Organizer portal частта (ако се отнася) |

## Success criteria

1. След migration: всички съществуващи `festival_organizers` редове имат валиден `role`. Partial unique index не нарушен (т.е. няма дублирани owner-и на същия фестивал).
2. Organizer portal user, който е `active` член на co_host organizer:
   - вижда фестивала в dashboard-а си с badge „Съ-организатор";
   - **не може** да отвори edit страницата (403);
   - **не може** да call-не PATCH endpoint директно (403).
3. Organizer portal user, който е `active` член на owner organizer:
   - вижда фестивала с badge „Собственик";
   - може да edit-ва съдържание;
   - може да добавя / маха co_hosts;
   - не може да изтрие owner-а на себе си (бутонът за това е disabled / endpoint връща 400).
4. Admin продължава да управлява orphan и portal фестивали безпрепятствено.
5. Публичната страница на фестивала изглежда еднакво за external visitors преди и след migration.
