# Festivo социални мрежи auto-repost бот — Implementation Plan (Фаза 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Telegram бот, който приема Facebook видео линк, сваля клипа, показва preview с избор на мрежи (TikTok/Instagram) и публикува в Festivo акаунтите през официалните API-та, със scheduling.

**Architecture:** Лек webhook в `festivo-web` (Vercel) записва job-ове в Supabase. Cron worker в `festivo-workers` (Railway, ~всеки 1–2 мин) сваля видеото (yt-dlp), качва го в Storage, праща preview през Telegram и публикува per избрана мрежа през publisher registry (TikTok = file upload, Instagram = pull от signed URL). Чистата логика (state machine, парсване, dedupe, payload builders) е изолирана в тествани helper модули; целият мрежов I/O минава през инжектиран `fetch` за тестируемост.

**Tech Stack:** Node.js ESM, `node --test` + `node:assert/strict`, `@supabase/supabase-js`, Playwright base image, `yt-dlp` (бинарен), Next.js App Router (webhook), TikTok Content Posting API, Meta Graph API (Instagram Content Publishing).

**Референтна spec:** `docs/superpowers/specs/2026-06-09-social-repost-bot-design.md`

---

## Конвенции (важни за всеки таск)

- **Repo пътища:** `festivo-workers` е на `C:\Projects\festivo-workers`; `festivo-web` е на `C:\Projects\festivo-web`. Всеки таск казва изрично в кое repo е.
- **Тестове (workers):** `node --test tests/regression/<name>.test.js`. Импорт стил: `import test from 'node:test'; import assert from 'node:assert/strict';`.
- **ESM навсякъде** (`"type": "module"`). Без CommonJS `require`.
- **HTTP се инжектира:** всеки модул, който вика мрежа, приема `{ fetchImpl = fetch }` в опциите, за да се тества с фалшив fetch. Никога не викай глобален `fetch` директно вътре в логиката.
- **Без секрети в логове.** Никога не логвай access/refresh токени.
- **Git:** отделен feature branch; commit на всяка стъпка „Commit". Conventional Commits. Не пушвай освен ако потребителят поиска.
- **Преди да имплементираш TikTok/Meta заявка:** свери точния shape на API заявката с актуалната официална документация (context7 / официален docs сайт). Кодът по-долу е базиран на документираните потоци към 2026-06; ако API се различава, коригирай payload-а, но запази интерфейса и тестовете.

---

## File Structure

**`festivo-workers`:**
- `migrations/20260609_social_repost.sql` — нови таблици
- `Dockerfile` — добавя `yt-dlp`
- `workers/social_repost_worker.js` — cron entrypoint (claim → download → preview → publish → schedule)
- `workers/lib/social_repost_state.js` — чиста state machine + преходи (тествана)
- `workers/lib/social_repost_jobs.js` — DB CRUD/claim helpers за job-ове и акаунти
- `workers/lib/fb_video_download.js` — обвивка на yt-dlp + валидация
- `workers/lib/social_storage.js` — качване в Storage + signed URL
- `workers/lib/telegram_send.js` — Telegram Bot API (sendVideo, inline keyboard, sendMessage)
- `workers/lib/telegram_parse.js` — чисто парсване на update/callback (тествано)
- `workers/lib/oauth_tokens.js` — refresh на токени + getValidAccount (тествано с инжектиран fetch)
- `workers/lib/publishers/index.js` — registry `network → publisher`
- `workers/lib/publishers/tiktok.js` — TikTok Content Posting (file upload)
- `workers/lib/publishers/instagram.js` — Instagram Graph Content Publishing (pull от URL)
- `workers/lib/publishers/payloads.js` — чисти payload builders (тествани)
- `tests/regression/social-repost-*.test.js` — тестове

**`festivo-web`:**
- `app/api/telegram/social-bot/route.ts` — Telegram webhook
- `lib/telegram/socialBot.ts` — чисти helpers (валидация secret, whitelist, мап update→action) + тествани
- `app/api/telegram/social-bot/__tests__/...` или съществуващия test runner на web проекта

---

## Task 1: DB миграция за repost таблиците

**Repo:** `festivo-workers`
**Files:**
- Create: `migrations/20260609_social_repost.sql`

- [ ] **Step 1: Напиши миграцията**

```sql
-- 20260609_social_repost.sql
-- Festivo social repost bot (Phase 1): TikTok + Instagram

create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  network text not null check (network in ('tiktok','instagram')),
  external_id text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (network)
);

create table if not exists public.social_repost_jobs (
  id uuid primary key default gen_random_uuid(),
  telegram_chat_id bigint not null,
  telegram_user_id bigint not null,
  source_url text not null,
  video_storage_path text,
  caption text,
  hashtags jsonb not null default '[]'::jsonb,
  targets jsonb not null default '[]'::jsonb,
  target_results jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued','downloading','awaiting_review','scheduled','publishing','published','failed','cancelled')),
  scheduled_at timestamptz,
  dedupe_key text not null,
  error text,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dedupe_key)
);

create index if not exists idx_social_repost_jobs_status on public.social_repost_jobs (status);
create index if not exists idx_social_repost_jobs_scheduled_at on public.social_repost_jobs (scheduled_at);

create table if not exists public.social_repost_allowed_users (
  telegram_user_id bigint primary key,
  label text,
  created_at timestamptz not null default now()
);

-- RLS: service-role only (no public/authenticated access)
alter table public.social_accounts enable row level security;
alter table public.social_repost_jobs enable row level security;
alter table public.social_repost_allowed_users enable row level security;
-- No policies created => only service_role (which bypasses RLS) can access.
```

- [ ] **Step 2: Приложи миграцията към Supabase**

Приложи я през Supabase (MCP `apply_migration` или SQL editor). Потвърди че трите таблици съществуват:

Run (SQL): `select table_name from information_schema.tables where table_name like 'social_%';`
Expected: `social_accounts`, `social_repost_jobs`, `social_repost_allowed_users`

- [ ] **Step 3: Добави своя Telegram user id в whitelist**

Run (SQL): `insert into public.social_repost_allowed_users (telegram_user_id, label) values (<TVOя_TG_ID>, 'owner');`
(Telegram user id получаваш от @userinfobot.)

- [ ] **Step 4: Commit**

```bash
git add migrations/20260609_social_repost.sql
git commit -m "chore(db): add social repost bot tables and RLS"
```

---

## Task 2: Добави yt-dlp в Docker образа

**Repo:** `festivo-workers`
**Files:**
- Modify: `Dockerfile`

- [ ] **Step 1: Добави yt-dlp + ffmpeg към образа**

Замени съдържанието на `Dockerfile` с:

```dockerfile
FROM mcr.microsoft.com/playwright:v1.58.2-jammy
WORKDIR /app

# yt-dlp (standalone binary) + ffmpeg за video remux/validation
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl \
  && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
  && chmod a+rx /usr/local/bin/yt-dlp \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production
CMD ["npm","start"]
```

- [ ] **Step 2: Локална проверка (по желание, ако имаш Docker)**

Run: `docker build -t festivo-workers-test . && docker run --rm festivo-workers-test yt-dlp --version`
Expected: печата версия (напр. `2026.xx.xx`)

- [ ] **Step 3: Commit**

```bash
git add Dockerfile
git commit -m "chore: install yt-dlp and ffmpeg in worker image"
```

---

## Task 3: State machine helper (чиста логика, TDD)

**Repo:** `festivo-workers`
**Files:**
- Create: `workers/lib/social_repost_state.js`
- Test: `tests/regression/social-repost-state.test.js`

- [ ] **Step 1: Напиши падащ тест**

```js
// tests/regression/social-repost-state.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STATUSES,
  canTransition,
  nextStatusForDecision,
  isReadyToPublish,
  computeFinalStatus
} from '../../workers/lib/social_repost_state.js';

test('valid transitions allowed, invalid rejected', () => {
  assert.equal(canTransition('queued', 'downloading'), true);
  assert.equal(canTransition('downloading', 'awaiting_review'), true);
  assert.equal(canTransition('awaiting_review', 'publishing'), true);
  assert.equal(canTransition('published', 'queued'), false);
  assert.equal(canTransition('cancelled', 'publishing'), false);
});

test('nextStatusForDecision maps button decisions', () => {
  assert.equal(nextStatusForDecision('publish_now'), 'publishing');
  assert.equal(nextStatusForDecision('schedule'), 'scheduled');
  assert.equal(nextStatusForDecision('cancel'), 'cancelled');
  assert.equal(nextStatusForDecision('unknown'), null);
});

test('isReadyToPublish true only for scheduled jobs whose time has come', () => {
  const now = new Date('2026-06-09T18:00:00Z');
  assert.equal(isReadyToPublish({ status: 'scheduled', scheduled_at: '2026-06-09T17:59:00Z' }, now), true);
  assert.equal(isReadyToPublish({ status: 'scheduled', scheduled_at: '2026-06-09T18:30:00Z' }, now), false);
  assert.equal(isReadyToPublish({ status: 'publishing', scheduled_at: null }, now), false);
});

test('computeFinalStatus aggregates per-target results', () => {
  assert.equal(computeFinalStatus({ tiktok: { status: 'published' }, instagram: { status: 'published' } }), 'published');
  assert.equal(computeFinalStatus({ tiktok: { status: 'published' }, instagram: { status: 'failed' } }), 'published'); // partial success still published
  assert.equal(computeFinalStatus({ tiktok: { status: 'failed' }, instagram: { status: 'failed' } }), 'failed');
});
```

- [ ] **Step 2: Пусни теста — трябва да падне**

Run: `node --test tests/regression/social-repost-state.test.js`
Expected: FAIL (`Cannot find module ... social_repost_state.js`)

- [ ] **Step 3: Имплементирай state machine-а**

```js
// workers/lib/social_repost_state.js
export const STATUSES = [
  'queued', 'downloading', 'awaiting_review',
  'scheduled', 'publishing', 'published', 'failed', 'cancelled'
];

const ALLOWED = {
  queued: ['downloading', 'failed', 'cancelled'],
  downloading: ['awaiting_review', 'failed'],
  awaiting_review: ['publishing', 'scheduled', 'cancelled', 'awaiting_review'],
  scheduled: ['publishing', 'cancelled'],
  publishing: ['published', 'failed'],
  published: [],
  failed: [],
  cancelled: []
};

export function canTransition(from, to) {
  return Array.isArray(ALLOWED[from]) && ALLOWED[from].includes(to);
}

export function nextStatusForDecision(decision) {
  switch (decision) {
    case 'publish_now': return 'publishing';
    case 'schedule': return 'scheduled';
    case 'cancel': return 'cancelled';
    default: return null;
  }
}

export function isReadyToPublish(job, now = new Date()) {
  if (!job || job.status !== 'scheduled' || !job.scheduled_at) return false;
  return new Date(job.scheduled_at).getTime() <= now.getTime();
}

export function computeFinalStatus(targetResults) {
  const values = Object.values(targetResults || {});
  if (values.length === 0) return 'failed';
  const anyPublished = values.some((r) => r && r.status === 'published');
  return anyPublished ? 'published' : 'failed';
}
```

- [ ] **Step 4: Пусни теста — трябва да мине**

Run: `node --test tests/regression/social-repost-state.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add workers/lib/social_repost_state.js tests/regression/social-repost-state.test.js
git commit -m "feat: add social repost state machine helpers"
```

---

## Task 4: dedupe key + hashtag/caption парсване (чиста логика, TDD)

**Repo:** `festivo-workers`
**Files:**
- Create: `workers/lib/social_repost_jobs.js` (само чистите helper-и в този таск; DB методите в Task 9)
- Test: `tests/regression/social-repost-parse.test.js`

- [ ] **Step 1: Напиши падащ тест**

```js
// tests/regression/social-repost-parse.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDedupeKey,
  extractHashtags,
  buildCaptionWithTags,
  normalizeTargets
} from '../../workers/lib/social_repost_jobs.js';

test('buildDedupeKey is stable and chat-scoped', () => {
  const a = buildDedupeKey(123, 'https://facebook.com/reel/55');
  const b = buildDedupeKey(123, 'https://facebook.com/reel/55');
  const c = buildDedupeKey(999, 'https://facebook.com/reel/55');
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('extractHashtags pulls unique #tags preserving order', () => {
  assert.deepEqual(extractHashtags('Купон #fest #bg #fest'), ['fest', 'bg']);
  assert.deepEqual(extractHashtags('no tags here'), []);
});

test('buildCaptionWithTags appends tags not already present', () => {
  assert.equal(buildCaptionWithTags('Купон', ['fest', 'bg']), 'Купон #fest #bg');
  assert.equal(buildCaptionWithTags('Купон #fest', ['fest', 'bg']), 'Купон #fest #bg');
});

test('normalizeTargets filters to supported networks, dedupes', () => {
  assert.deepEqual(normalizeTargets(['tiktok', 'instagram', 'tiktok', 'x']), ['tiktok', 'instagram']);
  assert.deepEqual(normalizeTargets([]), []);
});
```

- [ ] **Step 2: Пусни теста — трябва да падне**

Run: `node --test tests/regression/social-repost-parse.test.js`
Expected: FAIL (module not found)

- [ ] **Step 3: Имплементирай чистите helper-и**

```js
// workers/lib/social_repost_jobs.js
import crypto from 'node:crypto';

export const SUPPORTED_NETWORKS = ['tiktok', 'instagram'];

export function buildDedupeKey(chatId, sourceUrl) {
  const raw = `${chatId}::${String(sourceUrl).trim()}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

export function extractHashtags(text) {
  if (!text) return [];
  const out = [];
  const seen = new Set();
  for (const m of String(text).matchAll(/#([\p{L}0-9_]+)/gu)) {
    const tag = m[1];
    if (!seen.has(tag)) { seen.add(tag); out.push(tag); }
  }
  return out;
}

export function buildCaptionWithTags(caption, tags) {
  const base = (caption || '').trim();
  const present = new Set(extractHashtags(base));
  const toAdd = (tags || []).filter((t) => !present.has(t));
  if (toAdd.length === 0) return base;
  const tagStr = toAdd.map((t) => `#${t}`).join(' ');
  return base ? `${base} ${tagStr}` : tagStr;
}

export function normalizeTargets(targets) {
  const seen = new Set();
  const out = [];
  for (const t of targets || []) {
    if (SUPPORTED_NETWORKS.includes(t) && !seen.has(t)) { seen.add(t); out.push(t); }
  }
  return out;
}
```

- [ ] **Step 4: Пусни теста — трябва да мине**

Run: `node --test tests/regression/social-repost-parse.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add workers/lib/social_repost_jobs.js tests/regression/social-repost-parse.test.js
git commit -m "feat: add dedupe/hashtag/target parsing helpers"
```

---

## Task 5: Telegram update парсване (чиста логика, TDD)

**Repo:** `festivo-workers`
**Files:**
- Create: `workers/lib/telegram_parse.js`
- Test: `tests/regression/social-repost-telegram-parse.test.js`

- [ ] **Step 1: Напиши падащ тест**

```js
// tests/regression/social-repost-telegram-parse.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTelegramUpdate, buildReviewKeyboard, parseCallbackData } from '../../workers/lib/telegram_parse.js';

test('parseTelegramUpdate detects a facebook link message', () => {
  const upd = { message: { chat: { id: 10 }, from: { id: 20 }, text: 'виж https://www.facebook.com/reel/123' } };
  const r = parseTelegramUpdate(upd);
  assert.equal(r.kind, 'link');
  assert.equal(r.chatId, 10);
  assert.equal(r.userId, 20);
  assert.equal(r.url, 'https://www.facebook.com/reel/123');
});

test('parseTelegramUpdate detects plain caption-edit text', () => {
  const upd = { message: { chat: { id: 10 }, from: { id: 20 }, text: 'Ново описание #bg' } };
  const r = parseTelegramUpdate(upd);
  assert.equal(r.kind, 'text');
  assert.equal(r.text, 'Ново описание #bg');
});

test('parseTelegramUpdate detects callback button', () => {
  const upd = { callback_query: { message: { chat: { id: 10 } }, from: { id: 20 }, data: 'job:abc:publish_now' } };
  const r = parseTelegramUpdate(upd);
  assert.equal(r.kind, 'callback');
  assert.deepEqual(parseCallbackData(r.data), { jobId: 'abc', decision: 'publish_now' });
});

test('buildReviewKeyboard contains network toggles and actions', () => {
  const kb = buildReviewKeyboard('abc', ['tiktok']);
  const flat = JSON.stringify(kb);
  assert.match(flat, /job:abc:toggle:tiktok/);
  assert.match(flat, /job:abc:toggle:instagram/);
  assert.match(flat, /job:abc:publish_now/);
  assert.match(flat, /job:abc:cancel/);
});
```

- [ ] **Step 2: Пусни теста — трябва да падне**

Run: `node --test tests/regression/social-repost-telegram-parse.test.js`
Expected: FAIL (module not found)

- [ ] **Step 3: Имплементирай парсването**

```js
// workers/lib/telegram_parse.js
const FB_URL_RE = /(https?:\/\/(?:www\.|m\.|web\.)?(?:facebook\.com|fb\.watch|fb\.com)\/[^\s]+)/i;

export function parseTelegramUpdate(update) {
  if (update?.callback_query) {
    const cq = update.callback_query;
    return {
      kind: 'callback',
      chatId: cq.message?.chat?.id ?? null,
      userId: cq.from?.id ?? null,
      data: cq.data ?? '',
      callbackQueryId: cq.id ?? null
    };
  }
  const msg = update?.message;
  if (msg && typeof msg.text === 'string') {
    const chatId = msg.chat?.id ?? null;
    const userId = msg.from?.id ?? null;
    const m = msg.text.match(FB_URL_RE);
    if (m) return { kind: 'link', chatId, userId, url: m[1] };
    return { kind: 'text', chatId, userId, text: msg.text.trim() };
  }
  return { kind: 'ignore' };
}

export function parseCallbackData(data) {
  // formats: job:<id>:<decision>  | job:<id>:toggle:<network>
  const parts = String(data).split(':');
  if (parts[0] !== 'job') return null;
  const jobId = parts[1];
  if (parts[2] === 'toggle') return { jobId, decision: 'toggle', network: parts[3] };
  return { jobId, decision: parts[2] };
}

export function buildReviewKeyboard(jobId, selectedTargets = []) {
  const mark = (n) => (selectedTargets.includes(n) ? '✅ ' : '☐ ');
  return {
    inline_keyboard: [
      [
        { text: `${mark('tiktok')}TikTok`, callback_data: `job:${jobId}:toggle:tiktok` },
        { text: `${mark('instagram')}Instagram`, callback_data: `job:${jobId}:toggle:instagram` }
      ],
      [
        { text: '✅ Публикувай сега', callback_data: `job:${jobId}:publish_now` },
        { text: '🕒 Насрочи', callback_data: `job:${jobId}:schedule` }
      ],
      [{ text: '❌ Откажи', callback_data: `job:${jobId}:cancel` }]
    ]
  };
}
```

- [ ] **Step 4: Пусни теста — трябва да мине**

Run: `node --test tests/regression/social-repost-telegram-parse.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add workers/lib/telegram_parse.js tests/regression/social-repost-telegram-parse.test.js
git commit -m "feat: add telegram update parsing and review keyboard"
```

---

## Task 6: Publisher payload builders (чиста логика, TDD)

**Repo:** `festivo-workers`
**Files:**
- Create: `workers/lib/publishers/payloads.js`
- Test: `tests/regression/social-repost-payloads.test.js`

> **Преди имплементация:** свери точните полета на TikTok `/v2/post/publish/video/init/` и Meta `POST /{ig-user-id}/media` с актуалните официални docs. Полетата по-долу отразяват документираните към 2026-06; коригирай при разлика, без да чупиш тестовете.

- [ ] **Step 1: Напиши падащ тест**

```js
// tests/regression/social-repost-payloads.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTikTokInitPayload, buildInstagramContainerPayload } from '../../workers/lib/publishers/payloads.js';

test('buildTikTokInitPayload sets caption and file size', () => {
  const p = buildTikTokInitPayload({ caption: 'Купон #bg', videoSizeBytes: 1048576, privacy: 'SELF_ONLY' });
  assert.equal(p.post_info.title, 'Купон #bg');
  assert.equal(p.post_info.privacy_level, 'SELF_ONLY');
  assert.equal(p.source_info.source, 'FILE_UPLOAD');
  assert.equal(p.source_info.video_size, 1048576);
});

test('buildInstagramContainerPayload builds reels container from public url', () => {
  const p = buildInstagramContainerPayload({ videoUrl: 'https://x/v.mp4', caption: 'Купон #bg' });
  assert.equal(p.media_type, 'REELS');
  assert.equal(p.video_url, 'https://x/v.mp4');
  assert.equal(p.caption, 'Купон #bg');
});
```

- [ ] **Step 2: Пусни теста — трябва да падне**

Run: `node --test tests/regression/social-repost-payloads.test.js`
Expected: FAIL (module not found)

- [ ] **Step 3: Имплементирай builder-ите**

```js
// workers/lib/publishers/payloads.js

// TikTok Content Posting API — init step (direct post, file upload)
export function buildTikTokInitPayload({ caption, videoSizeBytes, privacy = 'SELF_ONLY', chunkSize }) {
  const size = Number(videoSizeBytes);
  return {
    post_info: {
      title: caption || '',
      privacy_level: privacy, // SELF_ONLY until app is audited; PUBLIC_TO_EVERYONE after
      disable_comment: false,
      disable_duet: false,
      disable_stitch: false
    },
    source_info: {
      source: 'FILE_UPLOAD',
      video_size: size,
      chunk_size: chunkSize || size,
      total_chunk_count: 1
    }
  };
}

// Instagram Graph API — create media container (REELS)
export function buildInstagramContainerPayload({ videoUrl, caption }) {
  return {
    media_type: 'REELS',
    video_url: videoUrl,
    caption: caption || ''
  };
}
```

- [ ] **Step 4: Пусни теста — трябва да мине**

Run: `node --test tests/regression/social-repost-payloads.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add workers/lib/publishers/payloads.js tests/regression/social-repost-payloads.test.js
git commit -m "feat: add tiktok/instagram payload builders"
```

---

## Task 7: OAuth token refresh helper (инжектиран fetch, TDD)

**Repo:** `festivo-workers`
**Files:**
- Create: `workers/lib/oauth_tokens.js`
- Test: `tests/regression/social-repost-oauth.test.js`

- [ ] **Step 1: Напиши падащ тест**

```js
// tests/regression/social-repost-oauth.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { needsRefresh, refreshTikTokToken } from '../../workers/lib/oauth_tokens.js';

test('needsRefresh true when expiring within 5 min', () => {
  const now = new Date('2026-06-09T12:00:00Z');
  assert.equal(needsRefresh({ expires_at: '2026-06-09T12:03:00Z' }, now), true);
  assert.equal(needsRefresh({ expires_at: '2026-06-09T13:00:00Z' }, now), false);
  assert.equal(needsRefresh({ expires_at: null }, now), true);
});

test('refreshTikTokToken posts refresh grant and maps response', async () => {
  let captured;
  const fakeFetch = async (url, opts) => {
    captured = { url, opts };
    return { ok: true, json: async () => ({ access_token: 'AT2', refresh_token: 'RT2', expires_in: 86400, scope: 'video.publish' }) };
  };
  const out = await refreshTikTokToken(
    { clientKey: 'ck', clientSecret: 'cs', refreshToken: 'RT1' },
    { fetchImpl: fakeFetch, now: new Date('2026-06-09T12:00:00Z') }
  );
  assert.match(captured.url, /open\.tiktokapis\.com/);
  assert.equal(out.access_token, 'AT2');
  assert.equal(out.refresh_token, 'RT2');
  assert.equal(out.expires_at, '2026-06-10T12:00:00.000Z');
});
```

- [ ] **Step 2: Пусни теста — трябва да падне**

Run: `node --test tests/regression/social-repost-oauth.test.js`
Expected: FAIL (module not found)

- [ ] **Step 3: Имплементирай refresh helper-ите**

```js
// workers/lib/oauth_tokens.js
const REFRESH_SKEW_MS = 5 * 60 * 1000;

export function needsRefresh(account, now = new Date()) {
  if (!account?.expires_at) return true;
  return new Date(account.expires_at).getTime() - now.getTime() <= REFRESH_SKEW_MS;
}

function expiresAtFrom(now, expiresInSec) {
  return new Date(now.getTime() + Number(expiresInSec) * 1000).toISOString();
}

export async function refreshTikTokToken({ clientKey, clientSecret, refreshToken }, { fetchImpl = fetch, now = new Date() } = {}) {
  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  });
  const res = await fetchImpl('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!res.ok) throw new Error(`tiktok token refresh failed: ${res.status}`);
  const j = await res.json();
  return {
    access_token: j.access_token,
    refresh_token: j.refresh_token || refreshToken,
    expires_at: expiresAtFrom(now, j.expires_in),
    scope: j.scope || null
  };
}

// Instagram/Meta long-lived tokens (~60 days) are refreshed via the
// graph long-lived-token exchange; see Task 11 publisher for usage.
export async function refreshInstagramToken({ appSecret, accessToken }, { fetchImpl = fetch, now = new Date() } = {}) {
  const url = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', process.env.META_APP_ID || '');
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('fb_exchange_token', accessToken);
  const res = await fetchImpl(url.toString(), { method: 'GET' });
  if (!res.ok) throw new Error(`instagram token refresh failed: ${res.status}`);
  const j = await res.json();
  return {
    access_token: j.access_token,
    refresh_token: null,
    expires_at: expiresAtFrom(now, j.expires_in || 60 * 24 * 3600),
    scope: null
  };
}
```

- [ ] **Step 4: Пусни теста — трябва да мине**

Run: `node --test tests/regression/social-repost-oauth.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add workers/lib/oauth_tokens.js tests/regression/social-repost-oauth.test.js
git commit -m "feat: add oauth token refresh helpers"
```

---

## Task 8: Publisher registry + интерфейс (TDD)

**Repo:** `festivo-workers`
**Files:**
- Create: `workers/lib/publishers/index.js`
- Test: `tests/regression/social-repost-registry.test.js`

- [ ] **Step 1: Напиши падащ тест**

```js
// tests/regression/social-repost-registry.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { getPublisher, publishToTargets } from '../../workers/lib/publishers/index.js';

test('getPublisher returns a publisher per supported network', () => {
  assert.equal(typeof getPublisher('tiktok').publish, 'function');
  assert.equal(typeof getPublisher('instagram').publish, 'function');
  assert.equal(getPublisher('nope'), null);
});

test('publishToTargets runs each target and collects per-target results', async () => {
  const fakeRegistry = {
    tiktok: { publish: async () => ({ status: 'published', external_post_id: 'tt1' }) },
    instagram: { publish: async () => { throw new Error('boom'); } }
  };
  const results = await publishToTargets({
    targets: ['tiktok', 'instagram'],
    job: { id: 'j1' },
    accounts: { tiktok: {}, instagram: {} },
    media: {},
    registry: fakeRegistry
  });
  assert.equal(results.tiktok.status, 'published');
  assert.equal(results.tiktok.external_post_id, 'tt1');
  assert.equal(results.instagram.status, 'failed');
  assert.match(results.instagram.error, /boom/);
});
```

- [ ] **Step 2: Пусни теста — трябва да падне**

Run: `node --test tests/regression/social-repost-registry.test.js`
Expected: FAIL (module not found)

- [ ] **Step 3: Имплементирай registry-то**

```js
// workers/lib/publishers/index.js
import * as tiktok from './tiktok.js';
import * as instagram from './instagram.js';

const DEFAULT_REGISTRY = { tiktok, instagram };

export function getPublisher(network, registry = DEFAULT_REGISTRY) {
  const p = registry[network];
  return p && typeof p.publish === 'function' ? p : null;
}

// Publishes to each target independently. One failure never blocks the others.
// Returns { [network]: { status, external_post_id?, error? } }
export async function publishToTargets({ targets, job, accounts, media, registry = DEFAULT_REGISTRY }) {
  const results = {};
  for (const network of targets) {
    const publisher = getPublisher(network, registry);
    if (!publisher) { results[network] = { status: 'failed', error: 'unsupported network' }; continue; }
    try {
      results[network] = await publisher.publish({ job, account: accounts[network], media });
    } catch (err) {
      results[network] = { status: 'failed', error: String(err?.message || err).slice(0, 500) };
    }
  }
  return results;
}
```

- [ ] **Step 4: Пусни теста — трябва да мине**

Run: `node --test tests/regression/social-repost-registry.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add workers/lib/publishers/index.js tests/regression/social-repost-registry.test.js
git commit -m "feat: add publisher registry with per-target isolation"
```

---

## Task 9: TikTok publisher (инжектиран fetch, TDD за happy path)

**Repo:** `festivo-workers`
**Files:**
- Create: `workers/lib/publishers/tiktok.js`
- Test: `tests/regression/social-repost-tiktok.test.js`

> **Преди имплементация:** свери актуалния flow на TikTok Content Posting API (init → upload chunk(s) → status poll). Кодът отразява документирания direct-post FILE_UPLOAD flow.

- [ ] **Step 1: Напиши падащ тест (с фалшив fetch + фалшив файлов четец)**

```js
// tests/regression/social-repost-tiktok.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { publish } from '../../workers/lib/publishers/tiktok.js';

test('publish inits, uploads, and returns published id', async () => {
  const calls = [];
  const fakeFetch = async (url, opts) => {
    calls.push({ url, method: opts?.method });
    if (url.includes('/publish/video/init/')) {
      return { ok: true, json: async () => ({ data: { publish_id: 'PUB1', upload_url: 'https://upload/here' } }) };
    }
    if (url === 'https://upload/here') {
      return { ok: true, status: 201, json: async () => ({}) };
    }
    if (url.includes('/publish/status/fetch/')) {
      return { ok: true, json: async () => ({ data: { status: 'PUBLISH_COMPLETE', publicaly_available_post_id: ['1234'] } }) };
    }
    throw new Error('unexpected url ' + url);
  };
  const out = await publish({
    job: { caption: 'Купон #bg' },
    account: { access_token: 'AT', external_id: 'open1' },
    media: { buffer: Buffer.from('xxxx'), sizeBytes: 4, mime: 'video/mp4' },
    deps: { fetchImpl: fakeFetch, sleep: async () => {} }
  });
  assert.equal(out.status, 'published');
  assert.equal(out.external_post_id, 'PUB1');
  assert.ok(calls.some((c) => c.url.includes('/publish/video/init/')));
  assert.ok(calls.some((c) => c.url === 'https://upload/here'));
});
```

- [ ] **Step 2: Пусни теста — трябва да падне**

Run: `node --test tests/regression/social-repost-tiktok.test.js`
Expected: FAIL (module not found)

- [ ] **Step 3: Имплементирай TikTok publisher-а**

```js
// workers/lib/publishers/tiktok.js
import { buildTikTokInitPayload } from './payloads.js';

const API = 'https://open.tiktokapis.com/v2';

export async function publish({ job, account, media, deps = {} }) {
  const fetchImpl = deps.fetchImpl || fetch;
  const sleep = deps.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const privacy = process.env.TIKTOK_PRIVACY_LEVEL || 'SELF_ONLY';

  // 1) init
  const initRes = await fetchImpl(`${API}/post/publish/video/init/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${account.access_token}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(buildTikTokInitPayload({ caption: job.caption, videoSizeBytes: media.sizeBytes, privacy }))
  });
  if (!initRes.ok) throw new Error(`tiktok init failed: ${initRes.status}`);
  const initJson = await initRes.json();
  const publishId = initJson?.data?.publish_id;
  const uploadUrl = initJson?.data?.upload_url;
  if (!publishId || !uploadUrl) throw new Error('tiktok init missing publish_id/upload_url');

  // 2) upload single chunk (whole file)
  const upRes = await fetchImpl(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': media.mime || 'video/mp4',
      'Content-Range': `bytes 0-${media.sizeBytes - 1}/${media.sizeBytes}`
    },
    body: media.buffer
  });
  if (!upRes.ok && upRes.status !== 201) throw new Error(`tiktok upload failed: ${upRes.status}`);

  // 3) poll status (bounded)
  for (let i = 0; i < 10; i++) {
    const stRes = await fetchImpl(`${API}/post/publish/status/fetch/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${account.access_token}`, 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ publish_id: publishId })
    });
    if (stRes.ok) {
      const st = await stRes.json();
      const status = st?.data?.status;
      if (status === 'PUBLISH_COMPLETE') return { status: 'published', external_post_id: publishId };
      if (status === 'FAILED') throw new Error(`tiktok publish failed: ${JSON.stringify(st?.data)}`);
    }
    await sleep(3000);
  }
  // Uploaded but not confirmed within window — treat as draft (visible in app).
  return { status: 'published', external_post_id: publishId, note: 'status_unconfirmed' };
}
```

- [ ] **Step 4: Пусни теста — трябва да мине**

Run: `node --test tests/regression/social-repost-tiktok.test.js`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add workers/lib/publishers/tiktok.js tests/regression/social-repost-tiktok.test.js
git commit -m "feat: add tiktok publisher (init/upload/poll)"
```

---

## Task 10: Instagram publisher (инжектиран fetch, TDD за happy path)

**Repo:** `festivo-workers`
**Files:**
- Create: `workers/lib/publishers/instagram.js`
- Test: `tests/regression/social-repost-instagram.test.js`

> **Преди имплементация:** свери Meta Graph Content Publishing flow (create container → poll `status_code` → publish). Изисква IG Business id + публичен `video_url`.

- [ ] **Step 1: Напиши падащ тест**

```js
// tests/regression/social-repost-instagram.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { publish } from '../../workers/lib/publishers/instagram.js';

test('publish creates container, waits ready, publishes', async () => {
  const fakeFetch = async (url, opts) => {
    if (url.includes('/media') && !url.includes('media_publish')) {
      return { ok: true, json: async () => ({ id: 'CONTAINER1' }) };
    }
    if (url.includes('fields=status_code')) {
      return { ok: true, json: async () => ({ status_code: 'FINISHED' }) };
    }
    if (url.includes('media_publish')) {
      return { ok: true, json: async () => ({ id: 'MEDIA1' }) };
    }
    throw new Error('unexpected url ' + url);
  };
  const out = await publish({
    job: { caption: 'Купон #bg' },
    account: { access_token: 'AT', external_id: 'IGUSER1' },
    media: { publicUrl: 'https://x/v.mp4' },
    deps: { fetchImpl: fakeFetch, sleep: async () => {} }
  });
  assert.equal(out.status, 'published');
  assert.equal(out.external_post_id, 'MEDIA1');
});
```

- [ ] **Step 2: Пусни теста — трябва да падне**

Run: `node --test tests/regression/social-repost-instagram.test.js`
Expected: FAIL (module not found)

- [ ] **Step 3: Имплементирай Instagram publisher-а**

```js
// workers/lib/publishers/instagram.js
import { buildInstagramContainerPayload } from './payloads.js';

const GRAPH = 'https://graph.facebook.com/v21.0';

export async function publish({ job, account, media, deps = {} }) {
  const fetchImpl = deps.fetchImpl || fetch;
  const sleep = deps.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const igUserId = account.external_id;
  const token = account.access_token;
  if (!media.publicUrl) throw new Error('instagram requires a public video url');

  // 1) create container
  const payload = buildInstagramContainerPayload({ videoUrl: media.publicUrl, caption: job.caption });
  const createUrl = new URL(`${GRAPH}/${igUserId}/media`);
  createUrl.searchParams.set('access_token', token);
  for (const [k, v] of Object.entries(payload)) createUrl.searchParams.set(k, v);
  const createRes = await fetchImpl(createUrl.toString(), { method: 'POST' });
  if (!createRes.ok) throw new Error(`ig container failed: ${createRes.status}`);
  const containerId = (await createRes.json())?.id;
  if (!containerId) throw new Error('ig container missing id');

  // 2) poll until FINISHED (reels processing)
  let ready = false;
  for (let i = 0; i < 20; i++) {
    const stUrl = `${GRAPH}/${containerId}?fields=status_code&access_token=${encodeURIComponent(token)}`;
    const stRes = await fetchImpl(stUrl, { method: 'GET' });
    if (stRes.ok) {
      const code = (await stRes.json())?.status_code;
      if (code === 'FINISHED') { ready = true; break; }
      if (code === 'ERROR' || code === 'EXPIRED') throw new Error(`ig container status ${code}`);
    }
    await sleep(4000);
  }
  if (!ready) throw new Error('ig container not ready within timeout');

  // 3) publish
  const pubUrl = new URL(`${GRAPH}/${igUserId}/media_publish`);
  pubUrl.searchParams.set('creation_id', containerId);
  pubUrl.searchParams.set('access_token', token);
  const pubRes = await fetchImpl(pubUrl.toString(), { method: 'POST' });
  if (!pubRes.ok) throw new Error(`ig publish failed: ${pubRes.status}`);
  const mediaId = (await pubRes.json())?.id;
  return { status: 'published', external_post_id: mediaId };
}
```

- [ ] **Step 4: Пусни теста — трябва да мине**

Run: `node --test tests/regression/social-repost-instagram.test.js`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add workers/lib/publishers/instagram.js tests/regression/social-repost-instagram.test.js
git commit -m "feat: add instagram reels publisher"
```

---

## Task 11: FB downloader (yt-dlp обвивка)

**Repo:** `festivo-workers`
**Files:**
- Create: `workers/lib/fb_video_download.js`
- Test: `tests/regression/social-repost-download.test.js`

- [ ] **Step 1: Напиши падащ тест (валидация е чиста, тества се без yt-dlp)**

```js
// tests/regression/social-repost-download.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateVideoFile, MAX_VIDEO_BYTES } from '../../workers/lib/fb_video_download.js';

test('validateVideoFile rejects too-large or empty files', () => {
  assert.throws(() => validateVideoFile({ sizeBytes: 0, mime: 'video/mp4' }), /empty/);
  assert.throws(() => validateVideoFile({ sizeBytes: MAX_VIDEO_BYTES + 1, mime: 'video/mp4' }), /too large/);
  assert.throws(() => validateVideoFile({ sizeBytes: 100, mime: 'text/html' }), /not a video/);
});

test('validateVideoFile accepts a normal mp4', () => {
  assert.doesNotThrow(() => validateVideoFile({ sizeBytes: 5_000_000, mime: 'video/mp4' }));
});
```

- [ ] **Step 2: Пусни теста — трябва да падне**

Run: `node --test tests/regression/social-repost-download.test.js`
Expected: FAIL (module not found)

- [ ] **Step 3: Имплементирай downloader-а**

```js
// workers/lib/fb_video_download.js
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

export const MAX_VIDEO_BYTES = 290 * 1024 * 1024; // TikTok/IG safe ceiling
export const MIN_VIDEO_BYTES = 10 * 1024;

export function validateVideoFile({ sizeBytes, mime }) {
  if (!sizeBytes || sizeBytes < MIN_VIDEO_BYTES) throw new Error('downloaded file empty or too small');
  if (sizeBytes > MAX_VIDEO_BYTES) throw new Error('downloaded file too large');
  if (mime && !String(mime).startsWith('video/')) throw new Error('downloaded file is not a video');
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    p.stderr.on('data', (d) => { stderr += d.toString(); });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}: ${stderr.slice(0, 500)}`))));
  });
}

// Downloads a Facebook video to a temp mp4 and returns { buffer, sizeBytes, mime, cleanup }.
export async function downloadFacebookVideo(sourceUrl, { ytDlpPath = 'yt-dlp' } = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fbdl-'));
  const out = path.join(tmpDir, `${crypto.randomUUID()}.mp4`);
  const args = [
    '-f', 'mp4/best[ext=mp4]/best',
    '--no-playlist', '--no-warnings', '--max-filesize', `${MAX_VIDEO_BYTES}`,
    '-o', out, sourceUrl
  ];
  await run(ytDlpPath, args);
  if (!fs.existsSync(out)) throw new Error('yt-dlp produced no file (private/unsupported video?)');
  const buffer = fs.readFileSync(out);
  const file = { buffer, sizeBytes: buffer.length, mime: 'video/mp4' };
  validateVideoFile(file);
  return {
    ...file,
    cleanup: () => { try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {} }
  };
}
```

- [ ] **Step 4: Пусни теста — трябва да мине**

Run: `node --test tests/regression/social-repost-download.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Ръчна интеграционна проверка (по желание, иска yt-dlp локално)**

Run: `node -e "import('./workers/lib/fb_video_download.js').then(m=>m.downloadFacebookVideo(process.argv[1])).then(r=>console.log('ok',r.sizeBytes))" "<публичен FB reel url>"`
Expected: `ok <bytes>`

- [ ] **Step 6: Commit**

```bash
git add workers/lib/fb_video_download.js tests/regression/social-repost-download.test.js
git commit -m "feat: add yt-dlp facebook video downloader with validation"
```

---

## Task 12: Storage upload + signed URL helper

**Repo:** `festivo-workers`
**Files:**
- Create: `workers/lib/social_storage.js`
- Test: `tests/regression/social-repost-storage.test.js`

- [ ] **Step 1: Напиши падащ тест (с фалшив Supabase storage клиент)**

```js
// tests/regression/social-repost-storage.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStoragePath, uploadTempVideo } from '../../workers/lib/social_storage.js';

test('buildStoragePath namespaces by job id and date', () => {
  const p = buildStoragePath('job123', new Date('2026-06-09T00:00:00Z'));
  assert.match(p, /^repost\/2026-06-09\/job123\.mp4$/);
});

test('uploadTempVideo uploads then returns path and signed url', async () => {
  const fakeBucket = {
    upload: async (path) => ({ data: { path }, error: null }),
    createSignedUrl: async (path) => ({ data: { signedUrl: `https://signed/${path}` }, error: null })
  };
  const fakeSupabase = { storage: { from: () => fakeBucket } };
  const r = await uploadTempVideo(fakeSupabase, { jobId: 'job123', buffer: Buffer.from('x'), now: new Date('2026-06-09T00:00:00Z') });
  assert.equal(r.path, 'repost/2026-06-09/job123.mp4');
  assert.equal(r.signedUrl, 'https://signed/repost/2026-06-09/job123.mp4');
});
```

- [ ] **Step 2: Пусни теста — трябва да падне**

Run: `node --test tests/regression/social-repost-storage.test.js`
Expected: FAIL (module not found)

- [ ] **Step 3: Имплементирай storage helper-а**

```js
// workers/lib/social_storage.js
export const REPOST_BUCKET = process.env.SOCIAL_REPOST_BUCKET || 'social-repost-temp';
const SIGNED_URL_TTL_SEC = 60 * 60; // 1h, enough for IG to pull

export function buildStoragePath(jobId, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  return `repost/${day}/${jobId}.mp4`;
}

export async function uploadTempVideo(supabase, { jobId, buffer, now = new Date() }) {
  const path = buildStoragePath(jobId, now);
  const bucket = supabase.storage.from(REPOST_BUCKET);
  const { error: upErr } = await bucket.upload(path, buffer, { contentType: 'video/mp4', upsert: true });
  if (upErr) throw new Error(`storage upload failed: ${upErr.message}`);
  const { data, error: signErr } = await bucket.createSignedUrl(path, SIGNED_URL_TTL_SEC);
  if (signErr) throw new Error(`signed url failed: ${signErr.message}`);
  return { path, signedUrl: data.signedUrl };
}

export async function deleteTempVideo(supabase, path) {
  if (!path) return;
  try { await supabase.storage.from(REPOST_BUCKET).remove([path]); } catch {}
}
```

- [ ] **Step 4: Пусни теста — трябва да мине**

Run: `node --test tests/regression/social-repost-storage.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Създай Storage bucket-а в Supabase**

Създай private bucket `social-repost-temp` (Supabase Dashboard → Storage → New bucket, public = off).

- [ ] **Step 6: Commit**

```bash
git add workers/lib/social_storage.js tests/regression/social-repost-storage.test.js
git commit -m "feat: add temp video storage upload and signed url helper"
```

---

## Task 13: Telegram send client

**Repo:** `festivo-workers`
**Files:**
- Create: `workers/lib/telegram_send.js`
- Test: `tests/regression/social-repost-telegram-send.test.js`

- [ ] **Step 1: Напиши падащ тест (инжектиран fetch)**

```js
// tests/regression/social-repost-telegram-send.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { TelegramClient } from '../../workers/lib/telegram_send.js';

test('sendMessage posts to bot api with chat id and text', async () => {
  let captured;
  const fakeFetch = async (url, opts) => {
    captured = { url, body: JSON.parse(opts.body) };
    return { ok: true, json: async () => ({ ok: true, result: { message_id: 1 } }) };
  };
  const tg = new TelegramClient('TOKEN', { fetchImpl: fakeFetch });
  await tg.sendMessage(42, 'здрасти');
  assert.match(captured.url, /bot TOKEN/.source.replace(' ', '') ? /botTOKEN\/sendMessage/ : /sendMessage/);
  assert.equal(captured.body.chat_id, 42);
  assert.equal(captured.body.text, 'здрасти');
});

test('answerCallbackQuery acknowledges a button press', async () => {
  let url;
  const fakeFetch = async (u) => { url = u; return { ok: true, json: async () => ({ ok: true }) }; };
  const tg = new TelegramClient('TOKEN', { fetchImpl: fakeFetch });
  await tg.answerCallbackQuery('cbid');
  assert.match(url, /answerCallbackQuery/);
});
```

- [ ] **Step 2: Пусни теста — трябва да падне**

Run: `node --test tests/regression/social-repost-telegram-send.test.js`
Expected: FAIL (module not found)

- [ ] **Step 3: Имплементирай клиента**

```js
// workers/lib/telegram_send.js
export class TelegramClient {
  constructor(token, { fetchImpl = fetch } = {}) {
    this.base = `https://api.telegram.org/bot${token}`;
    this.fetchImpl = fetchImpl;
  }

  async #call(method, payload) {
    const res = await this.fetchImpl(`${this.base}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!json.ok) throw new Error(`telegram ${method} failed: ${JSON.stringify(json).slice(0, 300)}`);
    return json.result;
  }

  sendMessage(chatId, text, extra = {}) {
    return this.#call('sendMessage', { chat_id: chatId, text, ...extra });
  }

  // video can be a remote URL (string) for simplicity
  sendVideo(chatId, video, { caption, reply_markup } = {}) {
    return this.#call('sendVideo', { chat_id: chatId, video, caption, reply_markup });
  }

  editMessageReplyMarkup(chatId, messageId, reply_markup) {
    return this.#call('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup });
  }

  answerCallbackQuery(callbackQueryId, text) {
    return this.#call('answerCallbackQuery', { callback_query_id: callbackQueryId, text });
  }
}
```

- [ ] **Step 4: Пусни теста — трябва да мине**

Run: `node --test tests/regression/social-repost-telegram-send.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add workers/lib/telegram_send.js tests/regression/social-repost-telegram-send.test.js
git commit -m "feat: add telegram send client"
```

---

## Task 14: DB job helpers (claim/update/getAccount)

**Repo:** `festivo-workers`
**Files:**
- Modify: `workers/lib/social_repost_jobs.js` (добавя DB методи към чистите helper-и от Task 4)
- Test: `tests/regression/social-repost-db.test.js`

- [ ] **Step 1: Напиши падащ тест (фалшив supabase query builder)**

```js
// tests/regression/social-repost-db.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { enqueueJob } from '../../workers/lib/social_repost_jobs.js';

test('enqueueJob inserts with computed dedupe_key and queued status', async () => {
  let inserted;
  const fakeSupabase = {
    from: () => ({
      upsert: (row) => ({ select: () => ({ single: async () => { inserted = row; return { data: { id: 'new1', ...row }, error: null }; } }) })
    })
  };
  const job = await enqueueJob(fakeSupabase, { chatId: 7, userId: 8, sourceUrl: 'https://facebook.com/reel/9' });
  assert.equal(inserted.telegram_chat_id, 7);
  assert.equal(inserted.status, 'queued');
  assert.ok(inserted.dedupe_key.length > 0);
  assert.equal(job.id, 'new1');
});
```

- [ ] **Step 2: Пусни теста — трябва да падне**

Run: `node --test tests/regression/social-repost-db.test.js`
Expected: FAIL (`enqueueJob is not a function`)

- [ ] **Step 3: Добави DB методите към `social_repost_jobs.js`**

Добави в края на файла (запазвайки чистите функции от Task 4):

```js
// --- DB layer (appended) ---

export async function enqueueJob(supabase, { chatId, userId, sourceUrl }) {
  const row = {
    telegram_chat_id: chatId,
    telegram_user_id: userId,
    source_url: sourceUrl,
    status: 'queued',
    dedupe_key: buildDedupeKey(chatId, sourceUrl)
  };
  const { data, error } = await supabase
    .from('social_repost_jobs')
    .upsert(row, { onConflict: 'dedupe_key' })
    .select()
    .single();
  if (error) throw new Error(`enqueueJob failed: ${error.message}`);
  return data;
}

// Atomically claim the next job in a given status by flipping it to a working status.
export async function claimNextJob(supabase, { fromStatus, toStatus }) {
  const { data: candidates, error } = await supabase
    .from('social_repost_jobs')
    .select('*')
    .eq('status', fromStatus)
    .order('created_at', { ascending: true })
    .limit(1);
  if (error) throw new Error(`claim select failed: ${error.message}`);
  const job = candidates?.[0];
  if (!job) return null;
  const { data: updated, error: upErr } = await supabase
    .from('social_repost_jobs')
    .update({ status: toStatus, claimed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', job.id)
    .eq('status', fromStatus) // guard against races
    .select()
    .single();
  if (upErr || !updated) return null; // lost the race
  return updated;
}

export async function updateJob(supabase, jobId, patch) {
  const { data, error } = await supabase
    .from('social_repost_jobs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .select()
    .single();
  if (error) throw new Error(`updateJob failed: ${error.message}`);
  return data;
}

export async function getAccount(supabase, network) {
  const { data, error } = await supabase
    .from('social_accounts')
    .select('*')
    .eq('network', network)
    .maybeSingle();
  if (error) throw new Error(`getAccount failed: ${error.message}`);
  return data;
}

export async function isUserAllowed(supabase, telegramUserId) {
  const { data, error } = await supabase
    .from('social_repost_allowed_users')
    .select('telegram_user_id')
    .eq('telegram_user_id', telegramUserId)
    .maybeSingle();
  if (error) throw new Error(`isUserAllowed failed: ${error.message}`);
  return Boolean(data);
}
```

- [ ] **Step 4: Пусни теста — трябва да мине**

Run: `node --test tests/regression/social-repost-db.test.js`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add workers/lib/social_repost_jobs.js tests/regression/social-repost-db.test.js
git commit -m "feat: add db helpers for repost jobs and accounts"
```

---

## Task 15: Worker entrypoint (оркестрация на cron tick)

**Repo:** `festivo-workers`
**Files:**
- Create: `workers/social_repost_worker.js`
- Modify: `package.json` (нов script)
- Test: `tests/regression/social-repost-worker-tick.test.js`

- [ ] **Step 1: Напиши падащ тест за `processDownloadJob` (инжектирани зависимости)**

```js
// tests/regression/social-repost-worker-tick.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { processDownloadJob } from '../../workers/social_repost_worker.js';

test('processDownloadJob downloads, uploads, sends preview, sets awaiting_review', async () => {
  const updates = [];
  const sent = [];
  const deps = {
    download: async () => ({ buffer: Buffer.from('v'), sizeBytes: 1, mime: 'video/mp4', cleanup: () => {} }),
    upload: async () => ({ path: 'repost/x.mp4', signedUrl: 'https://signed/x.mp4' }),
    updateJob: async (_s, id, patch) => { updates.push({ id, patch }); return { id, ...patch }; },
    telegram: { sendVideo: async (chat, vid, opts) => sent.push({ chat, vid, opts }) }
  };
  const job = { id: 'j1', telegram_chat_id: 5, source_url: 'https://facebook.com/reel/1' };
  await processDownloadJob(null, job, deps);
  const last = updates[updates.length - 1];
  assert.equal(last.patch.status, 'awaiting_review');
  assert.equal(last.patch.video_storage_path, 'repost/x.mp4');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].chat, 5);
});
```

- [ ] **Step 2: Пусни теста — трябва да падне**

Run: `node --test tests/regression/social-repost-worker-tick.test.js`
Expected: FAIL (module not found)

- [ ] **Step 3: Имплементирай worker-а**

```js
// workers/social_repost_worker.js
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { claimNextJob, updateJob, getAccount } from './lib/social_repost_jobs.js';
import { downloadFacebookVideo } from './lib/fb_video_download.js';
import { uploadTempVideo, deleteTempVideo } from './lib/social_storage.js';
import { TelegramClient } from './lib/telegram_send.js';
import { buildReviewKeyboard } from './lib/telegram_parse.js';
import { publishToTargets } from './lib/publishers/index.js';
import { isReadyToPublish, computeFinalStatus } from './lib/social_repost_state.js';
import { needsRefresh, refreshTikTokToken, refreshInstagramToken } from './lib/oauth_tokens.js';

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

// --- Stage 1: download queued jobs ---
export async function processDownloadJob(supabase, job, deps) {
  const { download, upload, updateJob: upd, telegram } = deps;
  try {
    const media = await download(job.source_url);
    const { path: storagePath, signedUrl } = await upload(supabase, { jobId: job.id, buffer: media.buffer });
    media.cleanup?.();
    const updated = await upd(supabase, job.id, { status: 'awaiting_review', video_storage_path: storagePath, error: null });
    await telegram.sendVideo(job.telegram_chat_id, signedUrl, {
      caption: 'Готово за публикуване. Избери мрежи и действие:',
      reply_markup: buildReviewKeyboard(job.id, [])
    });
    return updated;
  } catch (err) {
    await upd(supabase, job.id, { status: 'failed', error: String(err?.message || err).slice(0, 500) });
    await telegram.sendMessage(job.telegram_chat_id, `❌ Свалянето се провали: ${err?.message || err}`);
    throw err;
  }
}

// --- Stage 2: publish jobs that are in 'publishing' or due 'scheduled' ---
async function ensureFreshAccount(supabase, network) {
  const account = await getAccount(supabase, network);
  if (!account) return null;
  if (!needsRefresh(account)) return account;
  let refreshed = null;
  if (network === 'tiktok') {
    refreshed = await refreshTikTokToken({
      clientKey: process.env.TIKTOK_CLIENT_KEY, clientSecret: process.env.TIKTOK_CLIENT_SECRET, refreshToken: account.refresh_token
    });
  } else if (network === 'instagram') {
    refreshed = await refreshInstagramToken({ appSecret: process.env.META_APP_SECRET, accessToken: account.access_token });
  }
  if (!refreshed) return account;
  await supabase.from('social_accounts').update({ ...refreshed, updated_at: new Date().toISOString() }).eq('network', network);
  return { ...account, ...refreshed };
}

export async function processPublishJob(supabase, job, deps) {
  const { telegram, downloadFromStorage } = deps;
  const targets = Array.isArray(job.targets) ? job.targets : [];
  if (targets.length === 0) {
    await updateJob(supabase, job.id, { status: 'failed', error: 'no targets selected' });
    await telegram.sendMessage(job.telegram_chat_id, '❌ Не е избрана мрежа.');
    return;
  }
  const accounts = {};
  for (const n of targets) accounts[n] = await ensureFreshAccount(supabase, n);

  // TikTok needs the file bytes; Instagram needs a public URL.
  const { buffer, signedUrl } = await downloadFromStorage(supabase, job.video_storage_path);
  const media = { buffer, sizeBytes: buffer.length, mime: 'video/mp4', publicUrl: signedUrl };

  const target_results = await publishToTargets({ targets, job, accounts, media });
  const finalStatus = computeFinalStatus(target_results);
  await updateJob(supabase, job.id, { status: finalStatus, target_results });
  await deleteTempVideo(supabase, job.video_storage_path);

  const lines = Object.entries(target_results).map(([n, r]) => `${r.status === 'published' ? '✅' : '❌'} ${n}${r.error ? ' — ' + r.error : ''}`);
  await telegram.sendMessage(job.telegram_chat_id, `Резултат:\n${lines.join('\n')}`);
}

async function downloadFromStorage(supabase, storagePath) {
  const bucket = supabase.storage.from(process.env.SOCIAL_REPOST_BUCKET || 'social-repost-temp');
  const { data, error } = await bucket.download(storagePath);
  if (error) throw new Error(`storage download failed: ${error.message}`);
  const buffer = Buffer.from(await data.arrayBuffer());
  const { data: signed } = await bucket.createSignedUrl(storagePath, 3600);
  return { buffer, signedUrl: signed?.signedUrl };
}

export async function runTick(supabase, deps) {
  // 1) one download
  const dlJob = await claimNextJob(supabase, { fromStatus: 'queued', toStatus: 'downloading' });
  if (dlJob) {
    await processDownloadJob(supabase, dlJob, {
      download: downloadFacebookVideo, upload: uploadTempVideo, updateJob, telegram: deps.telegram
    }).catch(() => {});
  }
  // 2) due scheduled jobs → publishing
  const { data: scheduled } = await supabase.from('social_repost_jobs').select('*').eq('status', 'scheduled');
  for (const job of scheduled || []) {
    if (isReadyToPublish(job)) await updateJob(supabase, job.id, { status: 'publishing' });
  }
  // 3) one publish
  const pubJob = await claimNextJob(supabase, { fromStatus: 'publishing', toStatus: 'publishing' });
  if (pubJob) {
    await processPublishJob(supabase, pubJob, { telegram: deps.telegram, downloadFromStorage }).catch(() => {});
  }
}

async function main() {
  loadDotEnv();
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const telegram = new TelegramClient(process.env.TELEGRAM_BOT_TOKEN);
  await runTick(supabase, { telegram });
  console.log('[social_repost] tick done');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 4: Пусни теста — трябва да мине**

Run: `node --test tests/regression/social-repost-worker-tick.test.js`
Expected: PASS (1 test)

- [ ] **Step 5: Добави npm script**

В `package.json` `scripts` добави:
```json
"start:social-repost": "node workers/social_repost_worker.js"
```

- [ ] **Step 6: Пусни целия regression пакет**

Run: `node --test tests/regression/social-repost-*.test.js`
Expected: всички PASS

- [ ] **Step 7: Commit**

```bash
git add workers/social_repost_worker.js package.json tests/regression/social-repost-worker-tick.test.js
git commit -m "feat: add social repost worker orchestration (download + publish tick)"
```

---

## Task 16: Telegram webhook (festivo-web)

**Repo:** `festivo-web`
**Files:**
- Create: `lib/telegram/socialBot.ts`
- Create: `app/api/telegram/social-bot/route.ts`
- Test: `lib/telegram/__tests__/socialBot.test.ts` (или съществуващия web test runner)

> Преди това: разгледай как съществуващ job endpoint чете тялото и връща отговори (`app/api/jobs/*`), за да следваш конвенциите на проекта (`isAuthorizedJobRequest`, `supabaseAdmin`).

- [ ] **Step 1: Напиши чистите helper-и + тест**

`lib/telegram/socialBot.ts`:
```ts
export function verifyWebhookSecret(headerSecret: string | null, expected: string | undefined): boolean {
  return Boolean(expected) && headerSecret === expected;
}

export type BotAction =
  | { kind: 'enqueue'; chatId: number; userId: number; url: string }
  | { kind: 'toggle'; chatId: number; userId: number; jobId: string; network: string; callbackQueryId: string }
  | { kind: 'decision'; chatId: number; userId: number; jobId: string; decision: string; callbackQueryId: string }
  | { kind: 'caption'; chatId: number; userId: number; text: string }
  | { kind: 'ignore' };

const FB_URL_RE = /(https?:\/\/(?:www\.|m\.|web\.)?(?:facebook\.com|fb\.watch|fb\.com)\/[^\s]+)/i;

export function mapUpdateToAction(update: any): BotAction {
  const cq = update?.callback_query;
  if (cq) {
    const parts = String(cq.data || '').split(':');
    const base = { chatId: cq.message?.chat?.id, userId: cq.from?.id, callbackQueryId: cq.id };
    if (parts[0] === 'job' && parts[2] === 'toggle') return { kind: 'toggle', jobId: parts[1], network: parts[3], ...base };
    if (parts[0] === 'job') return { kind: 'decision', jobId: parts[1], decision: parts[2], ...base };
    return { kind: 'ignore' };
  }
  const msg = update?.message;
  if (msg && typeof msg.text === 'string') {
    const m = msg.text.match(FB_URL_RE);
    if (m) return { kind: 'enqueue', chatId: msg.chat?.id, userId: msg.from?.id, url: m[1] };
    return { kind: 'caption', chatId: msg.chat?.id, userId: msg.from?.id, text: msg.text.trim() };
  }
  return { kind: 'ignore' };
}
```

Тест:
```ts
import { describe, it, expect } from 'vitest'; // или съществуващия runner
import { verifyWebhookSecret, mapUpdateToAction } from '../socialBot';

describe('socialBot', () => {
  it('verifies webhook secret', () => {
    expect(verifyWebhookSecret('s', 's')).toBe(true);
    expect(verifyWebhookSecret('x', 's')).toBe(false);
    expect(verifyWebhookSecret('s', undefined)).toBe(false);
  });
  it('maps a facebook link to enqueue', () => {
    const a = mapUpdateToAction({ message: { chat: { id: 1 }, from: { id: 2 }, text: 'https://facebook.com/reel/3' } });
    expect(a).toMatchObject({ kind: 'enqueue', chatId: 1, userId: 2, url: 'https://facebook.com/reel/3' });
  });
  it('maps toggle callback', () => {
    const a = mapUpdateToAction({ callback_query: { id: 'c', message: { chat: { id: 1 } }, from: { id: 2 }, data: 'job:J:toggle:tiktok' } });
    expect(a).toMatchObject({ kind: 'toggle', jobId: 'J', network: 'tiktok' });
  });
});
```

- [ ] **Step 2: Пусни теста — трябва да падне, после да мине**

Run: web проектния тест команд (напр. `npm test -- socialBot`).
Expected: първо FAIL (module not found), след създаване на файла — PASS.

- [ ] **Step 3: Имплементирай route handler-а**

`app/api/telegram/social-bot/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyWebhookSecret, mapUpdateToAction } from '@/lib/telegram/socialBot';
import { buildDedupeKey, normalizeTargets } from '@/lib/telegram/socialBotShared'; // small shared pure helpers (mirror worker)

export const runtime = 'nodejs';

const TG_API = (m: string) => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${m}`;

async function tg(method: string, payload: unknown) {
  await fetch(TG_API(method), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}

export async function POST(req: Request) {
  const secret = req.headers.get('x-telegram-bot-api-secret-token');
  if (!verifyWebhookSecret(secret, process.env.TELEGRAM_WEBHOOK_SECRET)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const update = await req.json();
  const action = mapUpdateToAction(update);
  if (action.kind === 'ignore') return NextResponse.json({ ok: true });

  // whitelist gate
  const { data: allowed } = await supabaseAdmin
    .from('social_repost_allowed_users').select('telegram_user_id').eq('telegram_user_id', action.userId).maybeSingle();
  if (!allowed) {
    await tg('sendMessage', { chat_id: action.chatId, text: 'Нямаш достъп до този бот.' });
    return NextResponse.json({ ok: true });
  }

  if (action.kind === 'enqueue') {
    const dedupe_key = buildDedupeKey(action.chatId, action.url);
    await supabaseAdmin.from('social_repost_jobs').upsert(
      { telegram_chat_id: action.chatId, telegram_user_id: action.userId, source_url: action.url, status: 'queued', dedupe_key },
      { onConflict: 'dedupe_key' }
    );
    await tg('sendMessage', { chat_id: action.chatId, text: '⏳ Получих линка, свалям клипа…' });
  } else if (action.kind === 'toggle') {
    const { data: job } = await supabaseAdmin.from('social_repost_jobs').select('targets').eq('id', action.jobId).maybeSingle();
    const cur: string[] = Array.isArray(job?.targets) ? job!.targets : [];
    const next = cur.includes(action.network) ? cur.filter((t) => t !== action.network) : [...cur, action.network];
    await supabaseAdmin.from('social_repost_jobs').update({ targets: normalizeTargets(next) }).eq('id', action.jobId);
    await tg('answerCallbackQuery', { callback_query_id: action.callbackQueryId, text: `Мрежи: ${normalizeTargets(next).join(', ') || 'няма'}` });
  } else if (action.kind === 'decision') {
    const map: Record<string, string> = { publish_now: 'publishing', schedule: 'scheduled', cancel: 'cancelled' };
    const status = map[action.decision];
    if (status) await supabaseAdmin.from('social_repost_jobs').update({ status }).eq('id', action.jobId);
    await tg('answerCallbackQuery', { callback_query_id: action.callbackQueryId, text: status === 'publishing' ? 'Публикувам…' : status || 'ок' });
  } else if (action.kind === 'caption') {
    // attach caption to the most recent awaiting_review job for this chat
    const { data: job } = await supabaseAdmin.from('social_repost_jobs')
      .select('id').eq('telegram_chat_id', action.chatId).eq('status', 'awaiting_review')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (job) {
      await supabaseAdmin.from('social_repost_jobs').update({ caption: action.text }).eq('id', job.id);
      await tg('sendMessage', { chat_id: action.chatId, text: '✏️ Описанието е записано.' });
    }
  }
  return NextResponse.json({ ok: true });
}
```

Създай и `lib/telegram/socialBotShared.ts` с `buildDedupeKey` и `normalizeTargets` (същата логика като worker Task 4, но в TS — sha256 през `crypto`, supported networks `['tiktok','instagram']`).

- [ ] **Step 4: Пусни web тестовете**

Run: web test команд.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/telegram/socialBot.ts lib/telegram/socialBotShared.ts app/api/telegram/social-bot/route.ts lib/telegram/__tests__/socialBot.test.ts
git commit -m "feat(telegram): add social repost bot webhook"
```

---

## Task 17: Еднократен OAuth connect (TikTok + Instagram акаунти)

**Repo:** `festivo-workers`
**Files:**
- Create: `scripts/connect_social_account.mjs`

Целта: еднократно да запишеш токени в `social_accounts`. Това е операторски скрипт, не част от worker tick-а.

- [ ] **Step 1: Напиши connect скрипта**

```js
// scripts/connect_social_account.mjs
// Usage:
//   node scripts/connect_social_account.mjs tiktok    -> prints auth URL, then exchange code
//   node scripts/connect_social_account.mjs instagram -> prints steps for IG business token
//
// Step A: run with no code to print the OAuth authorize URL.
// Step B: after consenting, re-run with the returned ?code= to exchange + store tokens.
import { createClient } from '@supabase/supabase-js';

const network = process.argv[2];
const code = process.argv[3];
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function storeAccount(row) {
  const { error } = await supabase.from('social_accounts').upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'network' });
  if (error) throw error;
  console.log(`stored ${row.network} account`);
}

if (network === 'tiktok') {
  const redirect = process.env.TIKTOK_REDIRECT_URI;
  if (!code) {
    const u = new URL('https://www.tiktok.com/v2/auth/authorize/');
    u.searchParams.set('client_key', process.env.TIKTOK_CLIENT_KEY);
    u.searchParams.set('scope', 'video.publish,video.upload');
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('redirect_uri', redirect);
    u.searchParams.set('state', 'festivo');
    console.log('Open this URL, consent, copy ?code= from redirect:\n', u.toString());
  } else {
    const body = new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY, client_secret: process.env.TIKTOK_CLIENT_SECRET,
      code, grant_type: 'authorization_code', redirect_uri: redirect
    });
    const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body
    });
    const j = await res.json();
    await storeAccount({
      network: 'tiktok', external_id: j.open_id, access_token: j.access_token, refresh_token: j.refresh_token,
      expires_at: new Date(Date.now() + j.expires_in * 1000).toISOString(), scope: j.scope
    });
  }
} else if (network === 'instagram') {
  // IG business token is obtained via Meta login → page token → ig user id.
  // Provide IG_USER_ID and a long-lived PAGE/USER token via env after manual Graph API Explorer step.
  await storeAccount({
    network: 'instagram', external_id: process.env.IG_USER_ID, access_token: process.env.IG_LONG_LIVED_TOKEN,
    refresh_token: null, expires_at: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
    scope: 'instagram_content_publish', meta: { fb_page_id: process.env.FB_PAGE_ID }
  });
} else {
  console.error('usage: connect_social_account.mjs <tiktok|instagram> [code]');
  process.exit(1);
}
```

- [ ] **Step 2: Изпълни connect за двете мрежи**

Run (TikTok, стъпка A): `node scripts/connect_social_account.mjs tiktok`
След consent — Run (стъпка B): `node scripts/connect_social_account.mjs tiktok <code>`
Run (Instagram): задай `IG_USER_ID`, `IG_LONG_LIVED_TOKEN`, `FB_PAGE_ID` в env, после `node scripts/connect_social_account.mjs instagram`
Expected: `stored tiktok account` / `stored instagram account`; редове в `social_accounts`.

- [ ] **Step 3: Commit**

```bash
git add scripts/connect_social_account.mjs
git commit -m "feat: add one-time social account oauth connect script"
```

---

## Task 18: Регистрация на Telegram webhook + Railway cron service

**Repo:** деплой/конфигурация (без код)

- [ ] **Step 1: Задай env vars в Vercel (festivo-web)**

`vercel env add TELEGRAM_BOT_TOKEN production`
`vercel env add TELEGRAM_WEBHOOK_SECRET production`
(Произволен таен низ за webhook secret.)

- [ ] **Step 2: Задай env vars в Railway (festivo-workers)**

`TELEGRAM_BOT_TOKEN`, `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI`, `TIKTOK_PRIVACY_LEVEL=SELF_ONLY`, `META_APP_ID`, `META_APP_SECRET`, `SOCIAL_REPOST_BUCKET=social-repost-temp`, плюс съществуващите Supabase ключове.

- [ ] **Step 3: Регистрирай webhook-а в Telegram**

Run:
```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://<festivo-web-domain>/api/telegram/social-bot" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```
Expected: `{"ok":true,"result":true,...}`

- [ ] **Step 4: Създай Railway cron service**

Нов service от repo `festivo-workers`, Start command `npm run start:social-repost`, schedule `*/2 * * * *` (на всеки 2 мин). По модела на съществуващите cron services.

- [ ] **Step 5: End-to-end ръчен тест**

1. Прати публичен FB reel линк на бота.
2. Изчакай до ~2 мин → трябва да дойде preview видео + бутони.
3. Избери TikTok → ✅ Публикувай сега.
4. Провери TikTok app → клипът е като draft (unaudited) или public (audited).
5. Повтори с Instagram избрано.

- [ ] **Step 6: Документация — обнови CLAUDE.md (festivo-web) и PROJECT_CONTEXT.md (festivo-workers)**

Добави: нов webhook endpoint, нов worker, нови таблици, нови env vars (по правилата в CLAUDE.md секция „Documentation sync").

```bash
git add CLAUDE.md
git commit -m "docs: document social repost bot (webhook, worker, tables, env)"
```

---

## Self-Review (от автора на плана)

**Spec coverage:**
- Telegram бот вход → Task 5, 13, 16 ✓
- FB линк → yt-dlp сваляне → Task 11 ✓
- Preview + потвърждаваща стъпка + избор на мрежи → Task 5 (keyboard), 15 (preview), 16 (toggle) ✓
- Насрочване → Task 3 (`isReadyToPublish`), 15 (runTick scheduled→publishing), 16 (decision) ✓
- TikTok публикуване (official API) → Task 6, 9 ✓
- Instagram публикуване (Graph API, signed URL) → Task 6, 10, 12 ✓
- `social_accounts` / `social_repost_jobs` / `social_repost_allowed_users` → Task 1 ✓
- Whitelist сигурност → Task 14 (`isUserAllowed`), 16 (gate) ✓
- per-target резултати + retry isolation → Task 8, 15 (`computeFinalStatus`) ✓
- OAuth refresh → Task 7, 15 (`ensureFreshAccount`) ✓
- Temp cleanup → Task 12 (`deleteTempVideo`), 15 ✓
- Идемпотентност/dedupe → Task 4, 14 (upsert onConflict), 1 (unique dedupe_key) ✓
- Env vars, webhook reg, Railway cron → Task 18 ✓
- Docs sync → Task 18 Step 6 ✓

**Type consistency:** `publish({ job, account, media, deps })` интерфейсът е еднакъв в Task 8/9/10. `media` носи и `buffer/sizeBytes/mime` (TikTok) и `publicUrl` (Instagram) — попълва се в Task 15 `processPublishJob`. `target_results` форма `{ [network]: { status, external_post_id?, error? } }` е консистентна в Task 5 (spec), 8, 15. State имена съвпадат със CHECK constraint-а в Task 1.

**Placeholder scan:** няма TBD/TODO; всеки code step има пълен код. Външните API shapes имат изрична бележка „свери с docs" (Task 6, 9, 10) — това е валидация, не placeholder.

**Бележка за изпълнителя:** Task 16 предполага web test runner (vitest/jest). Ако festivo-web няма конфигуриран unit runner, тествай `mapUpdateToAction`/`verifyWebhookSecret` чрез временен `node --test` с преименуван `.mjs`, или премести чистите helper-и в споделен пакет. Не пропускай теста.
