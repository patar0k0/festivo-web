# Weekend Facebook Post — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every Thursday, auto-generate a Bulgarian Facebook post highlighting this weekend's festivals (Gemini-written caption + Playwright-rendered poster collage), send it to Telegram for one-click human approval, then publish it to a Facebook Page via the Graph API.

**Architecture:** A new worker (`weekend_post_worker.js`) in `festivo-workers` runs on the existing every-5-minutes `cron_combo.js` Railway tick. On the configured trigger day it (1) queries this weekend's festivals from Supabase, (2) generates the caption with Gemini (reusing the festivo-web `gemini-provider` model-chain pattern, ported to the workers repo), (3) renders a 1080×1080 collage of poster images with the already-installed Playwright Chromium, (4) uploads the collage to the existing Supabase storage bucket, (5) inserts a `social_scheduled_posts` row in `awaiting_review`, and (6) sends a Telegram preview with an approve/schedule/regenerate/cancel keyboard. The existing Telegram webhook in `festivo-web` (`app/api/telegram/social-bot/route.ts`) is extended to handle the new `wpost:` callbacks. On approval, the worker publishes to Facebook via a new `facebook` publisher in the existing publisher registry.

**Tech Stack:** Node ESM (`festivo-workers`), `@supabase/supabase-js`, `@google/generative-ai` (new dep), Playwright Chromium (already installed), Facebook Graph API v21.0, Telegram Bot API, Next.js App Router (`festivo-web` webhook route), Postgres/Supabase.

---

## Prerequisites (human, Meta-side — blocks publishing only, not build/test)

These are **not** code tasks. The implementer can build and test everything except a live Facebook publish without them. The project owner must:

1. Have a Facebook **Page** they administer; note its numeric `PAGE_ID`.
2. Create/choose a Meta app (the same Business as the existing TikTok/IG integration is fine), and generate a **long-lived Page access token** with `pages_manage_posts` + `pages_read_engagement`. For durability, mint a **System User token** (does not expire) via Meta Business Settings.
3. Add to `festivo-workers/.env`:
   - `FB_PAGE_ID=<numeric page id>`
   - `FB_PAGE_ACCESS_TOKEN=<long-lived/system-user token>`
   - (Gemini already present: `GEMINI_API_KEY`.)

> For a single owned Page in Development mode with the owner holding an admin role, **Meta App Review is not required**. Review is only needed if third-party Pages connect through the app.

---

## Environment variables (full list)

Add to `festivo-workers/.env` (and Railway service vars):

| Var | Default / example | Purpose |
|---|---|---|
| `FB_PAGE_ID` | `1234567890` | Target Facebook Page |
| `FB_PAGE_ACCESS_TOKEN` | `EAAB...` | Page/System-User token |
| `FB_GRAPH_VERSION` | `v21.0` | Graph API version (override only) |
| `GEMINI_API_KEY` | *(exists)* | Gemini auth |
| `WEEKEND_CAPTION_MODEL` | `gemini-3.5-flash` | Primary caption model (env override) |
| `WEEKEND_POST_TRIGGER_DOW` | `4` | Trigger weekday, 0=Sun…4=Thu |
| `WEEKEND_POST_CHAT_ID` | `<telegram chat id>` | Where the review preview is sent |
| `SOCIAL_REPOST_BUCKET` | `social-repost-temp` *(exists)* | Storage bucket for the collage |
| `TELEGRAM_BOT_TOKEN` | *(exists)* | Telegram sends |

---

## File Structure

**festivo-workers (new):**
- `migrations/20260611_weekend_post.sql` — `social_scheduled_posts` table + `social_accounts` network-check extension to include `facebook`.
- `workers/lib/weekend_range.js` — pure date logic: which Fri–Sun is "this weekend", dedupe key.
- `workers/lib/weekend_festivals.js` — Supabase query + curation of weekend festivals.
- `workers/lib/gemini_caption.js` — Gemini caption generation with model-chain fallback + deterministic template fallback.
- `workers/lib/collage.js` — Playwright HTML→PNG collage renderer.
- `workers/lib/scheduled_posts.js` — DB layer for `social_scheduled_posts` (enqueue/claim/update/get).
- `workers/lib/publishers/facebook.js` — Facebook Graph publish (photo-with-caption, text fallback).
- `workers/weekend_post_worker.js` — orchestrator: generate-draft tick + publish tick + `main()`.

**festivo-workers (modified):**
- `package.json` — add `@google/generative-ai` dep + `start:weekend-post` script.
- `workers/lib/publishers/index.js` — register `facebook` in `DEFAULT_REGISTRY`.
- `workers/lib/publishers/payloads.js` — add `buildFacebookPhotoPayload`.
- `workers/cron_combo.js` — add `run('weekend_post_worker.js')`.

**festivo-web (modified):**
- `lib/telegram/socialBot.mjs` — recognise `wpost:<id>:<decision>` callbacks; add `weekendDecisionToStatus`.
- `app/api/telegram/social-bot/route.ts` — handle the `weekend-decision` action against `social_scheduled_posts`.

**Tests (festivo-workers):**
- `tests/regression/weekend-range.test.js`
- `tests/regression/weekend-festivals.test.js`
- `tests/regression/gemini-caption.test.js`
- `tests/regression/facebook-payloads.test.js`
- `tests/regression/scheduled-posts-state.test.js`
- `tests/regression/weekend-post-worker-tick.test.js`

**Tests (festivo-web):**
- `lib/telegram/socialBot.test.mjs` — extend with `wpost:` cases.

Run tests in `festivo-workers` with `npm run test:regression` (uses `node --test`). In `festivo-web`, the existing `socialBot.test.mjs` runs via its configured test runner (`node --test lib/telegram/socialBot.test.mjs`).

---

## Task 1: Database migration — `social_scheduled_posts` + `facebook` network

**Files:**
- Create: `festivo-workers/migrations/20260611_weekend_post.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- 20260611_weekend_post.sql
-- Weekend Facebook post: separate from social_repost_jobs (text+image, not video).

-- 1) allow 'facebook' on social_accounts
alter table public.social_accounts drop constraint if exists social_accounts_network_check;
alter table public.social_accounts
  add constraint social_accounts_network_check
  check (network in ('tiktok','instagram','facebook'));

-- 2) scheduled-post queue
create table if not exists public.social_scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'weekend_roundup',
  period_start date not null,
  period_end date not null,
  caption text,
  image_storage_path text,
  target_network text not null default 'facebook',
  status text not null default 'awaiting_review'
    check (status in ('draft','awaiting_review','scheduled','publishing','published','failed','cancelled')),
  scheduled_at timestamptz,
  telegram_chat_id bigint,
  telegram_message_id bigint,
  external_post_id text,
  result jsonb not null default '{}'::jsonb,
  error text,
  claimed_at timestamptz,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dedupe_key)
);

create index if not exists idx_social_scheduled_posts_status
  on public.social_scheduled_posts (status);
create index if not exists idx_social_scheduled_posts_scheduled_at
  on public.social_scheduled_posts (scheduled_at);

-- RLS: service-role only (no public/authenticated access)
alter table public.social_scheduled_posts enable row level security;
-- No policies => only service_role (bypasses RLS) can access.
```

- [ ] **Step 2: Apply the migration**

Apply via Supabase MCP `apply_migration` (name `weekend_post`) or the project's normal migration runner. Confirm with:

Run (Supabase MCP `list_tables`, schema `public`): expect `social_scheduled_posts` present.
Expected: table exists; `social_accounts` check now includes `facebook`.

- [ ] **Step 3: Commit**

```bash
cd festivo-workers
git add migrations/20260611_weekend_post.sql
git commit -m "feat(db): social_scheduled_posts table + facebook network"
```

---

## Task 2: Weekend date range (pure logic)

**Files:**
- Create: `festivo-workers/workers/lib/weekend_range.js`
- Test: `festivo-workers/tests/regression/weekend-range.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getWeekendRange, weekendDedupeKey, isTriggerDay } from '../../workers/lib/weekend_range.js';

test('Thursday returns the upcoming Fri–Sun', () => {
  // 2026-06-11 is a Thursday
  const r = getWeekendRange(new Date('2026-06-11T09:00:00Z'));
  assert.equal(r.start, '2026-06-12'); // Friday
  assert.equal(r.end, '2026-06-14');   // Sunday
});

test('Saturday returns the current weekend (already in it)', () => {
  const r = getWeekendRange(new Date('2026-06-13T09:00:00Z'));
  assert.equal(r.start, '2026-06-12');
  assert.equal(r.end, '2026-06-14');
});

test('Monday returns the same week upcoming weekend', () => {
  const r = getWeekendRange(new Date('2026-06-15T09:00:00Z')); // Monday
  assert.equal(r.start, '2026-06-19');
  assert.equal(r.end, '2026-06-21');
});

test('weekendDedupeKey is stable per weekend', () => {
  assert.equal(weekendDedupeKey({ start: '2026-06-12', end: '2026-06-14' }), 'weekend:2026-06-12');
});

test('isTriggerDay matches configured weekday', () => {
  assert.equal(isTriggerDay(new Date('2026-06-11T09:00:00Z'), 4), true);  // Thu
  assert.equal(isTriggerDay(new Date('2026-06-12T09:00:00Z'), 4), false); // Fri
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd festivo-workers && node --test tests/regression/weekend-range.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```js
// workers/lib/weekend_range.js
// All dates handled in UTC; festivals use plain `date` columns (no tz).

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

// Returns {start, end} ISO dates for the Friday..Sunday of the weekend
// belonging to `now`'s week. If now is Mon–Thu, it's the upcoming weekend;
// if Fri–Sun, it's the current one.
export function getWeekendRange(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = d.getUTCDay(); // 0=Sun..6=Sat
  // Days until Friday (5). Sunday(0) counts as part of the just-passed weekend.
  let daysToFriday;
  if (dow === 0) {
    daysToFriday = -2; // Sunday → Friday two days back (current weekend)
  } else {
    daysToFriday = 5 - dow; // Mon(1)->4 ... Fri(5)->0, Sat(6)->-1
  }
  const friday = new Date(d);
  friday.setUTCDate(d.getUTCDate() + daysToFriday);
  const sunday = new Date(friday);
  sunday.setUTCDate(friday.getUTCDate() + 2);
  return { start: toISODate(friday), end: toISODate(sunday) };
}

export function weekendDedupeKey(range) {
  return `weekend:${range.start}`;
}

export function isTriggerDay(now, triggerDow) {
  return now.getUTCDay() === Number(triggerDow);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd festivo-workers && node --test tests/regression/weekend-range.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add workers/lib/weekend_range.js tests/regression/weekend-range.test.js
git commit -m "feat(weekend): weekend date-range + dedupe helpers"
```

---

## Task 3: Weekend festivals query + curation

**Files:**
- Create: `festivo-workers/workers/lib/weekend_festivals.js`
- Test: `festivo-workers/tests/regression/weekend-festivals.test.js`

The visible-festival filter mirrors the production rule established during data review: overlap the weekend window and exclude `status = 'archived'` and `lifecycle_state = 'cancelled'`.

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { curateFestivals, buildWeekendQuery } from '../../workers/lib/weekend_festivals.js';

test('buildWeekendQuery filters overlap + visibility', () => {
  const q = buildWeekendQuery({ start: '2026-06-12', end: '2026-06-14' });
  assert.equal(q.startLte, '2026-06-14');
  assert.equal(q.endGte, '2026-06-12');
});

test('curateFestivals drops archived and cancelled, caps and groups', () => {
  const rows = [
    { title: 'A', city: 'sofia', category: 'музикален фестивал', status: 'verified', lifecycle_state: 'active', is_free: true },
    { title: 'B', city: 'sofia', category: 'музикален фестивал', status: 'archived', lifecycle_state: 'active', is_free: true },
    { title: 'C', city: 'burgas', category: 'кулинарен фестивал', status: 'verified', lifecycle_state: 'cancelled', is_free: true },
    { title: 'D', city: 'varna', category: 'фолклорен фестивал', status: 'verified', lifecycle_state: 'active', is_free: true },
  ];
  const out = curateFestivals(rows, { maxHighlights: 10 });
  const titles = out.highlights.map((f) => f.title);
  assert.deepEqual(titles.sort(), ['A', 'D']);
  assert.equal(out.total, 2);
  assert.ok(out.byCategory['музикален фестивал']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd festivo-workers && node --test tests/regression/weekend-festivals.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```js
// workers/lib/weekend_festivals.js

const SELECT_COLS =
  'title, city, start_date, end_date, category, is_free, price_range, website_url, ticket_url, hero_image, image_url, slug, status, lifecycle_state';

export function buildWeekendQuery(range) {
  // festival overlaps [start,end] when start_date <= end AND end_date >= start
  return { startLte: range.end, endGte: range.start, cols: SELECT_COLS };
}

function isVisible(f) {
  return f && f.status !== 'archived' && f.lifecycle_state !== 'cancelled';
}

// Group visible festivals by category and return capped highlights.
export function curateFestivals(rows, { maxHighlights = 12 } = {}) {
  const visible = (rows || []).filter(isVisible);
  const byCategory = {};
  for (const f of visible) {
    const k = f.category || 'друго';
    (byCategory[k] ||= []).push(f);
  }
  // Highlights: prefer those with an image, then named ticketed events, then the rest.
  const scored = [...visible].sort((a, b) => imgRank(b) - imgRank(a));
  const highlights = scored.slice(0, maxHighlights);
  return { highlights, byCategory, total: visible.length };
}

function imgRank(f) {
  let s = 0;
  if (f.hero_image || f.image_url) s += 2;
  if (f.ticket_url) s += 1;
  return s;
}

// Fetch from Supabase using an already-constructed client.
export async function fetchWeekendFestivals(supabase, range) {
  const q = buildWeekendQuery(range);
  const { data, error } = await supabase
    .from('festivals')
    .select(q.cols)
    .lte('start_date', q.startLte)
    .gte('end_date', q.endGte)
    .order('start_date', { ascending: true });
  if (error) throw new Error(`fetchWeekendFestivals failed: ${error.message}`);
  return data || [];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd festivo-workers && node --test tests/regression/weekend-festivals.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add workers/lib/weekend_festivals.js tests/regression/weekend-festivals.test.js
git commit -m "feat(weekend): festivals query + curation"
```

---

## Task 4: Gemini caption generation (with template fallback)

**Files:**
- Modify: `festivo-workers/package.json` (add dep + script)
- Create: `festivo-workers/workers/lib/gemini_caption.js`
- Test: `festivo-workers/tests/regression/gemini-caption.test.js`

Reuses the festivo-web `gemini-provider` model-chain idea (`gemini-3.5-flash` → `gemini-3.1-flash-lite` → `gemini-2.5-flash`, fall back on 429). The `generateContent` call is injected as a dependency so the unit test never hits the network. A deterministic `buildTemplateCaption` is always available as the no-API fallback.

- [ ] **Step 1: Add the dependency and script**

```bash
cd festivo-workers
npm install @google/generative-ai
```

Then edit `festivo-workers/package.json` `scripts` to add:

```json
"start:weekend-post": "node workers/weekend_post_worker.js",
```

- [ ] **Step 2: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTemplateCaption, generateWeekendCaption } from '../../workers/lib/gemini_caption.js';

const RANGE = { start: '2026-06-12', end: '2026-06-14' };
const CURATED = {
  total: 2,
  highlights: [
    { title: 'ZARA Summer Festival 2026', city: 'stara-zagora', category: 'музикален фестивал', is_free: false, ticket_url: 'https://bilet.bg/x' },
    { title: 'Парк Фест 2026', city: 'sofia', category: 'културен фестивал', is_free: true },
  ],
  byCategory: { 'музикален фестивал': [{ title: 'ZARA Summer Festival 2026', city: 'stara-zagora' }] },
};

test('buildTemplateCaption includes count, a title, and hashtags', () => {
  const c = buildTemplateCaption(CURATED, RANGE);
  assert.match(c, /12/); // day
  assert.match(c, /ZARA Summer Festival 2026/);
  assert.match(c, /#Festivo/);
});

test('generateWeekendCaption uses injected model and returns its text', async () => {
  const fakeGenerate = async () => ({ response: { text: () => '🎉 Уикенд с фестивали! #Festivo' } });
  const out = await generateWeekendCaption(CURATED, RANGE, {
    apiKey: 'x',
    getModel: () => ({ generateContent: fakeGenerate }),
  });
  assert.equal(out, '🎉 Уикенд с фестивали! #Festivo');
});

test('generateWeekendCaption falls back to template when no API key', async () => {
  const out = await generateWeekendCaption(CURATED, RANGE, { apiKey: null });
  assert.match(out, /#Festivo/);
});

test('generateWeekendCaption falls back to template on model error', async () => {
  const failing = async () => { throw new Error('boom'); };
  const out = await generateWeekendCaption(CURATED, RANGE, {
    apiKey: 'x',
    getModel: () => ({ generateContent: failing }),
  });
  assert.match(out, /#Festivo/);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd festivo-workers && node --test tests/regression/gemini-caption.test.js`
Expected: FAIL — module not found.

- [ ] **Step 4: Write the implementation**

```js
// workers/lib/gemini_caption.js
import { GoogleGenerativeAI } from '@google/generative-ai';

const MODEL_CHAIN = [
  process.env.WEEKEND_CAPTION_MODEL?.trim() || 'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
].filter((m, i, a) => a.indexOf(m) === i);

function is429(err) {
  const status = err?.status;
  if (status === 429) return true;
  const m = String(err?.message || '').toLowerCase();
  return m.includes('429') || m.includes('quota') || m.includes('resource_exhausted') || m.includes('rate limit');
}

const DOW_BG = ['неделя', 'понеделник', 'вторник', 'сряда', 'четвъртък', 'петък', 'събота'];

export function buildTemplateCaption(curated, range) {
  const startDay = range.start.slice(8, 10);
  const endDay = range.end.slice(8, 10);
  const lines = [];
  lines.push(`🎉 УИКЕНД С ФЕСТИВАЛИ! ${startDay}–${endDay} юни 🇧🇬`);
  lines.push('');
  for (const f of curated.highlights.slice(0, 8)) {
    const tail = f.ticket_url ? ' 🎟️' : (f.is_free ? ' (вход свободен)' : '');
    lines.push(`• ${f.title} — ${f.city}${tail}`);
  }
  if (curated.total > 8) lines.push(`…и още ${curated.total - 8} събития из страната!`);
  lines.push('');
  lines.push('📲 Виж всички в приложението Festivo!');
  lines.push('#Festivo #ФестивалиБългария #Уикенд #КъдеДаОтидем');
  return lines.join('\n');
}

function buildPrompt(curated, range) {
  const list = curated.highlights
    .map((f) => `- ${f.title} | ${f.city} | ${f.category}${f.ticket_url ? ' | билети' : f.is_free ? ' | безплатно' : ''}`)
    .join('\n');
  return [
    'Ти си social media редактор на Festivo — приложение за български фестивали.',
    `Напиши ЕДИН Facebook пост на български за събитията този уикенд (${range.start} – ${range.end}).`,
    'Изисквания: топъл, каним-те тон; емоджи по жанр; кратки редове; без измислени факти — ползвай само дадените събития;',
    `в края 4–6 хаштага, единият задължително #Festivo. Спомени, че всички са в приложението Festivo. Общо ~${curated.total} събития.`,
    '',
    'Акценти:',
    list,
  ].join('\n');
}

export async function generateWeekendCaption(curated, range, deps = {}) {
  const apiKey = deps.apiKey ?? (process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_AI_API_KEY?.trim() || null);
  if (!apiKey) return buildTemplateCaption(curated, range);

  const getModel =
    deps.getModel ||
    ((modelId) => new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: modelId }));

  const prompt = buildPrompt(curated, range);
  let lastErr;
  for (let i = 0; i < MODEL_CHAIN.length; i++) {
    const modelId = MODEL_CHAIN[i];
    try {
      const model = getModel(modelId);
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 1024 },
      });
      const text = (result?.response?.text?.() || '').trim();
      if (text) return text;
      lastErr = new Error('empty caption');
    } catch (err) {
      lastErr = err;
      if (is429(err) && MODEL_CHAIN[i + 1]) continue;
      break;
    }
  }
  console.warn(`[weekend-caption] falling back to template: ${lastErr?.message || lastErr}`);
  return buildTemplateCaption(curated, range);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd festivo-workers && node --test tests/regression/gemini-caption.test.js`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json workers/lib/gemini_caption.js tests/regression/gemini-caption.test.js
git commit -m "feat(weekend): Gemini caption with model-chain + template fallback"
```

---

## Task 5: Facebook publish payload (pure)

**Files:**
- Modify: `festivo-workers/workers/lib/publishers/payloads.js`
- Test: `festivo-workers/tests/regression/facebook-payloads.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFacebookPhotoPayload, buildFacebookFeedPayload } from '../../workers/lib/publishers/payloads.js';

test('photo payload carries url + caption + token', () => {
  const p = buildFacebookPhotoPayload({ imageUrl: 'https://x/y.png', caption: 'hi', accessToken: 'TOK' });
  assert.equal(p.url, 'https://x/y.png');
  assert.equal(p.caption, 'hi');
  assert.equal(p.access_token, 'TOK');
  assert.equal(p.published, true);
});

test('feed payload carries message + token (text-only fallback)', () => {
  const p = buildFacebookFeedPayload({ caption: 'hi', accessToken: 'TOK' });
  assert.equal(p.message, 'hi');
  assert.equal(p.access_token, 'TOK');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd festivo-workers && node --test tests/regression/facebook-payloads.test.js`
Expected: FAIL — exports not defined.

- [ ] **Step 3: Append the implementation** to `workers/lib/publishers/payloads.js`

```js
// Facebook Graph API — Page photo post (image + caption in one post)
export function buildFacebookPhotoPayload({ imageUrl, caption, accessToken }) {
  return {
    url: imageUrl,
    caption: caption || '',
    published: true,
    access_token: accessToken,
  };
}

// Facebook Graph API — Page feed post (text only, fallback when no image)
export function buildFacebookFeedPayload({ caption, accessToken }) {
  return {
    message: caption || '',
    access_token: accessToken,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd festivo-workers && node --test tests/regression/facebook-payloads.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add workers/lib/publishers/payloads.js tests/regression/facebook-payloads.test.js
git commit -m "feat(weekend): facebook graph payload builders"
```

---

## Task 6: Facebook publisher

**Files:**
- Create: `festivo-workers/workers/lib/publishers/facebook.js`
- Modify: `festivo-workers/workers/lib/publishers/index.js`

The publisher conforms to the registry contract: `publish({ job, account, media })` → `{ status, external_post_id?, error? }`. Here `job` is a `social_scheduled_posts` row, `media.publicUrl` is the signed collage URL, and the token comes from env (`FB_PAGE_ACCESS_TOKEN`) — Facebook is env-configured, not a `social_accounts` row, so `account` may be null.

- [ ] **Step 1: Write the implementation**

```js
// workers/lib/publishers/facebook.js
import { buildFacebookPhotoPayload, buildFacebookFeedPayload } from './payloads.js';

const VERSION = process.env.FB_GRAPH_VERSION || 'v21.0';
const GRAPH = `https://graph.facebook.com/${VERSION}`;

export async function publish({ job, media, deps = {} }) {
  const fetchImpl = deps.fetchImpl || fetch;
  const pageId = deps.pageId || process.env.FB_PAGE_ID;
  const token = deps.accessToken || process.env.FB_PAGE_ACCESS_TOKEN;
  if (!pageId || !token) throw new Error('FB_PAGE_ID / FB_PAGE_ACCESS_TOKEN not configured');

  const caption = job.caption || '';
  const imageUrl = media?.publicUrl || null;

  // Prefer a single photo-with-caption post; fall back to text-only feed post.
  let endpoint, payload;
  if (imageUrl) {
    endpoint = `${GRAPH}/${pageId}/photos`;
    payload = buildFacebookPhotoPayload({ imageUrl, caption, accessToken: token });
  } else {
    endpoint = `${GRAPH}/${pageId}/feed`;
    payload = buildFacebookFeedPayload({ caption, accessToken: token });
  }

  const res = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || `HTTP ${res.status}`;
    throw new Error(`facebook publish failed: ${msg}`);
  }
  // /photos returns { id, post_id }; /feed returns { id }
  return { status: 'published', external_post_id: json.post_id || json.id || null };
}
```

- [ ] **Step 2: Register it** — edit `workers/lib/publishers/index.js`:

```js
import * as tiktok from './tiktok.js';
import * as instagram from './instagram.js';
import * as facebook from './facebook.js';

const DEFAULT_REGISTRY = { tiktok, instagram, facebook };
```

(Leave the rest of `index.js` unchanged.)

- [ ] **Step 3: Smoke-check the registry**

Run: `cd festivo-workers && node -e "import('./workers/lib/publishers/index.js').then(m=>{const p=m.getPublisher('facebook');if(!p||typeof p.publish!=='function')throw new Error('not registered');console.log('facebook publisher OK')})"`
Expected: prints `facebook publisher OK`.

- [ ] **Step 4: Commit**

```bash
git add workers/lib/publishers/facebook.js workers/lib/publishers/index.js
git commit -m "feat(weekend): facebook publisher + registry registration"
```

---

## Task 7: Scheduled-posts DB layer + state

**Files:**
- Create: `festivo-workers/workers/lib/scheduled_posts.js`
- Test: `festivo-workers/tests/regression/scheduled-posts-state.test.js`

- [ ] **Step 1: Write the failing test** (pure helpers only; DB methods are integration-tested in Task 8 with a fake client)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scheduledDecisionToStatus, isReadyToPublish } from '../../workers/lib/scheduled_posts.js';

test('decision → status mapping', () => {
  assert.equal(scheduledDecisionToStatus('publish_now'), 'publishing');
  assert.equal(scheduledDecisionToStatus('schedule'), 'scheduled');
  assert.equal(scheduledDecisionToStatus('cancel'), 'cancelled');
  assert.equal(scheduledDecisionToStatus('regenerate'), 'regenerate');
  assert.equal(scheduledDecisionToStatus('bogus'), null);
});

test('isReadyToPublish honours scheduled_at', () => {
  const past = { status: 'scheduled', scheduled_at: '2020-01-01T00:00:00Z' };
  const future = { status: 'scheduled', scheduled_at: '2999-01-01T00:00:00Z' };
  assert.equal(isReadyToPublish(past, new Date('2026-06-11T00:00:00Z')), true);
  assert.equal(isReadyToPublish(future, new Date('2026-06-11T00:00:00Z')), false);
  assert.equal(isReadyToPublish({ status: 'awaiting_review' }), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd festivo-workers && node --test tests/regression/scheduled-posts-state.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```js
// workers/lib/scheduled_posts.js

export function scheduledDecisionToStatus(decision) {
  switch (decision) {
    case 'publish_now': return 'publishing';
    case 'schedule': return 'scheduled';
    case 'cancel': return 'cancelled';
    case 'regenerate': return 'regenerate'; // sentinel handled by webhook, not a DB status
    default: return null;
  }
}

export function isReadyToPublish(post, now = new Date()) {
  if (!post || post.status !== 'scheduled' || !post.scheduled_at) return false;
  return new Date(post.scheduled_at).getTime() <= now.getTime();
}

export async function getPostByDedupe(supabase, dedupeKey) {
  const { data, error } = await supabase
    .from('social_scheduled_posts')
    .select('*')
    .eq('dedupe_key', dedupeKey)
    .maybeSingle();
  if (error) throw new Error(`getPostByDedupe failed: ${error.message}`);
  return data;
}

export async function insertDraft(supabase, row) {
  const { data, error } = await supabase
    .from('social_scheduled_posts')
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'dedupe_key' })
    .select()
    .single();
  if (error) throw new Error(`insertDraft failed: ${error.message}`);
  return data;
}

export async function updatePost(supabase, id, patch) {
  const { data, error } = await supabase
    .from('social_scheduled_posts')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(`updatePost failed: ${error.message}`);
  return data;
}

// Atomically claim one post in `fromStatus`, flipping to `toStatus`.
export async function claimNextPost(supabase, { fromStatus, toStatus }) {
  const { data: rows, error } = await supabase
    .from('social_scheduled_posts')
    .select('*')
    .eq('status', fromStatus)
    .order('created_at', { ascending: true })
    .limit(1);
  if (error) throw new Error(`claim select failed: ${error.message}`);
  const post = rows?.[0];
  if (!post) return null;
  const { data: updated, error: upErr } = await supabase
    .from('social_scheduled_posts')
    .update({ status: toStatus, claimed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', post.id)
    .eq('status', fromStatus)
    .select()
    .single();
  if (upErr || !updated) return null;
  return updated;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd festivo-workers && node --test tests/regression/scheduled-posts-state.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add workers/lib/scheduled_posts.js tests/regression/scheduled-posts-state.test.js
git commit -m "feat(weekend): scheduled_posts DB layer + state helpers"
```

---

## Task 8: Collage renderer (Playwright)

**Files:**
- Create: `festivo-workers/workers/lib/collage.js`

No unit test (binary rendering); verified by a manual smoke run. Builds an HTML grid of up to 4 poster images plus a Festivo header, screenshots 1080×1080 PNG. Image URLs come from `hero_image`/`image_url`; missing images fall back to a colored tile with the title.

- [ ] **Step 1: Write the implementation**

```js
// workers/lib/collage.js
import { chromium } from 'playwright';

function esc(s) {
  return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export function buildCollageHtml(festivals, range) {
  const tiles = festivals.slice(0, 4).map((f) => {
    const img = f.hero_image || f.image_url || '';
    const bg = img
      ? `background-image:url('${esc(img)}');background-size:cover;background-position:center;`
      : 'background:linear-gradient(135deg,#E23744,#7a1620);';
    return `<div class="tile" style="${bg}"><div class="cap">${esc(f.title)}</div></div>`;
  });
  while (tiles.length < 4) tiles.push('<div class="tile" style="background:#2b2b2b"></div>');
  const startDay = range.start.slice(8, 10);
  const endDay = range.end.slice(8, 10);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif}
    body{width:1080px;height:1080px;background:#111;color:#fff}
    .hdr{height:140px;display:flex;align-items:center;justify-content:center;background:#E23744}
    .hdr h1{font-size:54px;letter-spacing:1px}
    .grid{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;width:1080px;height:940px;gap:6px}
    .tile{position:relative;overflow:hidden}
    .cap{position:absolute;left:0;right:0;bottom:0;padding:16px;font-size:30px;font-weight:bold;
      background:linear-gradient(transparent,rgba(0,0,0,.8));text-shadow:0 2px 4px #000}
  </style></head><body>
    <div class="hdr"><h1>🎉 ФЕСТИВАЛИ ${startDay}–${endDay} ЮНИ</h1></div>
    <div class="grid">${tiles.join('')}</div>
  </body></html>`;
}

// Renders the collage to a PNG Buffer.
export async function renderCollage(festivals, range, deps = {}) {
  const launch = deps.launch || (() => chromium.launch({ args: ['--no-sandbox'] }));
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
    await page.setContent(buildCollageHtml(festivals, range), { waitUntil: 'networkidle' });
    return await page.screenshot({ type: 'png' });
  } finally {
    await browser.close();
  }
}
```

- [ ] **Step 2: Manual smoke render**

Run:
```bash
cd festivo-workers && node -e "import('./workers/lib/collage.js').then(async m=>{const b=await m.renderCollage([{title:'ZARA Summer Festival'},{title:'Парк Фест'},{title:'Славееви нощи'},{title:'Суджук Фест'}],{start:'2026-06-12',end:'2026-06-14'});require('fs').writeFileSync('collage-test.png',b);console.log('wrote collage-test.png',b.length,'bytes')})"
```
Expected: writes `collage-test.png` (> 10000 bytes). Open it to eyeball the layout, then delete it.

- [ ] **Step 3: Commit**

```bash
git add workers/lib/collage.js
git commit -m "feat(weekend): playwright poster collage renderer"
```

---

## Task 9: Telegram review keyboard helper

**Files:**
- Create: `festivo-workers/workers/lib/weekend_keyboard.js`
- Add cases to: `festivo-workers/tests/regression/weekend-range.test.js` is unrelated — create `festivo-workers/tests/regression/weekend-keyboard.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWeekendReviewKeyboard } from '../../workers/lib/weekend_keyboard.js';

test('keyboard wires wpost callbacks for the post id', () => {
  const kb = buildWeekendReviewKeyboard('abc-123');
  const flat = kb.inline_keyboard.flat().map((b) => b.callback_data);
  assert.ok(flat.includes('wpost:abc-123:publish_now'));
  assert.ok(flat.includes('wpost:abc-123:schedule'));
  assert.ok(flat.includes('wpost:abc-123:regenerate'));
  assert.ok(flat.includes('wpost:abc-123:cancel'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd festivo-workers && node --test tests/regression/weekend-keyboard.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```js
// workers/lib/weekend_keyboard.js
export function buildWeekendReviewKeyboard(postId) {
  return {
    inline_keyboard: [
      [
        { text: '✅ Публикувай сега', callback_data: `wpost:${postId}:publish_now` },
        { text: '🕒 Насрочи (събота 9:00)', callback_data: `wpost:${postId}:schedule` },
      ],
      [
        { text: '♻️ Регенерирай текст', callback_data: `wpost:${postId}:regenerate` },
        { text: '❌ Откажи', callback_data: `wpost:${postId}:cancel` },
      ],
    ],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd festivo-workers && node --test tests/regression/weekend-keyboard.test.js`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add workers/lib/weekend_keyboard.js tests/regression/weekend-keyboard.test.js
git commit -m "feat(weekend): telegram review keyboard"
```

---

## Task 10: Weekend post worker — generate + publish ticks

**Files:**
- Create: `festivo-workers/workers/weekend_post_worker.js`
- Test: `festivo-workers/tests/regression/weekend-post-worker-tick.test.js`

The worker exposes `generateTick` and `publishTick` as pure-ish functions taking injected deps so the test never touches Playwright, Gemini, Facebook, Telegram, or a real DB. `main()` wires the real implementations.

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateTick, publishTick } from '../../workers/weekend_post_worker.js';

function fakeSupabase(state) {
  return {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        lte() { return this; },
        gte() { return this; },
        order() { return Promise.resolve({ data: state.festivals || [], error: null }); },
        maybeSingle() { return Promise.resolve({ data: state.existing || null, error: null }); },
        limit() { return Promise.resolve({ data: state.claimable ? [state.claimable] : [], error: null }); },
        upsert() { return { select() { return { single() { return Promise.resolve({ data: { id: 'p1' }, error: null }); } }; } }; },
        update() { return { eq() { return { select() { return { single() { return Promise.resolve({ data: { id: 'p1', status: 'published' }, error: null }); } }; }, eq() { return { select() { return { single() { return Promise.resolve({ data: state.claimable, error: null }); } }; } }; } }; } }; },
      };
    },
  };
}

test('generateTick skips when a draft already exists for this weekend', async () => {
  const sent = [];
  const supabase = fakeSupabase({ existing: { id: 'old' } });
  const res = await generateTick(supabase, {
    now: new Date('2026-06-11T09:00:00Z'),
    triggerDow: 4,
    deps: { telegramSend: async (m, p) => sent.push([m, p]) },
  });
  assert.equal(res.skipped, 'exists');
  assert.equal(sent.length, 0);
});

test('generateTick is a no-op on non-trigger days', async () => {
  const supabase = fakeSupabase({});
  const res = await generateTick(supabase, { now: new Date('2026-06-12T09:00:00Z'), triggerDow: 4, deps: {} });
  assert.equal(res.skipped, 'not_trigger_day');
});

test('publishTick publishes a claimed post and notifies', async () => {
  const sent = [];
  const supabase = fakeSupabase({ claimable: { id: 'p1', status: 'publishing', caption: 'hi', image_storage_path: 'x.png', telegram_chat_id: 1 } });
  const res = await publishTick(supabase, {
    deps: {
      signImage: async () => 'https://signed/x.png',
      publish: async () => ({ status: 'published', external_post_id: 'FB1' }),
      telegramSend: async (m, p) => sent.push([m, p]),
    },
  });
  assert.equal(res.published, true);
  assert.ok(sent.length >= 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd festivo-workers && node --test tests/regression/weekend-post-worker-tick.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```js
// workers/weekend_post_worker.js
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getWeekendRange, weekendDedupeKey, isTriggerDay } from './lib/weekend_range.js';
import { fetchWeekendFestivals, curateFestivals } from './lib/weekend_festivals.js';
import { generateWeekendCaption } from './lib/gemini_caption.js';
import { renderCollage } from './lib/collage.js';
import { getPostByDedupe, insertDraft, updatePost, claimNextPost, isReadyToPublish } from './lib/scheduled_posts.js';
import { buildWeekendReviewKeyboard } from './lib/weekend_keyboard.js';
import { getPublisher } from './lib/publishers/index.js';

function loadDotEnv() {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const envPath = path.resolve(dir, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    if (process.env[k] == null) process.env[k] = t.slice(i + 1).trim();
  }
}

const BUCKET = () => process.env.SOCIAL_REPOST_BUCKET || 'social-repost-temp';

export async function generateTick(supabase, { now = new Date(), triggerDow = Number(process.env.WEEKEND_POST_TRIGGER_DOW || 4), deps = {} } = {}) {
  if (!isTriggerDay(now, triggerDow)) return { skipped: 'not_trigger_day' };
  const range = getWeekendRange(now);
  const dedupe = weekendDedupeKey(range);

  const existing = await getPostByDedupe(supabase, dedupe);
  if (existing) return { skipped: 'exists' };

  const rows = await fetchWeekendFestivals(supabase, range);
  const curated = curateFestivals(rows, { maxHighlights: 12 });
  if (curated.total === 0) return { skipped: 'no_festivals' };

  const caption = await generateWeekendCaption(curated, range, {});

  // Render + upload collage (best-effort; text-only post if it fails).
  let imagePath = null;
  try {
    const png = deps.renderCollage ? await deps.renderCollage(curated.highlights, range) : await renderCollage(curated.highlights, range);
    imagePath = `weekend/${dedupe.replace(':', '-')}.png`;
    const upload = deps.uploadImage || (async (p, buf) => {
      const { error } = await supabase.storage.from(BUCKET()).upload(p, buf, { contentType: 'image/png', upsert: true });
      if (error) throw new Error(error.message);
    });
    await upload(imagePath, png);
  } catch (err) {
    console.warn(`[weekend] collage failed, text-only: ${err?.message || err}`);
    imagePath = null;
  }

  const chatId = Number(process.env.WEEKEND_POST_CHAT_ID || 0) || null;
  const post = await insertDraft(supabase, {
    kind: 'weekend_roundup',
    period_start: range.start,
    period_end: range.end,
    caption,
    image_storage_path: imagePath,
    target_network: 'facebook',
    status: 'awaiting_review',
    telegram_chat_id: chatId,
    dedupe_key: dedupe,
  });

  // Send Telegram preview.
  const telegramSend = deps.telegramSend || defaultTelegramSend;
  const kb = buildWeekendReviewKeyboard(post.id);
  const previewText = `📝 Чернова за уикенда ${range.start} – ${range.end}\n\n${caption}`;
  if (chatId) {
    if (imagePath) {
      const signImage = deps.signImage || defaultSignImage(supabase);
      const url = await signImage(imagePath);
      await telegramSend('sendPhoto', { chat_id: chatId, photo: url, caption: previewText.slice(0, 1024), reply_markup: kb });
    } else {
      await telegramSend('sendMessage', { chat_id: chatId, text: previewText, reply_markup: kb });
    }
  }
  return { created: post.id, total: curated.total };
}

export async function publishTick(supabase, { now = new Date(), deps = {} } = {}) {
  // Promote due scheduled posts.
  const { data: scheduled } = await supabase.from('social_scheduled_posts').select('*').eq('status', 'scheduled');
  for (const p of scheduled || []) {
    if (isReadyToPublish(p, now)) await updatePost(supabase, p.id, { status: 'publishing' });
  }

  const post = await claimNextPost(supabase, { fromStatus: 'publishing', toStatus: 'publishing' });
  if (!post) return { published: false, idle: true };

  const telegramSend = deps.telegramSend || defaultTelegramSend;
  try {
    let media = {};
    if (post.image_storage_path) {
      const signImage = deps.signImage || defaultSignImage(supabase);
      media.publicUrl = await signImage(post.image_storage_path);
    }
    const publish = deps.publish || ((args) => getPublisher('facebook').publish(args));
    const result = await publish({ job: post, media });
    await updatePost(supabase, post.id, { status: 'published', external_post_id: result.external_post_id, result });
    if (post.telegram_chat_id) await telegramSend('sendMessage', { chat_id: post.telegram_chat_id, text: `✅ Публикувано във Facebook (id ${result.external_post_id || '?'})` });
    return { published: true, id: post.id };
  } catch (err) {
    await updatePost(supabase, post.id, { status: 'failed', error: String(err?.message || err).slice(0, 500) });
    if (post.telegram_chat_id) await telegramSend('sendMessage', { chat_id: post.telegram_chat_id, text: `❌ Публикуването се провали: ${err?.message || err}` });
    return { published: false, error: String(err?.message || err) };
  }
}

function defaultSignImage(supabase) {
  return async (storagePath) => {
    const { data, error } = await supabase.storage.from(BUCKET()).createSignedUrl(storagePath, 3600);
    if (error) throw new Error(error.message);
    return data.signedUrl;
  };
}

async function defaultTelegramSend(method, payload) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
  } catch { /* best-effort */ }
}

export async function runTick(supabase, opts = {}) {
  await generateTick(supabase, opts).catch((e) => console.warn('[weekend] generate err', e?.message || e));
  await publishTick(supabase, opts).catch((e) => console.warn('[weekend] publish err', e?.message || e));
}

async function main() {
  loadDotEnv();
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  await runTick(supabase, {});
  console.log('[weekend_post] tick done');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd festivo-workers && node --test tests/regression/weekend-post-worker-tick.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full workers regression suite**

Run: `cd festivo-workers && npm run test:regression`
Expected: all tests pass (existing + new).

- [ ] **Step 6: Commit**

```bash
git add workers/weekend_post_worker.js tests/regression/weekend-post-worker-tick.test.js
git commit -m "feat(weekend): generate + publish ticks for weekend FB post"
```

---

## Task 11: Wire into cron + Telegram approval

**Files:**
- Modify: `festivo-workers/workers/cron_combo.js`
- Modify: `festivo-web/lib/telegram/socialBot.mjs`
- Modify: `festivo-web/app/api/telegram/social-bot/route.ts`
- Test: `festivo-web/lib/telegram/socialBot.test.mjs`

- [ ] **Step 1: Add the worker to the cron runner** — edit `festivo-workers/workers/cron_combo.js`, after the social repost line:

```js
run('email_cron_trigger.js');
run('social_repost_worker.js');
run('weekend_post_worker.js');
process.exit(0);
```

- [ ] **Step 2: Write the failing webhook test** — add to `festivo-web/lib/telegram/socialBot.test.mjs`:

```js
test("maps wpost publish_now callback to weekend-decision", () => {
  const action = mapUpdateToAction({
    callback_query: { id: "cq1", from: { id: 7 }, message: { chat: { id: 7 } }, data: "wpost:abc-123:publish_now" },
  });
  assert.equal(action.kind, "weekend-decision");
  assert.equal(action.postId, "abc-123");
  assert.equal(action.decision, "publish_now");
});

test("weekendDecisionToStatus maps decisions", () => {
  assert.equal(weekendDecisionToStatus("publish_now"), "publishing");
  assert.equal(weekendDecisionToStatus("schedule"), "scheduled");
  assert.equal(weekendDecisionToStatus("cancel"), "cancelled");
  assert.equal(weekendDecisionToStatus("regenerate"), null);
});
```

Add the import for `weekendDecisionToStatus` at the top of the test file's existing import from `./socialBot.mjs`.

- [ ] **Step 3: Run test to verify it fails**

Run: `cd festivo-web && node --test lib/telegram/socialBot.test.mjs`
Expected: FAIL — `weekend-decision` not produced; `weekendDecisionToStatus` undefined.

- [ ] **Step 4: Extend `festivo-web/lib/telegram/socialBot.mjs`** — in `mapUpdateToAction`, inside the `if (cq)` block, before the existing `job`-prefix checks add:

```js
    if (parts[0] === 'wpost') {
      return { kind: 'weekend-decision', postId: parts[1], decision: parts[2], ...base };
    }
```

And add the exported helper at the end of the file:

```js
// Maps a weekend-post decision button to the next scheduled-post status.
// 'regenerate' returns null (handled separately by re-running the worker generator).
export function weekendDecisionToStatus(decision) {
  const map = { publish_now: 'publishing', schedule: 'scheduled', cancel: 'cancelled' };
  return map[decision] || null;
}
```

- [ ] **Step 5: Handle the action in `festivo-web/app/api/telegram/social-bot/route.ts`** — add `weekendDecisionToStatus` to the import from `@/lib/telegram/socialBot.mjs`, then add a branch alongside the existing `decision` handling:

```ts
  } else if (action.kind === "weekend-decision") {
    if (action.decision === "schedule") {
      // Default schedule: upcoming Saturday 09:00 Europe/Sofia (UTC+3 in summer → 06:00Z).
      const { data: post } = await supabase
        .from("social_scheduled_posts")
        .select("period_start")
        .eq("id", action.postId)
        .maybeSingle();
      const sat = post?.period_start ? `${post.period_start}T06:00:00Z` : new Date().toISOString();
      await supabase
        .from("social_scheduled_posts")
        .update({ status: "scheduled", scheduled_at: sat })
        .eq("id", action.postId);
      await tg("answerCallbackQuery", { callback_query_id: action.callbackQueryId, text: "Насрочено за събота 9:00" });
    } else if (action.decision === "regenerate") {
      // Reset to draft; the worker will regenerate on its next trigger run.
      await supabase.from("social_scheduled_posts").update({ status: "draft" }).eq("id", action.postId);
      await tg("answerCallbackQuery", { callback_query_id: action.callbackQueryId, text: "Ще регенерирам при следващото пускане" });
    } else {
      const status = weekendDecisionToStatus(action.decision);
      if (status) {
        await supabase.from("social_scheduled_posts").update({ status }).eq("id", action.postId);
      }
      await tg("answerCallbackQuery", {
        callback_query_id: action.callbackQueryId,
        text: status === "publishing" ? "Публикувам…" : status || "ок",
      });
    }
  }
```

> Note: the whitelist gate at the top of the route already protects these callbacks — `social_repost_allowed_users` membership is required.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd festivo-web && node --test lib/telegram/socialBot.test.mjs`
Expected: PASS (existing + 2 new).

- [ ] **Step 7: Commit (both repos)**

```bash
cd festivo-workers && git add workers/cron_combo.js && git commit -m "feat(weekend): drive weekend_post_worker from cron_combo"
cd ../festivo-web && git add lib/telegram/socialBot.mjs app/api/telegram/social-bot/route.ts lib/telegram/socialBot.test.mjs && git commit -m "feat(weekend): telegram approval for weekend FB posts"
```

---

## Task 12: End-to-end manual verification

**Files:** none (operational).

- [ ] **Step 1: Confirm env + token** — ensure `FB_PAGE_ID`, `FB_PAGE_ACCESS_TOKEN`, `WEEKEND_POST_CHAT_ID`, `GEMINI_API_KEY` are set in `festivo-workers/.env`. Verify the chat id is a member of `social_repost_allowed_users` and has messaged the bot once.

- [ ] **Step 2: Force a draft generation** (bypass the day gate with `triggerDow = today`):

```bash
cd festivo-workers && node -e "import('./workers/weekend_post_worker.js').then(async m=>{const {createClient}=await import('@supabase/supabase-js');require('fs');const s=createClient(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);const r=await m.generateTick(s,{now:new Date(),triggerDow:new Date().getUTCDay()});console.log(r)})"
```
(First `node --env-file=.env` or source the env.) Expected: `{ created: '<uuid>', total: N }` and a Telegram preview with the collage + 4 buttons.

- [ ] **Step 3: Approve in Telegram** — tap **✅ Публикувай сега**. The webhook flips the row to `publishing`.

- [ ] **Step 4: Run the publish tick:**

```bash
cd festivo-workers && node workers/weekend_post_worker.js
```
Expected: the post appears on the Facebook Page; Telegram shows `✅ Публикувано…`; the DB row is `status='published'` with `external_post_id`.

- [ ] **Step 5: Verify on Facebook** — open the Page, confirm the post shows the collage image and the Bulgarian caption.

- [ ] **Step 6: Clean up the test draft if needed** — if you don't want the test post live, delete it on Facebook and set the row to `cancelled`.

---

## Self-Review notes

- **Spec coverage:** Telegram approval (Tasks 9, 11) ✓; Gemini caption with the existing model-chain (Task 4) ✓; text+collage (Tasks 5–8) ✓; weekly cron trigger (Tasks 2, 10, 11) ✓; Facebook publish (Tasks 5, 6, 10) ✓; visible-festival filter incl. `archived`/`cancelled` exclusion (Task 3) ✓; FB token as a Meta-side prerequisite, not a code task (Prerequisites) ✓.
- **Type consistency:** statuses (`draft|awaiting_review|scheduled|publishing|published|failed|cancelled`) match between the migration (Task 1), the state helpers (Task 7), and the worker (Task 10). `wpost:<id>:<decision>` callback format is identical in the keyboard (Task 9), `mapUpdateToAction` (Task 11), and the route handler (Task 11). Publisher contract `publish({ job, account?, media })` matches the existing registry and the new `facebook.js` (Task 6).
- **Idempotency:** `dedupe_key = weekend:<friday>` with a UNIQUE constraint + `getPostByDedupe` guard means the every-5-minute cron generates at most one draft per weekend even though it fires repeatedly on the trigger day.
