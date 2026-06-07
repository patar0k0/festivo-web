# Discovery Control Plane — Design Spec

**Дата:** 2026-06-08
**Статус:** Approved (brainstorming) → готов за writing-plans
**Под-проект:** 1 от 3 (Discovery професионализация)
**Засегнати repo-та:** `festivo-web` (control plane + UI) · `festivo-workers` (config-aware runner)

---

## 1. Контекст и проблем

Discovery е автоматичната фуния, която намира кандидати за нови фестивали:

```
discovery_sources (зададени от admin сайтове: общини, FB страници, агрегатори)
   → discovery_seed_worker.js обхожда + оценява линкове (scoring + learning)
   → discovered_links (всички намерени линкове + бал + reasons)
   → ingest_jobs (тези над прага)
   → FB ingest worker вади детайли → pending_festivals
   → admin одобрява → festivals
```

Системата е moderation-first: discovery **само предлага** кандидати, нищо не се публикува автоматично.

### Текущо състояние (одит 2026-06-08)

Backend-ът **не е скеле** — има зрял scoring engine, learning от festival корпус, adaptive source-health (soft-disable + recovery), dedup през 4 таблици и 30+ regression теста. Проблемът е **операционен**:

1. **Discovery практически не се върти.** `discovery_seed_worker.js` (`npm run start:discovery`) няма собствен Railway cron service. Стартира се само ръчно. Railway `festivo-workers` service пуска FB ingest processor-а, не discovery.
2. **Нулев operator контрол.** Всички прагове (`DISCOVERY_SCORE_THRESHOLD=65`, max-links, health политики) са hardcoded в worker-а или по env. Промяна изисква code/redeploy.
3. **Сляп мониторинг.** Web `/admin/discovery` само пасивно чете `discovery_runs`. Няма trigger, няма config, няма live статус на заявка.

### Цел на този под-проект

Превърни discovery в управляема система: operator-ът пуска run от admin (или по график), тунингова параметрите без deploy, и вижда живо състояние — **без worker-ът да приема inbound HTTP** (остава decoupled Railway cron).

---

## 2. Архитектурен принцип

Цялата координация web ↔ worker минава през **Supabase control таблици**. Това спазва:

- CLAUDE.md принцип №1 — Supabase = single source of truth.
- Safety rules — background работа idempotent, guarded с dedupe/lock key.
- Decoupling — worker-ът не отваря HTTP порт; продължава да е one-shot cron, който чете състояние от Supabase.

```
Admin UI (/admin/discovery)
   │  "Пусни сега"   → INSERT discovery_run_requests (status=requested, dedupe)
   │  "Запази config"→ UPSERT discovery_config (прагове, max-links, health policy)
   ▼
Supabase  ◄──────────────────────────────────────────────────────┐
   ▲                                                               │
   │  Railway cron (нов service `start:discovery`, на ~6h)         │
discovery_seed_worker.js:                                          │
   1. readDiscoveryConfig()  → прагове от таблица (fallback env)   │
   2. claimRunRequest()      → атомарен claim на 1 pending request ┘
      ИЛИ върви по schedule (config.cron_enabled)
   3. runDiscovery(config)   → пише discovery_runs (както сега)
   4. маркира run_request = done + връзва run_id
```

---

## 3. Компоненти

### 3.1 База данни (миграции в `scripts/sql/`, festivo-web)

Файл: `scripts/sql/20260608_discovery_control_plane.sql` — съдържа таблици, индекси, constraints и RLS.

#### `discovery_config`
Единичен глобален ред с тунингуеми параметри. Singleton (enforced с `CHECK (id = 1)` или `singleton boolean unique`).

| Колона | Тип | Бележка |
|---|---|---|
| `id` | int PK | винаги 1 (singleton) |
| `score_threshold` | int | default 65 |
| `max_sources_per_run` | int | default 10 |
| `max_links_per_source` | int | default 40 |
| `max_jobs_per_run` | int | default 30 |
| `fetch_timeout_ms` | int | default 12000 |
| `soft_disable_approval_floor` | numeric | default 0.05 |
| `soft_disable_min_enqueued` | int | default 30 |
| `recovery_every` | int | default 5 |
| `cron_enabled` | boolean | default true — пуска ли се по график без request |
| `updated_at` | timestamptz | |
| `updated_by` | uuid | admin user id |

Валидация (server-side, в API): всички числа finite/положителни; `score_threshold` в [0,200]; `soft_disable_approval_floor` в [0,1].

**RLS:** четене/писане само admin (по `user_roles`). Worker чете със service role (bypass RLS).

#### `discovery_run_requests`
Опашка от заявки за run.

| Колона | Тип | Бележка |
|---|---|---|
| `id` | uuid PK | |
| `status` | text | `requested` / `claimed` / `done` / `failed` |
| `mode` | text | `full` / `single_source` |
| `source_id` | bigint NULL | за targeted run |
| `requested_by` | uuid | admin user |
| `requested_at` | timestamptz | default now() |
| `lock_token` | uuid NULL | за атомарен claim |
| `claimed_at` | timestamptz NULL | |
| `finished_at` | timestamptz NULL | |
| `run_id` | uuid/bigint NULL | FK към discovery_runs |
| `error` | text NULL | |

**Индекси:**
- partial unique: `WHERE status = 'requested'` върху `(mode, COALESCE(source_id, -1))` — предотвратява натрупване на дублирани pending заявки (dedupe key).
- индекс по `status, requested_at` за claim четенето.

**RLS:** admin четене/insert; worker service role пълен достъп.

### 3.2 Web (festivo-web)

Спазва API route conventions (admin endpoints → service-role след `hasAdminRole`/`resolveAdminAccessOrRedirect`, audit log).

| Endpoint | Метод | Действие |
|---|---|---|
| `app/admin/api/discovery/run/route.ts` | POST | Insert `discovery_run_requests` (mode/source_id от body). Dedupe: ако вече има requested със същия ключ → връща съществуващия. Audit: `discovery.run_requested`. |
| `app/admin/api/discovery/config/route.ts` | GET | Връща текущия config (или defaults ако няма ред). |
| `app/admin/api/discovery/config/route.ts` | PATCH | Валидира + upsert config. Audit: `discovery.config_updated` с changed_fields. |
| `app/admin/api/discovery/requests/route.ts` | GET | Последни N run_requests със статус (за live панела). |

UI в `app/admin/(protected)/discovery/page.tsx` + нови компоненти в `components/admin/`:
- Бутон **„Пусни discovery"** (full) + опция за targeted single-source run.
- Форма **Config** (прагове, max-links, health политика, cron_enabled toggle) с валидация.
- Панел **„Заявки"** — list на последните requests със статус, polling на ~5s докато има `requested`/`claimed`.

Дизайнът е без специални изисквания (UI-only слой) — следва съществуващия admin визуален език.

### 3.3 Worker (festivo-workers)

Backward-compatible — ако таблиците липсват/празни, пада на env+defaults (без да чупи текущото поведение).

- `workers/lib/discovery_config.js` → `readDiscoveryConfig(supabase)`:
  - SELECT от `discovery_config` (id=1); при липса/грешка → обект от env/hardcoded defaults (както сега).
  - Връща нормализиран config обект.
- `workers/lib/discovery_run_requests.js` → `claimRunRequest(supabase)`:
  - Генерира `lock_token`, прави `UPDATE ... SET status='claimed', lock_token, claimed_at WHERE status='requested' AND id = (SELECT ... ORDER BY requested_at LIMIT 1)` с конкурентно-безопасен pattern (claim чрез върнат ред / `.eq('lock_token')` верификация). Idempotent: два tick-а не взимат един request.
  - Връща заявката или null.
  - `finishRunRequest(supabase, id, { run_id, status, error })`.
- `discovery_seed_worker.js`:
  - `runDiscovery()` приема `config` обект; всички места, които четат env прагове, минават през него.
  - Главният flow: `config = readDiscoveryConfig()` → ако има pending request → claim + run + finish; иначе ако `config.cron_enabled` → нормален scheduled run; иначе skip.
- **Railway:** нов cron service `start:discovery` на разумен интервал (препоръка ~6h; targeted on-demand заявките се хващат на следващия tick — за под-проект 1 polling-cadence е приемлив, под-проект 2 може да го учести).

---

## 4. Idempotency / Safety

- Claim чрез `lock_token` + статус преход → конкурентни worker tick-ове не дублират run (safety rule: dedupe key).
- Partial unique index спира трупане на дублирани `requested` заявки.
- `readDiscoveryConfig` е fail-safe: липсващ ред/грешка → defaults, run-ът никога не се чупи.
- Никакъв service-role на клиента; всичко привилегировано е server-only (CLAUDE.md).
- Batch/insert лимити непроменени (≤500), scoring непроменен.

---

## 5. Обхват

### Включва
- 2 нови control таблици + миграция (indexes + RLS).
- 4 admin API endpoint-а (run, config GET/PATCH, requests).
- Admin UI: trigger бутон, config форма, requests панел.
- Worker: config-aware runner + request claiming + нов Railway cron service.

### НЕ включва (YAGNI / следващи под-проекти)
- Промени по scoring/extraction алгоритъма → под-проект 3.
- Alerting при провал/празен run, source-health история → под-проект 2.
- Realtime websockets (обикновен polling стига).
- Multi-tenant / повече от един config ред.
- Учестен near-realtime trigger (текущата cron cadence е приемлива за v1).

---

## 6. Документация за update в същия PR

- `scripts/sql/20260608_discovery_control_plane.sql` (миграция — задължително).
- `PROJECT_CONTEXT.md` — нови control таблици + поток.
- `docs/system-architecture.md` — discovery control plane секция.
- `docs/er-diagram.md` — ако се добавят релации (run_requests → discovery_runs).
- CLAUDE.md — нови env/таблици ако се наложи; Railway deploy таблицата (нов cron service).
- README.md (worker repo) — нов service + config таблица.

---

## 7. Критерии за готовност

- [ ] Admin може да пусне discovery run с бутон и да види статуса му до приключване.
- [ ] Admin може да смени `score_threshold` от UI и следващият run го уважава (без deploy).
- [ ] `cron_enabled=false` спира автоматичните scheduled runs; on-demand заявките пак работят.
- [ ] Два паралелни worker tick-а не изпълняват един и същ request (idempotent claim).
- [ ] Липсваща `discovery_config` → worker върви на defaults (backward-compatible).
- [ ] Миграция с indexes + RLS; admin-only достъп валидиран.
- [ ] Regression тестовете на worker-а минават непроменени.
