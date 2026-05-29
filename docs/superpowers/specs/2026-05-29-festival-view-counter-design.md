# Festival view counter (v1) — design

**Status:** approved
**Date:** 2026-05-29
**Owner:** admin product
**Scope:** launch-week minimum; full analytics dashboard deferred to post-launch v2

## Goal

Един admin може да отвори страницата на даден фестивал и да види **колко пъти е гледан** (за последните 30 дни и общо). Гледанията **не** трябва да включват самия admin/staff трафик, ботове, или повтарящи се refresh-и от един и същ потребител.

Целта на v1 е да започнем да трупаме чисти данни и да дадем на admin minimal visibility — нищо повече. Пълният analytics dashboard (графики, trending, conversion funnels) идва във v2 след launch.

## Non-goals (v1)

- Графики / time-series visualization
- Колона „Гледания" в admin таблицата с фестивали
- Conversion funnels (view → save → click-out)
- Search query tracking, geo distribution, source attribution
- Materialized aggregate tables
- Real-time counters

Всички тези са планирани за v2 — виж секцията „Post-launch (v2) backlog" в края.

## Architecture

Системата има 3 части: client tracker, server-side write filter, admin-only read display.

```
┌──────────────────────┐    POST /api/analytics/track
│  /festivals/[slug]   │    { event: "festival_view",
│   <TrackFestivalView>│      festival_id, slug, source: "web" }
│   (client component) │ ──────────────────────────────────────┐
└──────────────────────┘                                       │
                                                               ▼
                                              ┌─────────────────────────────┐
                                              │  /api/analytics/track       │
                                              │  Filters (silent ok=true):  │
                                              │   - admin/staff role        │
                                              │   - bot User-Agent          │
                                              │   - same user_id in 24h     │
                                              │     for this festival       │
                                              └─────────────┬───────────────┘
                                                            │ insert
                                                            ▼
                                              ┌─────────────────────────────┐
                                              │   public.analytics_events   │
                                              │  (already exists, RLS-safe) │
                                              └─────────────┬───────────────┘
                                                            │ SELECT count
                                                            │ when viewer is admin
                                                            ▼
                                              ┌─────────────────────────────┐
                                              │  Festival detail page       │
                                              │  shows admin-only badge:    │
                                              │  "👁 547 / 30d · 1.2k total"│
                                              └─────────────────────────────┘
```

## Components

### 1. `<TrackFestivalView />` — client component

Място: `components/festival/TrackFestivalView.tsx` (нов файл).

Поведение:
- Изпълнява се веднъж при mount чрез `useEffect`.
- Проверява `localStorage.getItem('fv:' + festivalId)` → ако stored timestamp е < 24 часа назад, no-op.
- Иначе:
  - Записва `localStorage.setItem('fv:' + festivalId, Date.now().toString())`.
  - Изпраща `POST /api/analytics/track` с тяло `{ event: "festival_view", festival_id, slug, source: "web" }`.
  - `keepalive: true`, `credentials: "include"`. Fail-safe (никога не хвърля).

Render: нищо (`return null`).

Place в дървото: най-горе в `/festivals/[slug]/page.tsx`, преди rest на content-а. Server component-ът подава `festivalId` и `slug` като props.

**Защо client component, не server-side trigger:** SSR се изпълнява и при prefetch (mouseover на Link), при revalidation, при някои bot crawls — били биха надули цифрите. Client `useEffect` се изпълнява само в реален браузър след hydration.

### 2. Server-side filters в `/api/analytics/track`

Файл за модификация: `app/api/analytics/track/route.ts`.

Логика преди INSERT:

```ts
const userAgent = request.headers.get("user-agent") ?? "";
const BOT_UA_REGEX = /(?:Googlebot|bingbot|YandexBot|Baiduspider|AhrefsBot|SemrushBot|DotBot|MJ12bot|PetalBot|facebookexternalhit|Twitterbot|LinkedInBot|Slackbot|TelegramBot|WhatsApp|Discordbot|Pinterest|HeadlessChrome|Lighthouse)/i;

if (BOT_UA_REGEX.test(userAgent)) {
  return NextResponse.json({ ok: true }, { status: 200 }); // silent drop
}

// Admin/staff exclusion — only for festival_view (not for push_open etc.)
if (event === "festival_view" && user_id) {
  const { data: roleRows } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", user_id);
  const isStaff = roleRows?.some((r) => r.role === "admin" || r.role === "super_admin");
  if (isStaff) {
    return NextResponse.json({ ok: true }, { status: 200 }); // silent drop
  }

  // Per-user 24h dedup — same user, same festival, last 24h
  if (festival_id) {
    const { data: existing } = await supabaseAdmin
      .from("analytics_events")
      .select("id")
      .eq("user_id", user_id)
      .eq("festival_id", festival_id)
      .eq("event", "festival_view")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(1);
    if (existing && existing.length > 0) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }
  }
}
```

**Fail-open принцип:** ако някоя от тези заявки хвърли → продължаваме към INSERT. Загуба на точност (admin view се брои) е по-малко лоша от загуба на event-и.

**За анонимни** (`user_id === null`): server-side dedup е невъзможен (нямаме стабилен идентификатор без cookies/IP, които не искаме да съхраняваме). Разчитаме само на `localStorage` dedup в client-а. Прието за v1.

### 3. Admin брояч на festival page-а

Място: `app/festivals/[slug]/page.tsx` (модификация).

Server-side в page-а:
1. Проверяваме дали посетителят е admin (`getOptionalUser()` → `user_roles` lookup; вече има util-и за това).
2. Ако да → правим 2 паралелни count заявки (Supabase JS, head-only):
   ```ts
   const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
   const [{ count: last30 }, { count: total }] = await Promise.all([
     admin.from("analytics_events").select("id", { count: "exact", head: true })
       .eq("festival_id", id).eq("event", "festival_view").gte("created_at", since),
     admin.from("analytics_events").select("id", { count: "exact", head: true })
       .eq("festival_id", id).eq("event", "festival_view"),
   ]);
   ```
3. Рендерираме малък badge до заглавието на фестивала:
   ```
   👁 547 / 30д · 1.2k всичко
   ```
4. Ако посетителят НЕ е admin → badge-ът не се рендерира (no leak на брояча на публиката).

Компонент: `components/festival/AdminViewCountBadge.tsx` (нов).

**Кеш:** `revalidate = 300` (5 мин) на page-а за admin path-а. За public path не променяме нищо.

**Перформанс:** `count()` с index по `festival_id` е O(log n) — на трафика ни (~хиляди events/ден max) под 10ms. Когато тръгне реален обем, във v2 заменяме с materialized aggregate.

## Data model

Не променяме схемата. Използваме `analytics_events` таблицата както съществува (от `20260512_analytics_events.sql`):
- `id bigserial`
- `user_id uuid` (nullable за анонимни)
- `event text` — за нас `'festival_view'`
- `festival_id uuid` (nullable, попълнен при festival_view)
- `slug text`
- `source text` — за web `'web'`, за mobile вече `'mobile'`
- `metadata_json jsonb`
- `created_at timestamptz`

Index `analytics_events_festival_id_idx` вече покрива нашите count queries.

## Error handling

- Client tracking: fetch failures се swallow-ват (analytics никога не блокира UX).
- Server filters: throw в Supabase queries → fail-open (insert-ваме записа).
- Admin badge query: throw → не рендерираме badge-а, не блокираме страницата.
- Bot UA / staff exclusion връща `ok: true` за да изглежда нормално за честни клиенти.

## Testing (manual smoke)

- [ ] Отвори festival page инкогнито → 1 запис в `analytics_events`.
- [ ] F5 веднага → НЯМА нов запис (localStorage dedup).
- [ ] Изчисти localStorage → 1 нов запис.
- [ ] Логни се като admin → отвори festival page → НЯМА нов запис (staff filter).
- [ ] Curl с `User-Agent: Googlebot` → НЯМА нов запис (bot filter).
- [ ] Логни се като admin → виж badge с count на festival page-а.
- [ ] Логни се като нормален user → badge го няма.

## Post-launch (v2) backlog

В `LAUNCH_CHECKLIST.md` се добавя секция „Analytics v2 (след стабилен launch)" с:

- Admin таблица с фестивали — нова колона „Гледания (30д)" с sort.
- `/admin/analytics` страница: топ 10 фестивали, view trend per ден, share / save / click-out breakdown.
- Materialized aggregate `festival_daily_stats` с `(festival_id, date, views, saves, click_outs, shares)`, обновявана от cron.
- Conversion funnels: view → save → click-out.
- Source attribution (Referer parsing → google / direct / push / share / mobile).
- Bot detection v2 (rate limiting per IP, headless browser fingerprinting).
- Search query tracking.
- GDPR retention: 12 месеца raw events, по-стари → агрегират се и се изтриват.

## Open questions

Няма. Дизайнът е одобрен в брейнсторминг сесията от 2026-05-29.
