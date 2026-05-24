# Festival Report — Design Spec

**Дата:** 2026-05-24  
**Статус:** Одобрен

---

## Цел

Потребителите (включително гости) да могат да сигнализират за проблем с информацията на даден фестивал. Сигналите се записват в БД и се изпращат по имейл до admin. Защита от ботове чрез Cloudflare Turnstile и rate limiting.

---

## Data model

### Нова таблица `festival_reports`

```sql
festival_reports (
  id          uuid PRIMARY KEY default gen_random_uuid(),
  festival_id uuid NOT NULL references festivals(id) on delete cascade,
  category    text NOT NULL CHECK (category IN (
                 'wrong_info', 'wrong_location', 'broken_link',
                 'event_cancelled', 'other'
               )),
  message     text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 1000),
  reporter_ip text,           -- SHA-256 hashed IP
  created_at  timestamptz NOT NULL default now(),
  reviewed    boolean NOT NULL default false,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
)
```

**Индекси:** `festival_id`, `created_at DESC`, `reviewed`  
**RLS:** само service role. Анонимни потребители insert-ват единствено през `/api/festivals/[id]/report` с валидиран Turnstile token.

**Миграция:** `scripts/sql/20260524_festival_reports.sql`

---

## API

### `POST /api/festivals/[id]/report` — публичен, без auth

**Стъпки:**
1. Проверява `festival_id` — трябва да съществува в `festivals`
2. Валидира Turnstile token срещу Cloudflare API (`/cdn-cgi/l/email-protection`)
3. Rate limit: max 3 репорта от 1 IP за 10 мин — Upstash Redis (вече в проекта); при пропуснат Redis — fail-open
4. Валидира `category` (enum) и `message` (1–1000 chars)
5. Хешира IP (SHA-256) преди запис
6. Insert в `festival_reports` чрез service role client
7. Enqueue имейл до `EMAIL_ADMIN` с: фестивал, категория, съобщение, дата

**Request body:**
```json
{
  "category": "wrong_info",
  "message": "Датата е грешна...",
  "turnstileToken": "..."
}
```

**Responses:**
- `200 { ok: true }` — успех
- `400` — невалидни данни
- `429` — rate limit exceeded
- `422` — Turnstile failed

---

### `GET /admin/api/festival-reports` — само admin

Query params: `page`, `perPage` (default 50), `reviewed` (`0` | `1` | omit за всички)

Response: `{ rows, total, page, perPage }`

---

### `PATCH /admin/api/festival-reports/[id]` — само admin

Маркира репорт като разгледан.

```json
{ "reviewed": true }
```

---

## Email

Нов тип `festival-report` — регистриран в `emailRegistry.ts` и `emailSchemas.ts`.

**Payload:**
```ts
{
  festivalName: string;
  festivalSlug: string;
  category: string;      // human-readable label
  message: string;
  reportedAt: string;    // ISO
}
```

Изпраща се само ако `EMAIL_ADMIN` е зададен — иначе само записва в БД.

---

## UI компоненти

### Бутон в `FestivalRailActionBar`

Дискретен текстов линк под съществуващите бутони:

```
[ Добави в моя план    ]
[ Отвори в Google Maps ]
  ⚑ Сигнализирай за проблем
```

Стил: `text-xs text-black/40 hover:text-black/70 hover:underline`  
При клик: отваря `ReportFestivalModal`.

---

### `ReportFestivalModal` (нов client component)

**Полета:**
- Dropdown „Категория":
  - Грешна дата, място или цена (`wrong_info`)
  - Фестивалът е отменен (`event_cancelled`)
  - Счупен линк или снимка (`broken_link`)
  - Грешно местоположение на картата (`wrong_location`)
  - Друго (`other`)
- Textarea „Опиши проблема" — placeholder, брояч `n / 1000`, required
- Cloudflare Turnstile widget (managed mode)
- Бутони: „Изпрати" (primary) / „Откажи" (secondary)

**Состояния:**
- `idle` — празна форма
- `submitting` — бутонът е disabled, spinner
- `success` — inline „Благодарим! Ще разгледаме сигнала." (modal остава отворен 2 сек, после се затваря)
- `error` — inline съобщение за грешка

---

### Admin страница `/admin/festival-reports`

Таблица с колони: Фестивал (линк), Категория, Съобщение (truncated), Дата, Статус, Действие.

Филтър: „Всички" / „Чакащи" / „Разгледани"  
Пагинация: 50 реда/страница  
Действие: бутон „Маркирай разгледан" (PATCH към admin API)

---

## Файлова структура

```
scripts/sql/
  20260524_festival_reports.sql       ← migration

app/api/festivals/[id]/
  report/route.ts                     ← POST (публичен)

app/admin/api/
  festival-reports/route.ts           ← GET (admin)
  festival-reports/[id]/route.ts      ← PATCH (admin)

app/admin/(protected)/
  festival-reports/page.tsx           ← admin UI

components/festival/
  ReportFestivalModal.tsx             ← modal компонент

lib/email/
  emailRegistry.ts                    ← добавен 'festival-report' тип
  emailSchemas.ts                     ← добавен schema
```

---

## Извън обхват

- Автоматично потискане на дублирани репорти
- Публично видим статус на репорта
- Репортване от мобилното приложение
