# Festival Cancellation — Design Spec

**Дата:** 2026-06-02
**Статус:** Одобрен (brainstorming session 2026-06-02)
**Bundle:** Email work — C-priority (отдeлен от Bundle C-rest)

---

## Цел

Когато фестивал бъде отменен, потребителите които са го добавили в плана си трябва да получат **навременно имейл известие** с причината за отмяната. Без този flow риск от негативно user experience: хора пътуват или планират за фестивал, който вече не съществува.

**Не-цели на това PR (постfix постфикс):**
- Postponement / отлагане — отделен lifecycle state, добавя се по-късно
- Push notification channel — отделен job type
- City/organizer follower notifications — out of audience
- Refund/ticketing — Festivo няма ticketing функция

---

## Authorization

Двa flow-а:

| Кой | Откъде | Endpoint |
|---|---|---|
| Admin (всеки) | `/admin/festivals/[id]` modal | `POST /admin/api/festivals/[id]/cancel` |
| Organizer (owner role) | `/organizer/festivals/[id]` modal | `POST /api/organizer/festivals/[id]/cancel` |

Organizer endpoint:
- Изисква `organizer_members.role = 'owner'` за свързания organizer
- Rate limit: 1 cancellation/festival/24h (anti-abuse)
- Admin получава отделен notification email при organizer-trigger

Admin endpoint:
- Стандартна admin role проверка (`hasAdminRole`)
- Без rate limit
- Може да отмени всеки фестивал, не само на конкретен organizer

---

## Data model

Нови колони в `festivals` (отделни от съществуващото `status` поле, което е за catalog moderation):

```sql
ALTER TABLE festivals
  ADD COLUMN lifecycle_state text NOT NULL DEFAULT 'active'
    CHECK (lifecycle_state IN ('active', 'cancelled')),
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN cancellation_reason text,
  ADD COLUMN cancellation_announced_by uuid REFERENCES auth.users(id);

CREATE INDEX festivals_lifecycle_state_idx ON festivals(lifecycle_state)
  WHERE lifecycle_state <> 'active';
```

**Обосновка за enum (вместо boolean):**
Future-proof към `postponed` без втора миграция. Enum гарантира exclusive state (festival НЕ може едновременно cancelled + postponed).

**Migration:** `scripts/sql/20260602_festival_lifecycle_state.sql`

**Дeривирани правила:**
- Cancelled фестивали остават **видими** в каталога (с badge), не са hidden
- Cancelled фестивали се **изключват** от default listing sort priority
- Cancelled фестивали се **изключват** от reminder enqueue (`enqueueSavedFestivalReminderEmail` проверка)
- `archived` status и `cancelled` lifecycle_state са **независими** (festival може да е и двете)

---

## API endpoints

### `POST /admin/api/festivals/[id]/cancel`

**Auth:** admin role (`hasAdminRole`).

**Body:**
```json
{ "reason": "string (20-500 chars, required)" }
```

**Response 200:**
```json
{
  "ok": true,
  "festival_id": "uuid",
  "cancelled_at": "2026-06-02T...",
  "plan_users_notified": 12,
  "admin_alert_sent": true
}
```

**Response codes:**
- `400` invalid reason length
- `404` festival not found
- `409` already cancelled
- `403` not admin

**Side effects (transactional където е възможно):**
1. UPDATE festival → `lifecycle_state='cancelled'`, `cancelled_at=NOW()`, `cancellation_reason`, `cancellation_announced_by=admin_user_id`
2. DELETE FROM `user_plan_reminders` WHERE festival_id = X AND status='pending' (за да не получават reminder)
3. SELECT user_id FROM `user_plan_festivals` WHERE festival_id = X → list of recipients
4. За всеки recipient: INSERT INTO `email_jobs` (type='festival-cancelled', payload, dedupe_key='festival-cancelled:<festival_id>:<user_id>')
5. INSERT admin alert email (type='admin-festival-cancelled', recipient=EMAIL_ADMIN)
6. INSERT INTO `admin_audit_logs` (action='festival_cancel', actor_id=admin_id, target_id=festival_id, metadata)

### `POST /api/organizer/festivals/[id]/cancel`

**Auth:** `requireOrganizerOwnerPortalSession` + проверка че festival.organizer_id корреспондира с organizer където session user има `role='owner'`. Organizer_id НЕ се подава в body — derive-ва се от festival.organizer_id и се валидира срещу session-а.

**Rate limit:** 1 successful cancel per festival per 24h (Upstash).

**Identical body/response/side-effects** с следните различия:
- `cancellation_announced_by` = organizer user id
- Admin alert email включва: organizer name, organizer user id, „cancelled by organizer (not admin)"
- Audit log action='festival_cancel_by_organizer'

### `POST /admin/api/festivals/[id]/uncancel` (reversibility)

**Auth:** admin only (организаторът НЕ може да uncancel — изисква admin oversight).

**Side effects:**
1. UPDATE → lifecycle_state='active', clear cancelled_at/reason/announced_by
2. INSERT admin audit log
3. **НЕ** enqueue-ва „uncancelled" email (би било confusing — user-ите вече са направили нещо с информацията)
4. Plan user-ите могат ръчно да добавят festival-а обратно в плана си

---

## UI surfaces

### A. Admin festival detail page (`/admin/festivals/[id]`)

Нов section вдясно (sidebar):
- Ако `lifecycle_state='active'`: червен бутон **„Отмени фестивал"** → отваря modal
- Ако `lifecycle_state='cancelled'`: показва badge + детайли (дата, причина, кой) + бутон **„Възстанови"** (uncancel)

**Modal — Cancel:**
- Warning header: „N user-и имат този фестивал в плана си. При потвърждаване те ще получат имейл."
- Required textarea: **причина** (placeholder „Кратко обяснение за абонираните потребители — напр. лошо време, проблеми с производството…"), 20-500 chars
- Type-to-confirm: input поле, user-ът трябва да напише точно името на фестивала (като hard delete pattern в `AdminUserDetailActions`)
- Submit button disabled докато reason+confirm не валидни
- POST → ако 200, redirect refresh; ако 4xx/5xx, inline error

**Modal — Uncancel:** просто confirmation, без задължителни полета.

### B. Organizer festival workspace (`/organizer/festivals/[id]` или dashboard)

Аналогичен компонент на admin modal-а, но:
- Tooltip explanation: „След потвърждение, абонираните потребители ще получат имейл. Това не може да се отмени без помощ от admin."
- Без uncancel бутон — само admin може
- Rate limit error message: „Вече сте отменили фестивал в последните 24 часа. Свържете се с admin@festivo.bg при нужда."

### C. Public — festival detail page (`/festivals/[slug]`)

Когато `lifecycle_state='cancelled'`:
- **Червен banner най-горе** (преди hero): „⚠ Този фестивал е отменен" + reason text + cancellation date
- Banner стил: bold border, semantic red (`bg-red-50 border-red-300 text-red-900`)
- Hero secondary CTA „Запази в план" → замeнен с „Виж други в [city] →"
- Schema.org JSON-LD: `Event.eventStatus = "https://schema.org/EventCancelled"` (важно за Google rich results)
- Meta description prefix: „[ОТМЕНЕН] " (за social shares)

### D. Public — listing cards

Card компонент (FestivalCard или listing item):
- Малък „ОТМЕНЕН" badge горе вдясно (red, 11px)
- Image — leichter opacity (0.6) за визуална диференциация
- Hover/click работят нормално — user отива на detail page за повече инфо
- Sort: cancelled фестивали се сортират **след** всички active в default listing (нов sort tier: active → cancelled; рамките на всеки tier — съществуващите rules: promoted → VIP → start_date)

---

## Notification pipeline

```
POST /admin/api/festivals/[id]/cancel (или organizer endpoint)
  │
  ├─ UPDATE festivals SET lifecycle_state='cancelled', ...
  │
  ├─ DELETE FROM user_plan_reminders
  │     WHERE festival_id = X AND status = 'pending'
  │
  ├─ SELECT user_id FROM user_plan_festivals WHERE festival_id = X
  │     ↓ (list of plan_users)
  │
  ├─ For each plan_user:
  │     INSERT INTO email_jobs (
  │       type = 'festival-cancelled',
  │       recipient_email = <resolved from auth.users>,
  │       payload = { festival_title, city, original_date, reason, ... },
  │       dedupe_key = 'festival-cancelled:<festival_id>:<user_id>'
  │     )
  │
  ├─ INSERT email_jobs (admin alert):
  │     type = 'admin-festival-cancelled',
  │     recipient_email = EMAIL_ADMIN,
  │     payload = { festival_title, organizer_name?, cancelled_by_type, reason, plan_users_count }
  │
  └─ INSERT admin_audit_logs
```

**Idempotency:** `dedupe_key` гарантира че retry на същия cancellation не изпраща дубликати.

**Batch size:** заявката за plan users е bounded (един festival типично има <500 plan users в обозримо бъдеще); single batch INSERT. Ако в production се появи festival с 500+ plan users, добавяме pagination.

---

## Email templates (2 нови)

### `emails/templates/FestivalCancelledEmail.tsx`

**Subject:** `⚠ „{festival_title}" е отменен`

**Layout:**
- BaseLayout с **червен** accent bar (override на default brand color за severity)
- H1: „Фестивалът е отменен"
- Lead: „**{festival_title}** е в твоя план, но е отменен от организатора."
- Info card (EmailInfoRow):
  - Дата (оригинална)
  - Място
  - Отменен на: {cancellation_date}
- Reason block: цитат от cancellation_reason
- CTA1 (primary):
  - Ако `cityDisplay` ≠ null: „Виж други фестивали в {city} →" → `/festivals?city=...`
  - Ако city е null: „Разгледай каталога →" → `/festivals`
- CTA2 (secondary, inline link): „Намери алтернативи в {month} →" → `/calendar?month=...` (month взет от original_date)
- Hr
- Footer (стандартен): „Получаваш това, защото беше запазил фестивала в твоя план. [Manage preferences] [Unsubscribe]"

**Payload schema (in `emailSchemas.ts`):**
```ts
{
  festivalTitle: string,
  cityDisplay: string | null,
  originalDateDisplay: string,
  cancellationDateDisplay: string,
  cancellationReason: string,
  alternativesUrl: string,    // /festivals?city=...
  calendarUrl: string,        // /calendar?month=...
  unsubscribeUrl?: string,
  managePreferencesUrl?: string,
}
```

### `emails/templates/AdminFestivalCancelledEmail.tsx`

**Subject:** `Festivo админ — отменен фестивал: „{festival_title}"`

**Layout:**
- BaseLayout, neutral accent
- H1: „Отменен фестивал"
- Info rows:
  - Festival: link към `/admin/festivals/[id]`
  - Cancelled by: „Admin (Иван П.)" или „Organizer (Мария Г.)"
  - Reason (full)
  - Plan users notified: N
  - Cancelled at: timestamp
- CTA: „Отвори в admin →"

**Payload schema:**
```ts
{
  festivalTitle: string,
  festivalAdminUrl: string,
  cancelledByType: 'admin' | 'organizer',
  cancelledByDisplay: string,
  organizerName: string | null,  // null if admin-triggered
  cancellationReason: string,
  planUsersCount: number,
  cancelledAt: string,
}
```

### Email registry/schemas updates

- `lib/email/emailJobTypes.ts` → add `EMAIL_JOB_TYPE_FESTIVAL_CANCELLED`, `EMAIL_JOB_TYPE_ADMIN_FESTIVAL_CANCELLED`
- `lib/email/emailSchemas.ts` → add `parseFestivalCancelledPayload`, `parseAdminFestivalCancelledPayload`
- `lib/email/emailRegistry.ts` → register both
- `lib/email/emailTypeCategory.ts` → categorize (user-transactional + admin-alert)

### Email preference gating

`festival-cancelled` (user-facing) → **fail-open** на preference lookup (важно transactional email — user МУСТ да получи)

`admin-festival-cancelled` → не подлежи на user preferences (admin alert)

---

## Reversibility / Edge cases

| Сценарий | Поведение |
|---|---|
| Admin uncancel | Lifecycle → 'active'. НЕ изпраща „uncancelled" email. Plan users могат ръчно да добавят обратно. |
| Organizer опитва втори cancel в 24h | 429 rate limit error. |
| Organizer опитва cancel, не е owner | 403 forbidden. |
| Cancel на festival с 0 plan users | Успех, само admin alert се изпраща. |
| Festival е вече cancelled | 409 conflict, без side effects. |
| Festival е `archived` (но не cancelled) | Cancel е възможен, но семантично странно — UI показва warning. |
| Email enqueue failure (един от 12 fails) | Rest продължават (per-row error handling), audit log записва частичен success. |
| Push notifications | Out of scope. Бъдещ feature ще ползва същия trigger. |

---

## Out of scope (за бъдещи PR)

- **Postponement** lifecycle state — добавя се с миграция: `CHECK (lifecycle_state IN ('active', 'cancelled', 'postponed'))` + `postponed_to_date` field + нов email template
- Push notification channel — нов `notification_jobs.type = 'cancellation'` + push template
- City/organizer follower secondary notifications
- Cancellation analytics dashboard
- Bulk cancel (за weather emergencies покриващи N фестивала наведнъж)

---

## Files touched

| Файл | Action |
|---|---|
| `scripts/sql/20260602_festival_lifecycle_state.sql` | new |
| `lib/festival/lifecycle.ts` (helper) | new |
| `app/admin/api/festivals/[id]/cancel/route.ts` | new |
| `app/admin/api/festivals/[id]/uncancel/route.ts` | new |
| `app/api/organizer/festivals/[id]/cancel/route.ts` | new |
| `lib/festival/cancelFestival.ts` (shared business logic) | new |
| `components/admin/FestivalCancelDialog.tsx` | new |
| `components/organizer/OrganizerFestivalCancelDialog.tsx` | new |
| `app/admin/(protected)/festivals/[id]/page.tsx` | modify — add cancel section |
| `app/organizer/.../festivals/[id]/page.tsx` | modify — add cancel button |
| `app/festivals/[slug]/page.tsx` | modify — banner + Schema.org `eventStatus` |
| `components/festivals/FestivalCard.tsx` | modify — cancelled badge |
| `emails/templates/FestivalCancelledEmail.tsx` | new |
| `emails/templates/AdminFestivalCancelledEmail.tsx` | new |
| `lib/email/emailJobTypes.ts` | modify — add 2 types |
| `lib/email/emailSchemas.ts` | modify — add 2 schemas |
| `lib/email/emailRegistry.ts` | modify — register 2 types |
| `lib/email/emailTypeCategory.ts` | modify — categorize |
| `lib/email/emailPreferences.ts` | modify — `festival-cancelled` fail-open |
| `lib/queries.ts` (listing sort) | modify — deprioritize cancelled |
| `lib/festival/enqueueSavedFestivalReminderEmail.ts` | modify — skip cancelled |
| `LAUNCH_CHECKLIST.md` | modify — add new item, mark complete |

**Tests:**
- `lib/festival/cancelFestival.test.ts` — business logic
- `app/admin/api/festivals/[id]/cancel/route.test.ts` — endpoint integration
- `app/api/organizer/festivals/[id]/cancel/route.test.ts` — organizer endpoint with rate limit
- Schema migration smoke test

---

## Time estimate

**Implementation:** ~6-8 часа активна работа.

| Етап | Време |
|---|---|
| Schema migration + helper | 30 мин |
| 3 API endpoints + shared logic + tests | 2 ч |
| Admin modal + organizer modal | 1 ч |
| 2 email templates + registry wiring | 1.5 ч |
| Public UI (banner + listing badge + Schema.org) | 1 ч |
| Reminder skip logic + listing sort tweak | 30 мин |
| Manual QA + edge case verification | 1 ч |

---

## Success criteria

✅ Admin може да отмени фестивал от `/admin/festivals/[id]`
✅ Organizer (owner role) може да отмени свой фестивал
✅ Plan users получават branded email с reason
✅ Admin получава audit email
✅ Cancelled фестивал показва banner в public detail
✅ Cancelled фестивал не получава reminder email
✅ Schema.org `eventStatus=EventCancelled` се рендерира коректно (Google rich result test)
✅ Admin може да uncancel при грешка
✅ Organizer rate limit предотвратява abuse
✅ Idempotency: повторен cancel attempt не дублира emails
✅ Listing sort деприоритизира cancelled
