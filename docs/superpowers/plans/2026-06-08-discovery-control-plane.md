# Discovery Control Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дай на admin-а контрол над discovery — пускане на run по заявка, тунинговане на праговете без deploy и live статус — през Supabase control таблици, без worker-ът да приема inbound HTTP.

**Architecture:** Две нови control таблици в Supabase (`discovery_config` singleton + `discovery_run_requests` опашка). `festivo-web` пише в тях през admin API + UI. `festivo-workers` чете config-а (fallback към env) и атомарно claim-ва pending заявки на всеки Railway cron tick. Worker-ът остава one-shot cron — Supabase е единственият координационен канал.

**Tech Stack:** Next.js 14 App Router · TypeScript · Supabase Postgres (RLS) · Node.js ESM worker · `node:test` за worker unit тестове. `festivo-web` няма JS тестов runner → web верификация е `npx tsc --noEmit` + `npm run lint` + ръчна проверка.

**Repos:**
- `festivo-web` = `C:\Project\festivo-web`
- `festivo-workers` = `C:\Project\festivo-workers`

**Grounding факти (проверени 2026-06-08):**
- `discovery_runs.id` е `bigint` → `discovery_run_requests.run_id` = `bigint`.
- `discovery_sources.id` е `bigint` → `discovery_run_requests.source_id` = `bigint`.
- `admin_config` е generic key-value (key/value/updated_at) — НЕ се reuse-ва за типизиран config.
- Web admin route pattern: `getAdminContext()` от `@/lib/admin/isAdmin` → `{ isAdmin, user, supabase }` (service-role); `logAdminAction()` от `@/lib/admin/audit-log`.
- Worker env консти са module-level в `workers/discovery_seed_worker.js:150-161`; supabase се създава в `main()` на ред 1314.
- Праг: `DISCOVERY_SCORE_THRESHOLD = 65` в `workers/lib/discovery_helpers.js:201`; reduced 50 за силен сигнал чрез `getScoreThresholdForCandidate` (ред ~209-216); `isScoreEligible` ред 786.
- Supabase project_id: `hpvfsdmpatgceohigswm`.

---

## Файлова структура

### festivo-web (нови)
- `scripts/sql/20260608_discovery_control_plane.sql` — миграция (таблици, indexes, RLS, singleton seed)
- `app/admin/api/discovery/config/route.ts` — GET + PATCH config
- `app/admin/api/discovery/run/route.ts` — POST нова run заявка
- `app/admin/api/discovery/requests/route.ts` — GET последни заявки
- `lib/admin/discovery/config.ts` — споделена валидация/нормализация + defaults за config
- `components/admin/DiscoveryControlPanel.tsx` — UI: run бутон + config форма + requests панел

### festivo-web (модифицирани)
- `app/admin/(protected)/discovery/page.tsx` — render на `<DiscoveryControlPanel/>`
- `PROJECT_CONTEXT.md`, `docs/system-architecture.md`, `docs/er-diagram.md`, `CLAUDE.md`

### festivo-workers (нови)
- `workers/lib/discovery_config.js` — `buildEnvDefaultDiscoveryConfig()`, `normalizeDiscoveryConfig()`, `readDiscoveryConfig(supabase)`
- `workers/lib/discovery_run_requests.js` — `claimRunRequest(supabase)`, `finishRunRequest(...)`
- `tests/regression/discovery-config.test.js`
- `tests/regression/discovery-run-requests.test.js`

### festivo-workers (модифицирани)
- `workers/lib/discovery_helpers.js` — адитивен `baseThreshold` param
- `workers/discovery_seed_worker.js` — config-aware runner + request claiming
- `README.md` — нов cron service + config таблица

---

## Phase A — Database (festivo-web)

### Task 1: Миграция за control таблиците

**Files:**
- Create: `scripts/sql/20260608_discovery_control_plane.sql`

- [ ] **Step 1: Напиши миграцията**

```sql
-- scripts/sql/20260608_discovery_control_plane.sql
-- Discovery Control Plane: admin-tunable config + run-request queue.

-- 1. Singleton config table -------------------------------------------------
create table if not exists public.discovery_config (
  id smallint primary key default 1,
  score_threshold integer not null default 65,
  max_sources_per_run integer not null default 10,
  max_links_per_source integer not null default 40,
  max_jobs_per_run integer not null default 30,
  fetch_timeout_ms integer not null default 12000,
  soft_disable_approval_floor numeric not null default 0.05,
  soft_disable_min_enqueued integer not null default 30,
  recovery_every integer not null default 5,
  cron_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint discovery_config_singleton check (id = 1),
  constraint discovery_config_score_threshold_range check (score_threshold between 0 and 200),
  constraint discovery_config_approval_floor_range check (soft_disable_approval_floor between 0 and 1),
  constraint discovery_config_positive_ints check (
    max_sources_per_run > 0
    and max_links_per_source > 0
    and max_jobs_per_run > 0
    and fetch_timeout_ms >= 1000
    and soft_disable_min_enqueued >= 0
    and recovery_every >= 2
  )
);

-- Seed the singleton row (idempotent).
insert into public.discovery_config (id)
values (1)
on conflict (id) do nothing;

-- 2. Run-request queue ------------------------------------------------------
create table if not exists public.discovery_run_requests (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'requested',
  mode text not null default 'full',
  source_id bigint references public.discovery_sources(id) on delete set null,
  requested_by uuid,
  requested_at timestamptz not null default now(),
  lock_token uuid,
  claimed_at timestamptz,
  finished_at timestamptz,
  run_id bigint references public.discovery_runs(id) on delete set null,
  error text,
  constraint discovery_run_requests_status_chk
    check (status in ('requested', 'claimed', 'done', 'failed')),
  constraint discovery_run_requests_mode_chk
    check (mode in ('full', 'single_source'))
);

-- Prevent piling up duplicate pending requests for the same target.
create unique index if not exists discovery_run_requests_pending_uq
  on public.discovery_run_requests (mode, coalesce(source_id, -1))
  where status = 'requested';

-- Claim ordering / dashboard listing.
create index if not exists discovery_run_requests_status_requested_at_idx
  on public.discovery_run_requests (status, requested_at desc);

-- 3. RLS --------------------------------------------------------------------
alter table public.discovery_config enable row level security;
alter table public.discovery_run_requests enable row level security;

-- Admin-only access (service role bypasses RLS automatically).
-- Mirrors the existing admin check used elsewhere: public.user_roles.role = 'admin'.
create policy discovery_config_admin_all on public.discovery_config
  for all
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  );

create policy discovery_run_requests_admin_all on public.discovery_run_requests
  for all
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  );
```

- [ ] **Step 2: Провери `user_roles` колоните преди да приложиш**

Преди да apply-неш, потвърди че RLS политиката съвпада с реалната схема (`user_id` + `role`):

Run (Supabase MCP `execute_sql`, project_id `hpvfsdmpatgceohigswm`):
```sql
select column_name, data_type from information_schema.columns
where table_schema='public' and table_name='user_roles' order by ordinal_position;
```
Expected: колони `user_id` (uuid) и `role` (text/enum). Ако имената се различават — поправи политиките в миграцията преди apply.

- [ ] **Step 3: Приложи миграцията**

Приложи чрез Supabase MCP `apply_migration` (name: `20260608_discovery_control_plane`, query = съдържанието на файла).

- [ ] **Step 4: Верифицирай таблиците и seed реда**

Run (`execute_sql`):
```sql
select count(*) as cfg_rows from public.discovery_config;
select indexname from pg_indexes where tablename='discovery_run_requests';
```
Expected: `cfg_rows = 1`; индексите `discovery_run_requests_pending_uq` и `discovery_run_requests_status_requested_at_idx` присъстват.

- [ ] **Step 5: Commit**

```bash
cd C:\Project\festivo-web
git checkout -b feat/discovery-control-plane
git add scripts/sql/20260608_discovery_control_plane.sql
git commit -m "feat(discovery): control plane control таблици (config + run_requests)"
```

---

## Phase B — Worker config-aware runner (festivo-workers)

### Task 2: `discovery_config.js` helper + тест

**Files:**
- Create: `workers/lib/discovery_config.js`
- Test: `tests/regression/discovery-config.test.js`

- [ ] **Step 1: Напиши failing тест**

```js
// tests/regression/discovery-config.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEnvDefaultDiscoveryConfig,
  normalizeDiscoveryConfig,
  readDiscoveryConfig
} from '../../workers/lib/discovery_config.js';

test('buildEnvDefaultDiscoveryConfig uses defaults when env absent', () => {
  const cfg = buildEnvDefaultDiscoveryConfig({});
  assert.equal(cfg.scoreThreshold, 65);
  assert.equal(cfg.maxSourcesPerRun, 10);
  assert.equal(cfg.maxLinksPerSource, 40);
  assert.equal(cfg.maxJobsPerRun, 30);
  assert.equal(cfg.fetchTimeoutMs, 12000);
  assert.equal(cfg.cronEnabled, true);
});

test('buildEnvDefaultDiscoveryConfig reads env overrides', () => {
  const cfg = buildEnvDefaultDiscoveryConfig({ DISCOVERY_MAX_JOBS_PER_RUN: '7' });
  assert.equal(cfg.maxJobsPerRun, 7);
});

test('normalizeDiscoveryConfig maps DB row over defaults and clamps', () => {
  const defaults = buildEnvDefaultDiscoveryConfig({});
  const cfg = normalizeDiscoveryConfig(
    { score_threshold: 80, max_jobs_per_run: 0, cron_enabled: false },
    defaults
  );
  assert.equal(cfg.scoreThreshold, 80);
  // invalid (0) falls back to default
  assert.equal(cfg.maxJobsPerRun, defaults.maxJobsPerRun);
  assert.equal(cfg.cronEnabled, false);
});

test('readDiscoveryConfig falls back to defaults when table read fails', async () => {
  const fakeSupabase = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle: async () => ({ data: null, error: { message: 'relation missing' } })
      };
    }
  };
  const cfg = await readDiscoveryConfig(fakeSupabase, {});
  assert.equal(cfg.scoreThreshold, 65);
  assert.equal(cfg.source, 'defaults');
});

test('readDiscoveryConfig merges DB row when present', async () => {
  const fakeSupabase = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle: async () => ({ data: { score_threshold: 70, cron_enabled: false }, error: null })
      };
    }
  };
  const cfg = await readDiscoveryConfig(fakeSupabase, {});
  assert.equal(cfg.scoreThreshold, 70);
  assert.equal(cfg.cronEnabled, false);
  assert.equal(cfg.source, 'db');
});
```

- [ ] **Step 2: Пусни теста — трябва да fail-не**

Run: `cd C:\Project\festivo-workers && node --test tests/regression/discovery-config.test.js`
Expected: FAIL — `Cannot find module '.../discovery_config.js'`.

- [ ] **Step 3: Имплементирай helper-а**

```js
// workers/lib/discovery_config.js

function readInt(env, key, fallback, { min = 1 } = {}) {
  const raw = env?.[key];
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.trunc(n));
}

function readNum(env, key, fallback, { min = 0, max = 1 } = {}) {
  const raw = env?.[key];
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function buildEnvDefaultDiscoveryConfig(env = process.env) {
  return {
    scoreThreshold: readInt(env, 'DISCOVERY_SCORE_THRESHOLD', 65, { min: 0 }),
    maxSourcesPerRun: readInt(env, 'DISCOVERY_MAX_SOURCES_PER_RUN', 10),
    maxLinksPerSource: readInt(env, 'DISCOVERY_MAX_LINKS_PER_SOURCE', 40),
    maxJobsPerRun: readInt(env, 'DISCOVERY_MAX_JOBS_PER_RUN', 30),
    fetchTimeoutMs: readInt(env, 'DISCOVERY_FETCH_TIMEOUT_MS', 12000, { min: 1000 }),
    softDisableApprovalFloor: readNum(env, 'DISCOVERY_SOFT_DISABLE_APPROVAL_FLOOR', 0.05),
    softDisableMinEnqueued: readInt(env, 'DISCOVERY_SOFT_DISABLE_MIN_ENQUEUED', 30, { min: 0 }),
    recoveryEvery: readInt(env, 'DISCOVERY_SOFT_DISABLE_RECOVERY_EVERY', 5, { min: 2 }),
    cronEnabled: env?.DISCOVERY_CRON_ENABLED !== 'false',
    source: 'defaults'
  };
}

// Map a DB row (snake_case) onto a defaults object; invalid values fall back.
export function normalizeDiscoveryConfig(row, defaults) {
  if (!row || typeof row !== 'object') return { ...defaults };
  const intOr = (v, fb, min = 1) => {
    const n = Number(v);
    return Number.isFinite(n) && Math.trunc(n) >= min ? Math.trunc(n) : fb;
  };
  const numOr = (v, fb, min = 0, max = 1) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= min && n <= max ? n : fb;
  };
  return {
    scoreThreshold: intOr(row.score_threshold, defaults.scoreThreshold, 0),
    maxSourcesPerRun: intOr(row.max_sources_per_run, defaults.maxSourcesPerRun),
    maxLinksPerSource: intOr(row.max_links_per_source, defaults.maxLinksPerSource),
    maxJobsPerRun: intOr(row.max_jobs_per_run, defaults.maxJobsPerRun),
    fetchTimeoutMs: intOr(row.fetch_timeout_ms, defaults.fetchTimeoutMs, 1000),
    softDisableApprovalFloor: numOr(row.soft_disable_approval_floor, defaults.softDisableApprovalFloor),
    softDisableMinEnqueued: intOr(row.soft_disable_min_enqueued, defaults.softDisableMinEnqueued, 0),
    recoveryEvery: intOr(row.recovery_every, defaults.recoveryEvery, 2),
    cronEnabled: typeof row.cron_enabled === 'boolean' ? row.cron_enabled : defaults.cronEnabled,
    source: 'db'
  };
}

// Read config from Supabase; fail-safe to env defaults on any error/missing row.
export async function readDiscoveryConfig(supabase, env = process.env) {
  const defaults = buildEnvDefaultDiscoveryConfig(env);
  try {
    const { data, error } = await supabase
      .from('discovery_config')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (error || !data) {
      if (error) console.warn('[discovery] config read failed, using defaults:', error.message);
      return defaults;
    }
    return normalizeDiscoveryConfig(data, defaults);
  } catch (err) {
    console.warn('[discovery] config read threw, using defaults:', err?.message || String(err));
    return defaults;
  }
}
```

- [ ] **Step 4: Пусни теста — трябва да мине**

Run: `node --test tests/regression/discovery-config.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
cd C:\Project\festivo-workers
git checkout -b feat/discovery-control-plane
git add workers/lib/discovery_config.js tests/regression/discovery-config.test.js
git commit -m "feat(discovery): config helper с env fallback и DB merge"
```

---

### Task 3: Конфигуруем праг в helpers (адитивно)

**Files:**
- Modify: `workers/lib/discovery_helpers.js` (`getScoreThresholdForCandidate` ~209-216, `isScoreEligible` ~786-793)
- Test: `tests/regression/discovery-config.test.js` (добави случай)

- [ ] **Step 1: Добави failing тест за custom base threshold**

Добави в `tests/regression/discovery-config.test.js`:
```js
import { isScoreEligible } from '../../workers/lib/discovery_helpers.js';

test('isScoreEligible respects custom baseThreshold (additive)', () => {
  // score 60: ineligible at default 65, eligible at 55
  assert.equal(isScoreEligible({ score: 60 }, undefined, undefined), false);
  assert.equal(isScoreEligible({ score: 60 }, undefined, undefined, 55), true);
});

test('isScoreEligible default behavior unchanged when baseThreshold omitted', () => {
  assert.equal(isScoreEligible({ score: 65 }), true);
  assert.equal(isScoreEligible({ score: 64 }), false);
});
```

- [ ] **Step 2: Пусни — трябва да fail-не на custom-threshold случая**

Run: `node --test tests/regression/discovery-config.test.js`
Expected: FAIL — `isScoreEligible({score:60}, undefined, undefined, 55)` връща false (4-тият арг се игнорира).

- [ ] **Step 3: Направи threshold-а параметризуем (адитивно, default запазва поведението)**

В `workers/lib/discovery_helpers.js`, промени `getScoreThresholdForCandidate` да приема base:
```js
export function getScoreThresholdForCandidate(candidateUrl, anchorText, baseThreshold = DISCOVERY_SCORE_THRESHOLD) {
  const haystack = `${candidateUrl || ''} ${anchorText || ''}`.toLowerCase();
  const hit = STRONG_EVENT_SIGNAL_PATTERNS.some((re) => re.test(haystack));
  // силен сигнал → намален праг (по подразбиране 65→50, т.е. base-15, но не под 0)
  return hit ? Math.max(0, baseThreshold - 15) : baseThreshold;
}
```
> Запази съществуващото тяло/regex променливи както са (`STRONG_EVENT_SIGNAL_PATTERNS` или каквото ползва текущо) — само добави `baseThreshold` параметъра и смени твърдото `50` на `Math.max(0, baseThreshold - 15)`. При default `baseThreshold=65` → `65-15=50`, идентично на сегашното.

Промени `isScoreEligible` да приема и подава base:
```js
export function isScoreEligible(scored, candidateUrl, anchorText, baseThreshold = DISCOVERY_SCORE_THRESHOLD) {
  const score = typeof scored === 'number' ? scored : scored?.score;
  if (!Number.isFinite(score)) return false;
  if (typeof scored === 'object' && scored?.rejected) return false;
  const threshold = candidateUrl !== undefined || anchorText !== undefined
    ? getScoreThresholdForCandidate(candidateUrl, anchorText, baseThreshold)
    : baseThreshold;
  return score >= threshold;
}
```

- [ ] **Step 4: Пусни новия тест + пълната regression — всичко зелено**

Run: `node --test tests/regression/discovery-config.test.js`
Expected: PASS.

Run: `node --test tests/regression/discovery-seed-regression.test.js`
Expected: PASS (непроменено — default-ите пазят 65/50).

- [ ] **Step 5: Commit**

```bash
git add workers/lib/discovery_helpers.js tests/regression/discovery-config.test.js
git commit -m "feat(discovery): конфигуруем base score threshold (адитивно, backward-compatible)"
```

---

### Task 4: `discovery_run_requests.js` helper + тест

**Files:**
- Create: `workers/lib/discovery_run_requests.js`
- Test: `tests/regression/discovery-run-requests.test.js`

- [ ] **Step 1: Напиши failing тест с fake supabase**

```js
// tests/regression/discovery-run-requests.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { claimRunRequest, finishRunRequest } from '../../workers/lib/discovery_run_requests.js';

// Минимален fake: пази редове в масив, имитира select/update верига.
function makeFakeSupabase(initialRows) {
  const rows = initialRows.map((r) => ({ ...r }));
  const calls = { updates: [] };
  return {
    rows,
    calls,
    from() {
      const ctx = { _filters: {}, _update: null, _order: null, _limit: null };
      const api = {
        select() { return api; },
        eq(col, val) { ctx._filters[col] = val; return api; },
        order(col) { ctx._order = col; return api; },
        limit(n) { ctx._limit = n; return api; },
        update(patch) { ctx._update = patch; return api; },
        async maybeSingle() {
          if (ctx._update) {
            // намери ред по филтрите, приложи patch
            const idx = rows.findIndex((r) =>
              Object.entries(ctx._filters).every(([k, v]) => r[k] === v));
            if (idx === -1) return { data: null, error: null };
            rows[idx] = { ...rows[idx], ...ctx._update };
            calls.updates.push({ filters: { ...ctx._filters }, patch: { ...ctx._update } });
            return { data: rows[idx], error: null };
          }
          const found = rows.find((r) =>
            Object.entries(ctx._filters).every(([k, v]) => r[k] === v));
          return { data: found || null, error: null };
        },
        async select2() { return { data: rows, error: null }; }
      };
      return api;
    }
  };
}

test('claimRunRequest returns null when no requested rows', async () => {
  const sb = makeFakeSupabase([{ id: 'a', status: 'done' }]);
  const claimed = await claimRunRequest(sb);
  assert.equal(claimed, null);
});

test('claimRunRequest claims oldest requested row atomically', async () => {
  const sb = makeFakeSupabase([
    { id: 'a', status: 'requested', mode: 'full', source_id: null, requested_at: '2026-06-08T10:00:00Z' }
  ]);
  const claimed = await claimRunRequest(sb);
  assert.ok(claimed);
  assert.equal(claimed.id, 'a');
  assert.equal(claimed.status, 'claimed');
  assert.ok(claimed.lock_token);
});

test('finishRunRequest writes terminal status and run_id', async () => {
  const sb = makeFakeSupabase([{ id: 'a', status: 'claimed', lock_token: 'tok-1' }]);
  await finishRunRequest(sb, { id: 'a', lockToken: 'tok-1', status: 'done', runId: 42 });
  const row = sb.rows.find((r) => r.id === 'a');
  assert.equal(row.status, 'done');
  assert.equal(row.run_id, 42);
});
```

- [ ] **Step 2: Пусни — трябва да fail-не**

Run: `node --test tests/regression/discovery-run-requests.test.js`
Expected: FAIL — модулът липсва.

- [ ] **Step 3: Имплементирай helper-а**

```js
// workers/lib/discovery_run_requests.js
import { randomUUID } from 'node:crypto';

// Атомарно claim-ва най-старата 'requested' заявка.
// Pattern: прочети кандидат → UPDATE с lock_token само ако още е 'requested'.
// Втори tick няма да хване същия ред, защото статусът вече е 'claimed'.
export async function claimRunRequest(supabase) {
  const { data: candidate, error: readErr } = await supabase
    .from('discovery_run_requests')
    .select('*')
    .eq('status', 'requested')
    .order('requested_at')
    .limit(1)
    .maybeSingle();

  if (readErr) {
    console.warn('[discovery] run-request read failed:', readErr.message);
    return null;
  }
  if (!candidate) return null;

  const lockToken = randomUUID();
  const { data: claimed, error: claimErr } = await supabase
    .from('discovery_run_requests')
    .update({ status: 'claimed', lock_token: lockToken, claimed_at: new Date().toISOString() })
    .eq('id', candidate.id)
    .eq('status', 'requested') // race guard: само ако още е requested
    .select('*')
    .maybeSingle();

  if (claimErr) {
    console.warn('[discovery] run-request claim failed:', claimErr.message);
    return null;
  }
  // друг tick вече го е взел → claimed е null
  return claimed || null;
}

export async function finishRunRequest(supabase, { id, lockToken, status, runId = null, error = null }) {
  const patch = {
    status,
    finished_at: new Date().toISOString(),
    run_id: runId,
    error: error ? String(error).slice(0, 500) : null
  };
  const q = supabase.from('discovery_run_requests').update(patch).eq('id', id);
  if (lockToken) q.eq('lock_token', lockToken);
  const { error: updErr } = await q;
  if (updErr) console.warn('[discovery] run-request finish failed:', updErr.message);
}
```

> Бележка: fake-ът в теста ползва `.maybeSingle()` като терминал; `finishRunRequest` чрез `await q` третира верига `.update().eq()` като thenable. Ако реалният тест fail-не заради липсващ `.then` на fake-а, добави в `api` метод `then(resolve){ resolve({ error: null }); }` ИЛИ промени `finishRunRequest` да завършва с `.select().maybeSingle()` за консистентност. Препоръка: завърши с `.select('id').maybeSingle()` и в теста върни обновения ред.

- [ ] **Step 4: Пусни — зелено**

Run: `node --test tests/regression/discovery-run-requests.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add workers/lib/discovery_run_requests.js tests/regression/discovery-run-requests.test.js
git commit -m "feat(discovery): run-request claim/finish helper с lock_token guard"
```

---

### Task 5: Интегрирай config + claiming в worker-а

**Files:**
- Modify: `workers/discovery_seed_worker.js`

- [ ] **Step 1: Направи env констите презаписваеми**

В `workers/discovery_seed_worker.js:150-161` смени `const` → `let` за тунинговите параметри (НЕ за `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`):
```js
let DISCOVERY_MAX_SOURCES_PER_RUN = Math.max(1, Number(process.env.DISCOVERY_MAX_SOURCES_PER_RUN || 10));
let DISCOVERY_MAX_LINKS_PER_SOURCE = Math.max(1, Number(process.env.DISCOVERY_MAX_LINKS_PER_SOURCE || 40));
let DISCOVERY_MAX_JOBS_PER_RUN = Math.max(1, Number(process.env.DISCOVERY_MAX_JOBS_PER_RUN || 30));
let DISCOVERY_FETCH_TIMEOUT_MS = Math.max(1000, Number(process.env.DISCOVERY_FETCH_TIMEOUT_MS || 12000));
// ... останалите тунингови консти също на let:
let DISCOVERY_SOFT_DISABLE_RECOVERY_EVERY = Math.max(2, Number(process.env.DISCOVERY_SOFT_DISABLE_RECOVERY_EVERY || 5));
```
Добави модулна променлива за активния праг и cron flag (до останалите):
```js
let DISCOVERY_ACTIVE_SCORE_THRESHOLD = DISCOVERY_SCORE_THRESHOLD; // от helpers import
let DISCOVERY_CRON_ENABLED = process.env.DISCOVERY_CRON_ENABLED !== 'false';
```

- [ ] **Step 2: Добави import-ите на новите helper-и**

В горния import блок:
```js
import { readDiscoveryConfig } from './lib/discovery_config.js';
import { claimRunRequest, finishRunRequest } from './lib/discovery_run_requests.js';
```

- [ ] **Step 3: Приложи config-а към констите в `main()`**

В `main()`, веднага след създаването на `supabase` (ред ~1314-1316), преди `await runDiscovery()`:
```js
  const config = await readDiscoveryConfig(supabase, process.env);
  DISCOVERY_MAX_SOURCES_PER_RUN = config.maxSourcesPerRun;
  DISCOVERY_MAX_LINKS_PER_SOURCE = config.maxLinksPerSource;
  DISCOVERY_MAX_JOBS_PER_RUN = config.maxJobsPerRun;
  DISCOVERY_FETCH_TIMEOUT_MS = config.fetchTimeoutMs;
  DISCOVERY_SOFT_DISABLE_RECOVERY_EVERY = config.recoveryEvery;
  DISCOVERY_ACTIVE_SCORE_THRESHOLD = config.scoreThreshold;
  DISCOVERY_CRON_ENABLED = config.cronEnabled;
  console.log('[discovery] config loaded', { source: config.source, scoreThreshold: config.scoreThreshold, cronEnabled: config.cronEnabled });
```
> Ако soft-disable праговете (`approval_floor`, `min_enqueued`) са hardcoded в `discovery_helpers.js`, за v1 ги остави както са — само worker-level констите се override-ват тук. (Пълно threading на soft-disable праговете е за под-проект 2; не разширявай обхвата.)

- [ ] **Step 4: Подай активния праг към `isScoreEligible` извикванията**

Намери всички извиквания на `isScoreEligible(` в `discovery_seed_worker.js` (поне в `deriveRejectionReasonForLog` и в основния scoring цикъл) и добави 4-тия аргумент:
```js
// преди:
isScoreEligible(scored, candidateUrl, anchorText)
// след:
isScoreEligible(scored, candidateUrl, anchorText, DISCOVERY_ACTIVE_SCORE_THRESHOLD)
```
Run за да намериш всички места: `grep -n "isScoreEligible(" workers/discovery_seed_worker.js`

- [ ] **Step 5: Добави request-claiming flow в `main()`**

Замени `await runDiscovery();` в `main()` с:
```js
  const claimed = await claimRunRequest(supabase);
  if (claimed) {
    console.log('[discovery] claimed run-request', { id: claimed.id, mode: claimed.mode, source_id: claimed.source_id });
    let runId = null;
    try {
      runId = await runDiscovery(); // runDiscovery връща run.id (виж Step 6)
      await finishRunRequest(supabase, { id: claimed.id, lockToken: claimed.lock_token, status: 'done', runId });
    } catch (err) {
      await finishRunRequest(supabase, { id: claimed.id, lockToken: claimed.lock_token, status: 'failed', runId, error: err?.message || String(err) });
      throw err;
    }
  } else if (DISCOVERY_CRON_ENABLED) {
    console.log('[discovery] no pending request → scheduled run');
    await runDiscovery();
  } else {
    console.log('[discovery] no pending request and cron disabled → skip');
  }
```

- [ ] **Step 6: Накарай `runDiscovery()` да връща run id**

Намери къде `runDiscovery()` създава `discovery_runs` реда (`runId` локална) и къде завършва успешно; добави `return runId;` в успешния път (преди затварящата скоба на try-а, след `finishDiscoveryRun`). Ако вече има `return`, върни `runId`.

> Ако `runId` не е достъпен в края, проследи променливата от създаването на run-а (търси `discovery_runs` insert) и я върни. Това е единствената стойност, която new flow-ът ползва.

- [ ] **Step 7: Пусни пълната regression — нищо да не се чупи**

Run: `cd C:\Project\festivo-workers && npm run test:regression`
Expected: PASS — всички съществуващи + новите тестове.

- [ ] **Step 8: Smoke тест локално (изисква .env с Supabase)**

Run: `node workers/discovery_seed_worker.js`
Expected: лог `[discovery] config loaded { source: 'db', ... }` и `[discovery] no pending request → scheduled run` (или claimed, ако има заявка). Без exception.
> Ако няма локален `.env` достъп до Supabase — пропусни този step и разчитай на Railway preview.

- [ ] **Step 9: Commit**

```bash
git add workers/discovery_seed_worker.js
git commit -m "feat(discovery): config-aware runner + claim на run-requests"
```

---

## Phase C — Web API (festivo-web)

### Task 6: Споделен config валидатор + GET/PATCH route

**Files:**
- Create: `lib/admin/discovery/config.ts`
- Create: `app/admin/api/discovery/config/route.ts`

- [ ] **Step 1: Напиши config defaults + валидатора**

```ts
// lib/admin/discovery/config.ts
export type DiscoveryConfig = {
  score_threshold: number;
  max_sources_per_run: number;
  max_links_per_source: number;
  max_jobs_per_run: number;
  fetch_timeout_ms: number;
  soft_disable_approval_floor: number;
  soft_disable_min_enqueued: number;
  recovery_every: number;
  cron_enabled: boolean;
};

export const DISCOVERY_CONFIG_DEFAULTS: DiscoveryConfig = {
  score_threshold: 65,
  max_sources_per_run: 10,
  max_links_per_source: 40,
  max_jobs_per_run: 30,
  fetch_timeout_ms: 12000,
  soft_disable_approval_floor: 0.05,
  soft_disable_min_enqueued: 30,
  recovery_every: 5,
  cron_enabled: true,
};

type ValidationResult =
  | { ok: true; value: Partial<DiscoveryConfig> }
  | { ok: false; error: string };

function intField(v: unknown, name: string, { min, max }: { min: number; max: number }): number | string {
  if (typeof v !== "number" || !Number.isInteger(v)) return `${name} must be an integer`;
  if (v < min || v > max) return `${name} must be between ${min} and ${max}`;
  return v;
}

// Validates a PATCH body (all fields optional). Returns only provided fields.
export function validateDiscoveryConfigPatch(body: Record<string, unknown>): ValidationResult {
  const out: Partial<DiscoveryConfig> = {};

  const intChecks: Array<[keyof DiscoveryConfig, { min: number; max: number }]> = [
    ["score_threshold", { min: 0, max: 200 }],
    ["max_sources_per_run", { min: 1, max: 500 }],
    ["max_links_per_source", { min: 1, max: 500 }],
    ["max_jobs_per_run", { min: 1, max: 500 }],
    ["fetch_timeout_ms", { min: 1000, max: 60000 }],
    ["soft_disable_min_enqueued", { min: 0, max: 100000 }],
    ["recovery_every", { min: 2, max: 1000 }],
  ];

  for (const [key, range] of intChecks) {
    if (body[key] === undefined) continue;
    const r = intField(body[key], key, range);
    if (typeof r === "string") return { ok: false, error: r };
    (out[key] as number) = r;
  }

  if (body.soft_disable_approval_floor !== undefined) {
    const v = body.soft_disable_approval_floor;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1) {
      return { ok: false, error: "soft_disable_approval_floor must be between 0 and 1" };
    }
    out.soft_disable_approval_floor = v;
  }

  if (body.cron_enabled !== undefined) {
    if (typeof body.cron_enabled !== "boolean") {
      return { ok: false, error: "cron_enabled must be a boolean" };
    }
    out.cron_enabled = body.cron_enabled;
  }

  if (Object.keys(out).length === 0) return { ok: false, error: "no valid fields to update" };
  return { ok: true, value: out };
}
```

- [ ] **Step 2: Напиши GET/PATCH route-а**

```ts
// app/admin/api/discovery/config/route.ts
import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { logAdminAction } from "@/lib/admin/audit-log";
import { DISCOVERY_CONFIG_DEFAULTS, validateDiscoveryConfigPatch } from "@/lib/admin/discovery/config";

export async function GET() {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { data, error } = await ctx.supabase
    .from("discovery_config")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, config: data ?? { id: 1, ...DISCOVERY_CONFIG_DEFAULTS } });
}

export async function PATCH(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const result = validateDiscoveryConfigPatch(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const patch = { ...result.value, updated_at: new Date().toISOString(), updated_by: ctx.user.id };
  const { data, error } = await ctx.supabase
    .from("discovery_config")
    .upsert({ id: 1, ...patch }, { onConflict: "id" })
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    await logAdminAction({
      actor_user_id: ctx.user.id,
      action: "discovery.config_updated",
      entity_type: "discovery_config",
      entity_id: "1",
      route: "/admin/api/discovery/config",
      method: "PATCH",
      details: { changed_fields: Object.keys(result.value) },
    });
  } catch (auditError) {
    const message = auditError instanceof Error ? auditError.message : "unknown";
    console.error("[admin/audit] discovery.config_updated failed", { message });
  }

  return NextResponse.json({ ok: true, config: data });
}
```

- [ ] **Step 3: Type-check**

Run: `cd C:\Project\festivo-web && npx tsc --noEmit`
Expected: без грешки в новите файлове.

- [ ] **Step 4: Commit**

```bash
git add lib/admin/discovery/config.ts app/admin/api/discovery/config/route.ts
git commit -m "feat(discovery): admin config GET/PATCH endpoint с валидация"
```

---

### Task 7: Run-request POST route

**Files:**
- Create: `app/admin/api/discovery/run/route.ts`

- [ ] **Step 1: Напиши route-а с dedupe на pending заявки**

```ts
// app/admin/api/discovery/run/route.ts
import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { logAdminAction } from "@/lib/admin/audit-log";

type RunBody = { mode?: unknown; source_id?: unknown };

export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as RunBody;
  const mode = body.mode === "single_source" ? "single_source" : "full";

  let source_id: number | null = null;
  if (mode === "single_source") {
    const n = Number(body.source_id);
    if (!Number.isInteger(n) || n <= 0) {
      return NextResponse.json({ error: "source_id is required for single_source mode" }, { status: 400 });
    }
    source_id = n;
  }

  // Dedupe: ако вече има pending заявка за същия target — върни нея.
  const existingQuery = ctx.supabase
    .from("discovery_run_requests")
    .select("id, status, requested_at")
    .eq("status", "requested")
    .eq("mode", mode);
  const existing = source_id === null
    ? await existingQuery.is("source_id", null).maybeSingle()
    : await existingQuery.eq("source_id", source_id).maybeSingle();

  if (existing.data) {
    return NextResponse.json({ ok: true, id: existing.data.id, deduped: true });
  }

  const { data, error } = await ctx.supabase
    .from("discovery_run_requests")
    .insert({ status: "requested", mode, source_id, requested_by: ctx.user.id })
    .select("id")
    .single();

  if (error) {
    // Конкурентен insert хвана partial unique index → третирай като dedupe.
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ ok: true, deduped: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    await logAdminAction({
      actor_user_id: ctx.user.id,
      action: "discovery.run_requested",
      entity_type: "discovery_run_request",
      entity_id: String(data.id),
      route: "/admin/api/discovery/run",
      method: "POST",
      details: { mode, source_id },
    });
  } catch (auditError) {
    const message = auditError instanceof Error ? auditError.message : "unknown";
    console.error("[admin/audit] discovery.run_requested failed", { message });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: без грешки.

- [ ] **Step 3: Commit**

```bash
git add app/admin/api/discovery/run/route.ts
git commit -m "feat(discovery): run-request POST endpoint с dedupe на pending"
```

---

### Task 8: Requests GET route (за live панела)

**Files:**
- Create: `app/admin/api/discovery/requests/route.ts`

- [ ] **Step 1: Напиши route-а**

```ts
// app/admin/api/discovery/requests/route.ts
import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";

export async function GET() {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { data, error } = await ctx.supabase
    .from("discovery_run_requests")
    .select("id, status, mode, source_id, requested_at, claimed_at, finished_at, run_id, error")
    .order("requested_at", { ascending: false })
    .limit(20);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, requests: data ?? [] });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: без грешки.

- [ ] **Step 3: Commit**

```bash
git add app/admin/api/discovery/requests/route.ts
git commit -m "feat(discovery): requests GET endpoint за live статус"
```

---

## Phase D — Web UI (festivo-web)

### Task 9: Control panel компонент + закачане в страницата

**Files:**
- Create: `components/admin/DiscoveryControlPanel.tsx`
- Modify: `app/admin/(protected)/discovery/page.tsx`

- [ ] **Step 1: Напиши клиентския компонент**

```tsx
// components/admin/DiscoveryControlPanel.tsx
"use client";

import { useCallback, useEffect, useState } from "react";

type DiscoveryConfig = {
  score_threshold: number;
  max_sources_per_run: number;
  max_links_per_source: number;
  max_jobs_per_run: number;
  fetch_timeout_ms: number;
  soft_disable_approval_floor: number;
  soft_disable_min_enqueued: number;
  recovery_every: number;
  cron_enabled: boolean;
};

type RunRequest = {
  id: string;
  status: string;
  mode: string;
  source_id: number | null;
  requested_at: string;
  finished_at: string | null;
  run_id: number | null;
  error: string | null;
};

const NUMERIC_FIELDS: Array<{ key: keyof DiscoveryConfig; label: string; step?: number }> = [
  { key: "score_threshold", label: "Score праг" },
  { key: "max_sources_per_run", label: "Max източници / run" },
  { key: "max_links_per_source", label: "Max линкове / източник" },
  { key: "max_jobs_per_run", label: "Max jobs / run" },
  { key: "fetch_timeout_ms", label: "Fetch timeout (ms)" },
  { key: "soft_disable_approval_floor", label: "Soft-disable approval floor", step: 0.01 },
  { key: "soft_disable_min_enqueued", label: "Soft-disable min enqueued" },
  { key: "recovery_every", label: "Recovery на всеки N runs" },
];

export default function DiscoveryControlPanel() {
  const [config, setConfig] = useState<DiscoveryConfig | null>(null);
  const [requests, setRequests] = useState<RunRequest[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadConfig = useCallback(async () => {
    const res = await fetch("/admin/api/discovery/config");
    const json = await res.json();
    if (json.ok) setConfig(json.config);
  }, []);

  const loadRequests = useCallback(async () => {
    const res = await fetch("/admin/api/discovery/requests");
    const json = await res.json();
    if (json.ok) setRequests(json.requests);
  }, []);

  useEffect(() => {
    loadConfig();
    loadRequests();
  }, [loadConfig, loadRequests]);

  // Polling докато има активна заявка.
  useEffect(() => {
    const hasActive = requests.some((r) => r.status === "requested" || r.status === "claimed");
    if (!hasActive) return;
    const t = setInterval(loadRequests, 5000);
    return () => clearInterval(t);
  }, [requests, loadRequests]);

  const triggerRun = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/admin/api/discovery/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "full" }),
      });
      const json = await res.json();
      setNotice(json.ok ? (json.deduped ? "Вече има чакаща заявка." : "Заявката е създадена.") : `Грешка: ${json.error}`);
      await loadRequests();
    } finally {
      setBusy(false);
    }
  }, [loadRequests]);

  const saveConfig = useCallback(async () => {
    if (!config) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/admin/api/discovery/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const json = await res.json();
      setNotice(json.ok ? "Config-ът е запазен." : `Грешка: ${json.error}`);
      if (json.ok) setConfig(json.config);
    } finally {
      setBusy(false);
    }
  }, [config]);

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={triggerRun}
          disabled={busy}
          className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-45"
        >
          Пусни discovery
        </button>
        {notice && <span className="text-sm text-black/60">{notice}</span>}
      </div>

      {config && (
        <div className="rounded-2xl border border-black/10 p-5">
          <h3 className="mb-4 text-sm font-black uppercase tracking-[0.12em] text-black/50">Config</h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {NUMERIC_FIELDS.map(({ key, label, step }) => (
              <label key={key} className="flex flex-col gap-1 text-sm">
                <span className="text-black/60">{label}</span>
                <input
                  type="number"
                  step={step ?? 1}
                  value={config[key] as number}
                  onChange={(e) =>
                    setConfig({ ...config, [key]: Number(e.target.value) })
                  }
                  className="rounded-lg border border-black/15 px-2 py-1"
                />
              </label>
            ))}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config.cron_enabled}
                onChange={(e) => setConfig({ ...config, cron_enabled: e.target.checked })}
              />
              <span className="text-black/60">Cron активен</span>
            </label>
          </div>
          <button
            onClick={saveConfig}
            disabled={busy}
            className="mt-4 rounded-xl border border-black/15 px-4 py-2 text-sm font-semibold disabled:opacity-45"
          >
            Запази config
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-black/10 p-5">
        <h3 className="mb-4 text-sm font-black uppercase tracking-[0.12em] text-black/50">Заявки</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-black/50">
              <th className="py-1">Заявена</th><th>Статус</th><th>Mode</th><th>Run</th><th>Грешка</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className="border-t border-black/5">
                <td className="py-1">{new Date(r.requested_at).toLocaleString("bg-BG")}</td>
                <td>{r.status}</td>
                <td>{r.mode}</td>
                <td>{r.run_id ?? "—"}</td>
                <td className="text-[#b13a1a]">{r.error ?? ""}</td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr><td colSpan={5} className="py-2 text-black/40">Няма заявки.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Закачи компонента в страницата**

В `app/admin/(protected)/discovery/page.tsx` добави import-а и го render-ни близо до топа (под заглавието, над съществуващите таблици):
```tsx
import DiscoveryControlPanel from "@/components/admin/DiscoveryControlPanel";
// ... в JSX, след header секцията:
<DiscoveryControlPanel />
```

- [ ] **Step 3: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: без грешки.

- [ ] **Step 4: Build smoke**

Run: `npm run build`
Expected: успешен build; `/admin/discovery` се компилира.

- [ ] **Step 5: Ръчна проверка (dev)**

Run: `npm run dev`, отвори `/admin/discovery` като admin. Провери: config зарежда стойности, „Запази config" дава „Config-ът е запазен.", „Пусни discovery" създава ред в Заявки със статус `requested`.
> Потвърди в Supabase: `select * from discovery_run_requests order by requested_at desc limit 3;`

- [ ] **Step 6: Commit**

```bash
git add components/admin/DiscoveryControlPanel.tsx "app/admin/(protected)/discovery/page.tsx"
git commit -m "feat(discovery): admin control panel UI (run + config + requests)"
```

---

## Phase E — Deploy + Документация

### Task 10: Railway cron service + docs

**Files:**
- Modify: `PROJECT_CONTEXT.md`, `docs/system-architecture.md`, `docs/er-diagram.md`, `CLAUDE.md` (festivo-web)
- Modify: `README.md` (festivo-workers)

- [ ] **Step 1: Документирай новите таблици и поток (festivo-web)**

Добави в `PROJECT_CONTEXT.md` (discovery секция) и `docs/system-architecture.md` кратка „Discovery Control Plane" подсекция, описваща:
- `discovery_config` (singleton, admin-tunable) и `discovery_run_requests` (опашка, claim чрез lock_token).
- Потока: admin UI → control таблици → worker claim на Railway cron tick.
В `docs/er-diagram.md` добави релациите `discovery_run_requests.run_id → discovery_runs.id` и `discovery_run_requests.source_id → discovery_sources.id`.

- [ ] **Step 2: Обнови CLAUDE.md**

- В „Important tables" добави `discovery_config` · `discovery_run_requests`.
- В Deployment секцията (Railway таблица) добави нов ред: cron service `festivo-discovery` → `npm run start:discovery`, интервал ~6h.

- [ ] **Step 3: Обнови worker README (festivo-workers)**

Добави секция, че `discovery_seed_worker.js`:
- чете `discovery_config` (fallback към env, изброй новите DB колони),
- claim-ва `discovery_run_requests` на всеки tick; ако няма заявка и `cron_enabled=true` → scheduled run.
Изброй новите env-fallback променливи (`DISCOVERY_SOFT_DISABLE_APPROVAL_FLOOR`, `DISCOVERY_SOFT_DISABLE_MIN_ENQUEUED`, `DISCOVERY_CRON_ENABLED`).

- [ ] **Step 4: Създай Railway cron service (ръчно, извън кода — инструкция за оператора)**

В Railway проекта `giving-passion` → нов service от repo `festivo-workers`:
- Start command: `npm run start:discovery`
- Cron schedule: `0 */6 * * *` (на всеки 6 часа)
- Копирай env-ите от съществуващия `festivo-workers` service (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` минимум).
> Това е операционна стъпка — не блокира code merge-а. Отбележи я като TODO в PR описанието.

- [ ] **Step 5: Commit (двете repo-та поотделно)**

```bash
# festivo-web
cd C:\Project\festivo-web
git add PROJECT_CONTEXT.md docs/system-architecture.md docs/er-diagram.md CLAUDE.md
git commit -m "docs(discovery): control plane таблици, поток и Railway cron service"

# festivo-workers
cd C:\Project\festivo-workers
git add README.md
git commit -m "docs(discovery): config таблица + run-request claiming в worker README"
```

---

## Финализиране (PR-и)

- [ ] **festivo-web:** push `feat/discovery-control-plane`, отвори PR (използвай CLAUDE.md PR template — отбележи Railway cron като ръчна стъпка), merge.
- [ ] **festivo-workers:** push `feat/discovery-control-plane`, отвори PR, merge.
- [ ] След merge на web → Vercel автоматично деплойва. Worker промените влизат в Railway при следващия build на новия cron service.

---

## Критерии за приемане (от spec-а)

- [ ] Admin пуска run с бутон и вижда статуса до приключване (Task 7, 8, 9).
- [ ] Admin сменя `score_threshold` от UI и следващ run го уважава без deploy (Task 3, 5, 6, 9).
- [ ] `cron_enabled=false` спира scheduled runs; on-demand заявките пак работят (Task 5).
- [ ] Два паралелни tick-а не изпълняват един request (Task 4 — lock_token race guard).
- [ ] Липсваща `discovery_config` → worker върви на defaults (Task 2 — fail-safe read).
- [ ] Миграция с indexes + RLS; admin-only достъп (Task 1).
- [ ] Regression тестовете минават непроменени (Task 3, 5).
