# mc.gov.bg Event Scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a manually-run CLI script that scrapes mc.government.bg's static cultural-events calendar within an admin-supplied date window, filters aggressively before the expensive enrichment step, and inserts the survivors into `ingest_jobs` (`source_type=research`) by reusing the existing research pipeline.

**Architecture:** A handful of small, independently-testable pure modules under `lib/admin/ingest/mcGov/` (HTML parsing, keyword filter, dedup date guard, progress-log I/O, AI prescreen prompt/response, and the `SmartResearchResult → PerplexityFestivalResearchResult` mapper), orchestrated by a thin CLI entry point at `scripts/mc-gov-import.ts` that wires them together with the existing `findDuplicateFestivals`, `runSmartResearchPipeline`, and `insertResearchIngestJob` functions.

**Tech Stack:** TypeScript, `cheerio` (new dependency, for HTML parsing), `tsx` (new dev dependency, to run the script), Node's built-in `fetch`, Gemini (via existing `lib/admin/research/gemini-provider.ts`), Supabase (via existing `lib/supabaseAdmin.ts`), vitest (existing test runner, tests written with `node:test` + `node:assert/strict` per existing repo convention, e.g. `lib/admin/poster/computeEnrichmentPatch.test.ts`).

**Spec:** [docs/superpowers/specs/2026-06-23-mc-gov-scraper-design.md](../specs/2026-06-23-mc-gov-scraper-design.md)

---

## Reconnaissance findings (de-risking the spec's open items)

The spec flagged "exact HTML structure" and "date-range query param" as open items. Both were
resolved by fetching the live site directly during planning:

- **No server-side date-range query param exists.** The script must walk pages and filter by
  date client-side, as the spec's fallback already assumed.
- **Pagination:** page 1 is `https://mc.government.bg/вид-новина/събития-календар/` (no query
  param); page N≥2 is the same URL with `?e-page-2f0f9c7=N`. There is no reliable static "last
  page" indicator in the HTML — the script must walk forward and stop when a page returns zero
  event cards.
- **Each event card** is a `div[data-elementor-type="loop-item"]` whose `class` attribute
  contains `e-loop-item-{wordpressPostId}` — a stable per-event numeric ID.
- **No event card links anywhere to a detail page.** There is no per-event URL on the site. The
  script synthesizes one from the WordPress post ID using the universal WP shortlink format:
  `https://mc.government.bg/?p={postId}`. This is the value used as `source_url` /
  progress-log key.
- **Title** is the first `h4.elementor-heading-title` inside the card.
- **Date** appears in one of two label formats depending on which event template was used
  (confirmed both exist on the live site):
  - `Дата на провеждане: DD.MM.YYYY -` followed by a second `.elementor-heading-title` element
    containing just the end date `DD.MM.YYYY`
  - `Ще се проведе на <date> до <date>` as a single string (seen in the original screenshot
    that kicked off this project)
  Both `DD.MM.YYYY` and `YYYY-MM-DD` date formats have been observed across templates.
- **Location and organizer** are plain-text `<p>` elements inside the card's
  `.elementor-widget-theme-post-content` block, prefixed `Место:` / `Място:` →
  `Място: {text}` and `Организатор: {text}`.
- No HTML parsing library exists in this repo yet — `cheerio` is added as a new, minimal,
  well-known dependency rather than parsing nested divs with regex (unreliable for arbitrarily
  nested HTML).

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/admin/ingest/mcGov/parseListPage.ts` | Parse one mc.gov.bg list-page HTML string into `McGovScrapedEvent[]` |
| `lib/admin/ingest/mcGov/fetchListPage.ts` | Fetch one list page over HTTP (thin, not unit-tested) |
| `lib/admin/ingest/mcGov/keywordFilter.ts` | Wide keyword match against an event title |
| `lib/admin/ingest/mcGov/dedupDateGuard.ts` | Apply the ±2-day date guard on top of `findDuplicateFestivals` title matches |
| `lib/admin/ingest/mcGov/importLog.ts` | Read/write the local JSON progress log |
| `lib/admin/ingest/mcGov/prescreen.ts` | Build the cheap Gemini prescreen prompt, parse its response, run it |
| `lib/admin/ingest/mcGov/buildAiResult.ts` | Map a `SmartResearchResult` into the `ai_result` shape `buildResearchPendingRowFromRequest` expects |
| `scripts/mc-gov-import.ts` | CLI entry point: arg parsing + orchestration of the above |
| `.gitignore` | Add `scripts/.mc-gov-import-log.json` |

Each `lib/admin/ingest/mcGov/*.ts` file (except `fetchListPage.ts`) has a co-located
`*.test.ts`, matching the existing repo convention (e.g.
`lib/admin/poster/computeEnrichmentPatch.test.ts`), so they're picked up automatically by the
existing `vitest.config.ts` (`include: ["lib/**/*.test.ts"]`) — no config change needed.

---

### Task 1: Add dependencies and a real HTML fixture

**Files:**
- Modify: `package.json`
- Create: `lib/admin/ingest/mcGov/__fixtures__/sample-list-page.html`

- [ ] **Step 1: Install cheerio and tsx**

Run:
```bash
npm install cheerio
npm install --save-dev tsx
```

Expected: `package.json` now lists `cheerio` under `dependencies` and `tsx` under
`devDependencies`.

- [ ] **Step 2: Create the test fixture directory and file**

Create `lib/admin/ingest/mcGov/__fixtures__/sample-list-page.html` with this exact content (a
trimmed, real excerpt of mc.gov.bg's markup, captured during planning — includes one card using
the "Дата на провеждане" template and one synthetic card using the "Ще се проведе" template, to
exercise both date-label code paths in the parser test in Task 2):

```html
<div data-elementor-type="loop-item" data-elementor-id="8091942" class="elementor elementor-8091942 e-loop-item e-loop-item-8093613 post-8093613 news type-news status-publish hentry news-type-812 mc_year-21" data-elementor-post-type="elementor_library" data-custom-edit-handle="1">
  <div class="elementor-element elementor-element-d56643c e-con-full e-flex e-con e-parent" data-id="d56643c" data-element_type="container">
    <div class="elementor-element elementor-element-e4daf92 elementor-widget elementor-widget-heading" data-id="e4daf92" data-element_type="widget">
      <h4 class="elementor-heading-title elementor-size-default">Еньов ден &#8211; битов ритуал &#8211; Секретар, библиотекари</h4>
    </div>
    <div class="elementor-element elementor-element-8a0fd9c e-flex e-con-boxed e-con e-child" data-id="8a0fd9c" data-element_type="container">
      <div class="e-con-inner">
        <div class="elementor-element elementor-element-8b6845e elementor-widget elementor-widget-heading" data-id="8b6845e" data-element_type="widget">
          <p class="elementor-heading-title elementor-size-default">Дата на провеждане: 24.06.2026 - </p>
        </div>
        <div class="elementor-element elementor-element-cbdbf86 elementor-widget elementor-widget-heading" data-id="cbdbf86" data-element_type="widget">
          <p class="elementor-heading-title elementor-size-default">24.06.2026</p>
        </div>
      </div>
    </div>
    <div class="elementor-element elementor-element-c48e4a8 elementor-widget elementor-widget-theme-post-content" data-id="c48e4a8" data-element_type="widget">
      <p>Място: с. Гара Орешец, община Димово</p>
      <p>Организатор: Секретар, библиотекари</p>
    </div>
  </div>
</div>
<div data-elementor-type="loop-item" data-elementor-id="8091942" class="elementor elementor-8091942 e-loop-item e-loop-item-9100201 post-9100201 news type-news status-publish hentry news-type-812 mc_year-21" data-elementor-post-type="elementor_library" data-custom-edit-handle="1">
  <div class="elementor-element elementor-element-d56643c e-con-full e-flex e-con e-parent" data-id="d56643c" data-element_type="container">
    <div class="elementor-element elementor-element-e4daf92 elementor-widget elementor-widget-heading" data-id="e4daf92" data-element_type="widget">
      <h4 class="elementor-heading-title elementor-size-default">Фолклорен събор на етносите &#8222;Пее ми се, играе ми се&#8220; &#8211; Народно читалище &#8222;Мито Марков-1912 г.&#8220;</h4>
    </div>
    <div class="elementor-element elementor-element-8a0fd9c e-flex e-con-boxed e-con e-child" data-id="8a0fd9c" data-element_type="container">
      <div class="e-con-inner">
        <div class="elementor-element elementor-element-8b6845e elementor-widget elementor-widget-heading" data-id="8b6845e" data-element_type="widget">
          <p class="elementor-heading-title elementor-size-default">Ще се проведе на 2026-07-12 до 2026-07-12</p>
        </div>
      </div>
    </div>
    <div class="elementor-element elementor-element-c48e4a8 elementor-widget elementor-widget-theme-post-content" data-id="c48e4a8" data-element_type="widget">
      <p>Място: Салона на читалището, село Макреш, община Макреш</p>
      <p>Организатор: Народно читалище &#8222;Мито Марков-1912 г.&#8220;</p>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json lib/admin/ingest/mcGov/__fixtures__/sample-list-page.html
git commit -m "chore(ingest): add cheerio + tsx for mc.gov.bg scraper"
```

---

### Task 2: HTML parser (`parseMcGovListPage`)

**Files:**
- Create: `lib/admin/ingest/mcGov/parseListPage.ts`
- Test: `lib/admin/ingest/mcGov/parseListPage.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/admin/ingest/mcGov/parseListPage.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseMcGovListPage } from "./parseListPage.js";

function loadFixture(): string {
  return readFileSync(
    path.join(import.meta.dirname, "__fixtures__/sample-list-page.html"),
    "utf-8",
  );
}

test("parses both card templates from a real fixture page", () => {
  const events = parseMcGovListPage(loadFixture());
  assert.equal(events.length, 2);

  const [first, second] = events;

  assert.equal(first.postId, "8093613");
  assert.equal(first.title, "Еньов ден – битов ритуал – Секретар, библиотекари");
  assert.equal(first.startDate, "2026-06-24");
  assert.equal(first.endDate, "2026-06-24");
  assert.equal(first.locationName, "с. Гара Орешец, община Димово");
  assert.equal(first.organizerName, "Секретар, библиотекари");
  assert.equal(first.sourceUrl, "https://mc.government.bg/?p=8093613");

  assert.equal(second.postId, "9100201");
  assert.equal(
    second.title,
    'Фолклорен събор на етносите „Пее ми се, играе ми се“ – Народно читалище „Мито Марков-1912 г.“',
  );
  assert.equal(second.startDate, "2026-07-12");
  assert.equal(second.endDate, "2026-07-12");
  assert.equal(second.locationName, "Салона на читалището, село Макреш, община Макреш");
  assert.equal(second.organizerName, 'Народно читалище „Мито Марков-1912 г.“');
  assert.equal(second.sourceUrl, "https://mc.government.bg/?p=9100201");
});

test("returns an empty array for a page with no event cards", () => {
  const events = parseMcGovListPage("<html><body>no events here</body></html>");
  assert.deepEqual(events, []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/admin/ingest/mcGov/parseListPage.test.ts`
Expected: FAIL — `Cannot find module './parseListPage.js'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `lib/admin/ingest/mcGov/parseListPage.ts`:

```typescript
import * as cheerio from "cheerio";

export type McGovScrapedEvent = {
  postId: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  locationName: string | null;
  organizerName: string | null;
  sourceUrl: string;
};

const POST_ID_CLASS_RE = /\be-loop-item-(\d+)\b/;
const DATE_PROVEJDANE_RE = /Дата на провеждане:\s*([\d.]{8,10})\s*-\s*([\d.]{8,10})/;
const DATE_SHTE_SE_RE = /Ще се проведе на\s*([\d.-]{8,10})\s*до\s*([\d.-]{8,10})/;

function normalizeDate(raw: string): string | null {
  const trimmed = raw.trim();

  const dmy = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return null;
}

/**
 * Parses one mc.gov.bg event-calendar list page. Two card templates exist on
 * the live site (confirmed by fetching both during planning): one splits the
 * date across two heading widgets ("Дата на провеждане: X -" + "Y"), the
 * other puts both dates in one "Ще се проведе на X до Y" string. Location and
 * organizer text is read directly from the relevant <p> elements rather than
 * a joined-text regex, since joined text concatenation across sibling tags is
 * not reliably whitespace-separated.
 */
export function parseMcGovListPage(html: string): McGovScrapedEvent[] {
  const $ = cheerio.load(html);
  const events: McGovScrapedEvent[] = [];

  $('[data-elementor-type="loop-item"]').each((_, el) => {
    const node = $(el);
    const classAttr = node.attr("class") ?? "";
    const postIdMatch = classAttr.match(POST_ID_CLASS_RE);
    if (!postIdMatch) return;
    const postId = postIdMatch[1];

    const headingTexts = node
      .find(".elementor-heading-title")
      .map((__, h) => $(h).text().trim())
      .toArray();
    const title = headingTexts[0] ?? "";
    if (!title) return;

    const dateText = headingTexts.slice(1).join(" ");
    let startDate: string | null = null;
    let endDate: string | null = null;
    const provejdaneMatch = dateText.match(DATE_PROVEJDANE_RE);
    const shteSeMatch = dateText.match(DATE_SHTE_SE_RE);
    if (provejdaneMatch) {
      startDate = normalizeDate(provejdaneMatch[1]);
      endDate = normalizeDate(provejdaneMatch[2]);
    } else if (shteSeMatch) {
      startDate = normalizeDate(shteSeMatch[1]);
      endDate = normalizeDate(shteSeMatch[2]);
    }

    let locationName: string | null = null;
    let organizerName: string | null = null;
    node.find(".elementor-widget-theme-post-content p").each((__, p) => {
      const text = $(p).text().trim();
      if (text.startsWith("Място:")) {
        locationName = text.slice("Място:".length).trim();
      } else if (text.startsWith("Организатор:")) {
        organizerName = text.slice("Организатор:".length).trim();
      }
    });

    events.push({
      postId,
      title,
      startDate,
      endDate,
      locationName,
      organizerName,
      sourceUrl: `https://mc.government.bg/?p=${postId}`,
    });
  });

  return events;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/admin/ingest/mcGov/parseListPage.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/admin/ingest/mcGov/parseListPage.ts lib/admin/ingest/mcGov/parseListPage.test.ts
git commit -m "feat(ingest): parse mc.gov.bg event-calendar list pages"
```

---

### Task 3: Keyword filter

**Files:**
- Create: `lib/admin/ingest/mcGov/keywordFilter.ts`
- Test: `lib/admin/ingest/mcGov/keywordFilter.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/admin/ingest/mcGov/keywordFilter.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesFestivalKeyword } from "./keywordFilter.js";

test("matches titles containing any festival-adjacent keyword", () => {
  assert.equal(matchesFestivalKeyword("Международен фолклорен фестивал"), true);
  assert.equal(matchesFestivalKeyword("Събор на читалището"), true);
  assert.equal(matchesFestivalKeyword("Великденски панаир на занаятите"), true);
  assert.equal(matchesFestivalKeyword("Карнавал на цветята"), true);
  assert.equal(matchesFestivalKeyword("Надпяване и надсвирване край реката"), true);
  assert.equal(matchesFestivalKeyword("Празник на гората"), true);
  assert.equal(matchesFestivalKeyword("Лятен джаз концерт"), true);
});

test("rejects titles with no festival-adjacent keyword", () => {
  assert.equal(matchesFestivalKeyword("Отбелязване на годишнина от рождението на Васил Левски"), false);
  assert.equal(matchesFestivalKeyword("130 години Народно читалище „Пробуда“"), false);
  assert.equal(matchesFestivalKeyword("Изложба на местни художници"), false);
});

test("is case-insensitive", () => {
  assert.equal(matchesFestivalKeyword("ФЕСТИВАЛ на изкуствата"), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/admin/ingest/mcGov/keywordFilter.test.ts`
Expected: FAIL — `Cannot find module './keywordFilter.js'`

- [ ] **Step 3: Write the implementation**

Create `lib/admin/ingest/mcGov/keywordFilter.ts`:

```typescript
const FESTIVAL_KEYWORDS = [
  "фестивал",
  "фест",
  "събор",
  "панаир",
  "карнавал",
  "надпяване",
  "надсвирване",
  "надиграване",
  "концерт",
  "празник",
];

export function matchesFestivalKeyword(title: string): boolean {
  const lower = title.toLowerCase();
  return FESTIVAL_KEYWORDS.some((keyword) => lower.includes(keyword));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/admin/ingest/mcGov/keywordFilter.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/admin/ingest/mcGov/keywordFilter.ts lib/admin/ingest/mcGov/keywordFilter.test.ts
git commit -m "feat(ingest): add mc.gov.bg keyword filter"
```

---

### Task 4: Dedup date guard

**Files:**
- Create: `lib/admin/ingest/mcGov/dedupDateGuard.ts`
- Test: `lib/admin/ingest/mcGov/dedupDateGuard.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/admin/ingest/mcGov/dedupDateGuard.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickDuplicateWithDateGuard } from "./dedupDateGuard.js";
import type { DuplicateMatch } from "@/lib/admin/research/findDuplicateFestivals";

function makeMatch(overrides: Partial<DuplicateMatch> = {}): DuplicateMatch {
  return {
    id: "match-1",
    title: "Събор на Пудрия",
    table: "festival",
    href: "/admin/festivals/match-1",
    start_date: "2026-07-12",
    status: "verified",
    score: 0.5,
    same_year: true,
    ...overrides,
  };
}

test("does NOT flag two different village fairs sharing template words but different dates", () => {
  // Real scenario discussed during design: "Събор на Краводер" vs "Събор на
  // Пудрия" share the generic word "събор" and can cross the title-score
  // threshold, but they happen on different days in different villages.
  const matches = [makeMatch({ title: "Събор на Пудрия", start_date: "2026-08-20" })];
  const result = pickDuplicateWithDateGuard(matches, "2026-07-12");
  assert.equal(result, null);
});

test("flags a match when start_date is exactly equal", () => {
  const matches = [makeMatch({ start_date: "2026-07-12" })];
  const result = pickDuplicateWithDateGuard(matches, "2026-07-12");
  assert.equal(result?.id, "match-1");
});

test("flags a match when start_date is within 2 days", () => {
  const matches = [makeMatch({ start_date: "2026-07-14" })];
  const result = pickDuplicateWithDateGuard(matches, "2026-07-12");
  assert.equal(result?.id, "match-1");
});

test("does not flag a match when start_date is more than 2 days apart", () => {
  const matches = [makeMatch({ start_date: "2026-07-15" })];
  const result = pickDuplicateWithDateGuard(matches, "2026-07-12");
  assert.equal(result, null);
});

test("returns null when the scraped event has no start_date", () => {
  const matches = [makeMatch({ start_date: "2026-07-12" })];
  const result = pickDuplicateWithDateGuard(matches, null);
  assert.equal(result, null);
});

test("skips candidates with no start_date and falls through to a later one that matches", () => {
  const matches = [
    makeMatch({ id: "no-date", start_date: null }),
    makeMatch({ id: "dated", start_date: "2026-07-12" }),
  ];
  const result = pickDuplicateWithDateGuard(matches, "2026-07-12");
  assert.equal(result?.id, "dated");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/admin/ingest/mcGov/dedupDateGuard.test.ts`
Expected: FAIL — `Cannot find module './dedupDateGuard.js'`

- [ ] **Step 3: Write the implementation**

Create `lib/admin/ingest/mcGov/dedupDateGuard.ts`:

```typescript
import type { DuplicateMatch } from "@/lib/admin/research/findDuplicateFestivals";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAY_DIFFERENCE = 2;

function daysBetween(isoA: string, isoB: string): number {
  return Math.abs(Date.parse(isoA) - Date.parse(isoB)) / DAY_MS;
}

/**
 * `findDuplicateFestivals` scores title similarity for the admin's
 * interactive duplicate panel, where `same_year` alone is an adequate guard
 * because a human reviews every flagged match. For this unattended script,
 * `same_year` is too weak: village fairs on mc.gov.bg often share a generic
 * title template ("Събор на X") where 2-3 shared words across two different
 * villages can cross the title-score threshold within the same year. These
 * events are tied to a fixed calendar date rather than a recurring annual
 * edition, so an exact-or-near start_date match is a much stronger and
 * simpler disambiguator. Returns the first candidate whose start_date is
 * within `MAX_DAY_DIFFERENCE` days of the scraped event's start_date, or null
 * if none qualify.
 */
export function pickDuplicateWithDateGuard(
  matches: DuplicateMatch[],
  startDate: string | null,
): DuplicateMatch | null {
  if (!startDate) return null;

  for (const match of matches) {
    if (!match.start_date) continue;
    if (daysBetween(match.start_date, startDate) <= MAX_DAY_DIFFERENCE) {
      return match;
    }
  }

  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/admin/ingest/mcGov/dedupDateGuard.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/admin/ingest/mcGov/dedupDateGuard.ts lib/admin/ingest/mcGov/dedupDateGuard.test.ts
git commit -m "feat(ingest): add date-guarded dedup check for mc.gov.bg imports"
```

---

### Task 5: Progress log

**Files:**
- Create: `lib/admin/ingest/mcGov/importLog.ts`
- Test: `lib/admin/ingest/mcGov/importLog.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/admin/ingest/mcGov/importLog.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  readImportLog,
  writeImportLog,
  hasImportLogEntry,
  setImportLogEntry,
} from "./importLog.js";

function withTempLogPath(run: (logPath: string) => void) {
  const dir = mkdtempSync(path.join(tmpdir(), "mc-gov-import-log-"));
  const logPath = path.join(dir, "log.json");
  try {
    run(logPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("readImportLog returns an empty log when the file does not exist", () => {
  withTempLogPath((logPath) => {
    const log = readImportLog(logPath);
    assert.deepEqual(log, { entries: {} });
  });
});

test("setImportLogEntry + writeImportLog + readImportLog round-trips an entry", () => {
  withTempLogPath((logPath) => {
    const log = readImportLog(logPath);
    setImportLogEntry(log, "https://mc.government.bg/?p=123", {
      status: "inserted",
      title: "Тест фестивал",
      ingest_job_id: "job-1",
      processed_at: "2026-06-23T10:00:00.000Z",
    });
    writeImportLog(logPath, log);

    const reloaded = readImportLog(logPath);
    assert.equal(hasImportLogEntry(reloaded, "https://mc.government.bg/?p=123"), true);
    assert.equal(reloaded.entries["https://mc.government.bg/?p=123"].status, "inserted");
  });
});

test("hasImportLogEntry returns false for an unseen source_url", () => {
  withTempLogPath((logPath) => {
    const log = readImportLog(logPath);
    assert.equal(hasImportLogEntry(log, "https://mc.government.bg/?p=999"), false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/admin/ingest/mcGov/importLog.test.ts`
Expected: FAIL — `Cannot find module './importLog.js'`

- [ ] **Step 3: Write the implementation**

Create `lib/admin/ingest/mcGov/importLog.ts`:

```typescript
import { existsSync, readFileSync, writeFileSync } from "node:fs";

export type ImportLogStatus =
  | "inserted"
  | "skipped_duplicate"
  | "skipped_low_score"
  | "skipped_not_festival_keyword"
  | "error";

export type ImportLogEntry = {
  status: ImportLogStatus;
  title?: string;
  ingest_job_id?: string;
  matched_id?: string;
  error?: string;
  processed_at: string;
};

export type ImportLog = {
  entries: Record<string, ImportLogEntry>;
};

export function readImportLog(logPath: string): ImportLog {
  if (!existsSync(logPath)) return { entries: {} };

  try {
    const raw = readFileSync(logPath, "utf-8");
    const parsed = JSON.parse(raw) as ImportLog;
    if (!parsed.entries || typeof parsed.entries !== "object") return { entries: {} };
    return parsed;
  } catch {
    return { entries: {} };
  }
}

export function writeImportLog(logPath: string, log: ImportLog): void {
  writeFileSync(logPath, JSON.stringify(log, null, 2), "utf-8");
}

export function hasImportLogEntry(log: ImportLog, sourceUrl: string): boolean {
  return Object.prototype.hasOwnProperty.call(log.entries, sourceUrl);
}

export function setImportLogEntry(log: ImportLog, sourceUrl: string, entry: ImportLogEntry): void {
  log.entries[sourceUrl] = entry;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/admin/ingest/mcGov/importLog.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/admin/ingest/mcGov/importLog.ts lib/admin/ingest/mcGov/importLog.test.ts
git commit -m "feat(ingest): add local progress log for mc.gov.bg imports"
```

---

### Task 6: AI prescreen

**Files:**
- Create: `lib/admin/ingest/mcGov/prescreen.ts`
- Test: `lib/admin/ingest/mcGov/prescreen.test.ts`

This task tests only the pure prompt-building and response-parsing functions. The network call
(`runPrescreen`) is exercised manually via `--dry-run` per the spec's testing section, not
mocked here.

- [ ] **Step 1: Write the failing test**

Create `lib/admin/ingest/mcGov/prescreen.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPrescreenPrompt, parsePrescreenResponse } from "./prescreen.js";
import type { McGovScrapedEvent } from "./parseListPage.js";

function makeEvent(overrides: Partial<McGovScrapedEvent> = {}): McGovScrapedEvent {
  return {
    postId: "1",
    title: "Фолклорен събор на етносите",
    startDate: "2026-07-12",
    endDate: "2026-07-12",
    locationName: "село Макреш",
    organizerName: "Народно читалище",
    sourceUrl: "https://mc.government.bg/?p=1",
    ...overrides,
  };
}

test("buildPrescreenPrompt includes all scraped fields", () => {
  const prompt = buildPrescreenPrompt(makeEvent());
  assert.match(prompt, /Фолклорен събор на етносите/);
  assert.match(prompt, /Народно читалище/);
  assert.match(prompt, /село Макреш/);
  assert.match(prompt, /2026-07-12/);
});

test("buildPrescreenPrompt handles missing organizer/location gracefully", () => {
  const prompt = buildPrescreenPrompt(makeEvent({ organizerName: null, locationName: null }));
  assert.doesNotMatch(prompt, /null/);
});

test("parsePrescreenResponse accepts a well-formed response", () => {
  const result = parsePrescreenResponse({ is_festival: true, score: 85, reason: "Многодневен фолклорен събор" });
  assert.deepEqual(result, { is_festival: true, score: 85, reason: "Многодневен фолклорен събор" });
});

test("parsePrescreenResponse clamps score to 0-100", () => {
  const result = parsePrescreenResponse({ is_festival: true, score: 140, reason: "" });
  assert.equal(result?.score, 100);
});

test("parsePrescreenResponse returns null when is_festival is missing", () => {
  const result = parsePrescreenResponse({ score: 85, reason: "x" });
  assert.equal(result, null);
});

test("parsePrescreenResponse returns null for non-object input", () => {
  assert.equal(parsePrescreenResponse(null), null);
  assert.equal(parsePrescreenResponse("not an object"), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/admin/ingest/mcGov/prescreen.test.ts`
Expected: FAIL — `Cannot find module './prescreen.js'`

- [ ] **Step 3: Write the implementation**

Create `lib/admin/ingest/mcGov/prescreen.ts`:

```typescript
import { geminiExtractJson, isGeminiConfigured } from "@/lib/admin/research/gemini-provider";
import type { McGovScrapedEvent } from "@/lib/admin/ingest/mcGov/parseListPage";

export type PrescreenResult = {
  is_festival: boolean;
  score: number;
  reason: string;
};

export const PRESCREEN_SCORE_THRESHOLD = 60;

export function buildPrescreenPrompt(event: McGovScrapedEvent): string {
  return [
    `Заглавие: "${event.title}"`,
    `Организатор: "${event.organizerName ?? "неизвестен"}"`,
    `Локация: "${event.locationName ?? "неизвестна"}"`,
    `Дата: ${event.startDate ?? "неизвестна"}`,
    "",
    "Това многодневно/традиционно културно събитие (фестивал, събор, панаир)",
    "подходящо за публичен фестивален каталог ли е, или е по-скоро формална",
    "общинска церемония (годишнина, награждаване, отбелязване)?",
    "",
    'Върни JSON: {"is_festival": bool, "score": 0-100, "reason": "кратко"}',
  ].join("\n");
}

export function parsePrescreenResponse(raw: unknown): PrescreenResult | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  if (typeof obj.is_festival !== "boolean") return null;
  if (typeof obj.score !== "number" || !Number.isFinite(obj.score)) return null;

  const score = Math.max(0, Math.min(100, Math.round(obj.score)));
  const reason = typeof obj.reason === "string" ? obj.reason : "";

  return { is_festival: obj.is_festival, score, reason };
}

export async function runPrescreen(event: McGovScrapedEvent): Promise<PrescreenResult | null> {
  if (!isGeminiConfigured()) throw new Error("GEMINI_API_KEY is not configured");

  const raw = await geminiExtractJson<unknown>({
    systemInstruction:
      "Ти си асистент, който помага на администратор на фестивален каталог да филтрира кои културни събития си струва да бъдат разгледани ръчно.",
    userText: buildPrescreenPrompt(event),
  });

  return parsePrescreenResponse(raw);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/admin/ingest/mcGov/prescreen.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/admin/ingest/mcGov/prescreen.ts lib/admin/ingest/mcGov/prescreen.test.ts
git commit -m "feat(ingest): add Gemini prescreen step for mc.gov.bg imports"
```

---

### Task 7: SmartResearchResult → ai_result mapper

**Files:**
- Create: `lib/admin/ingest/mcGov/buildAiResult.ts`
- Test: `lib/admin/ingest/mcGov/buildAiResult.test.ts`

This mirrors the mapping `components/admin/SmartResearchPanel.tsx` already applies (its
`sendToPipeline` function, around line 609) when an admin clicks "send to pipeline" after a
manual Smart Research run — reused here so the unattended script produces a `pending_festivals`
row through the exact same downstream path (`buildResearchPendingRowFromRequest`) as the
existing admin-triggered flow.

- [ ] **Step 1: Write the failing test**

Create `lib/admin/ingest/mcGov/buildAiResult.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAiResultFromSmartResearch } from "./buildAiResult.js";
import type { SmartResearchResult } from "@/lib/admin/research/smart-pipeline";

function makeSmartResult(overrides: Partial<SmartResearchResult["fields"]> = {}): SmartResearchResult {
  return {
    fields: {
      title: "Фолклорен събор на етносите",
      start_date: "2026-07-12",
      end_date: "2026-07-12",
      start_time: null,
      end_time: null,
      city: "Макреш",
      location_name: "Салона на читалището",
      address: null,
      organizer_name: "Народно читалище",
      organizer_names: ["Народно читалище"],
      description: "Тридневен фолклорен събор.",
      is_free: true,
      category: "folk",
      tags: ["фолклор"],
      website_url: null,
      facebook_url: "https://facebook.com/example",
      instagram_url: null,
      ticket_url: null,
      hero_image: null,
      hero_image_candidates: ["https://example.com/a.jpg", "https://example.com/b.jpg"],
      program_draft: null,
      ...overrides,
    },
    sources: [
      { url: "https://example.com/a", title: "A", domain: "example.com", snippet: null, is_ai_overview: false },
      { url: "https://example.com/overview", title: "AI Overview", domain: "google.com", snippet: null, is_ai_overview: true },
    ],
    confidence: "high",
    providers_used: ["serpapi"],
    warnings: [],
    gemini_model: "gemini-2.5-flash",
  };
}

test("maps fields straight through", () => {
  const result = buildAiResultFromSmartResearch(makeSmartResult());
  assert.equal(result.title, "Фолклорен събор на етносите");
  assert.equal(result.start_date, "2026-07-12");
  assert.equal(result.city, "Макреш");
  assert.equal(result.organizer_name, "Народно читалище");
  assert.equal(result.confidence, "high");
});

test("excludes AI-overview sources from source_urls", () => {
  const result = buildAiResultFromSmartResearch(makeSmartResult());
  assert.deepEqual(result.source_urls, ["https://example.com/a"]);
});

test("uses the first hero_image_candidate as hero when hero_image is null", () => {
  const result = buildAiResultFromSmartResearch(makeSmartResult({ hero_image: null }));
  assert.equal(result.hero_image, "https://example.com/a.jpg");
  assert.deepEqual(result.gallery_image_urls, ["https://example.com/b.jpg"]);
});

test("prefers an explicit hero_image over the candidates list", () => {
  const result = buildAiResultFromSmartResearch(
    makeSmartResult({ hero_image: "https://example.com/explicit.jpg" }),
  );
  assert.equal(result.hero_image, "https://example.com/explicit.jpg");
  assert.deepEqual(result.gallery_image_urls, ["https://example.com/a.jpg", "https://example.com/b.jpg"]);
});

test("missing_fields is always empty (no human review step here)", () => {
  const result = buildAiResultFromSmartResearch(makeSmartResult());
  assert.deepEqual(result.missing_fields, []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/admin/ingest/mcGov/buildAiResult.test.ts`
Expected: FAIL — `Cannot find module './buildAiResult.js'`

- [ ] **Step 3: Write the implementation**

Create `lib/admin/ingest/mcGov/buildAiResult.ts`:

```typescript
import type { SmartResearchResult } from "@/lib/admin/research/smart-pipeline";
import type { PerplexityFestivalResearchResult } from "@/lib/research/perplexity";

export type AiResultWithGallery = PerplexityFestivalResearchResult & {
  gallery_image_urls: string[];
};

/**
 * Maps a SmartResearchResult into the shape buildResearchPendingRowFromRequest
 * expects under `ai_result`, mirroring the mapping
 * components/admin/SmartResearchPanel.tsx applies in `sendToPipeline` when an
 * admin sends a manually-run Smart Research result to the pipeline. There is
 * no human picking a hero image in this unattended script, so the first
 * image candidate is used as the hero when no explicit hero_image was
 * extracted, and the rest become gallery_image_urls.
 */
export function buildAiResultFromSmartResearch(smart: SmartResearchResult): AiResultWithGallery {
  const { fields, sources, confidence } = smart;
  const heroImage = fields.hero_image ?? fields.hero_image_candidates[0] ?? null;
  const galleryImageUrls = fields.hero_image_candidates.filter((url) => url !== heroImage);

  return {
    title: fields.title,
    description: fields.description,
    category: fields.category,
    start_date: fields.start_date,
    end_date: fields.end_date,
    city: fields.city,
    location_name: fields.location_name,
    address: fields.address,
    organizer_name: fields.organizer_name,
    organizer_names: fields.organizer_names,
    website_url: fields.website_url,
    facebook_url: fields.facebook_url,
    instagram_url: fields.instagram_url,
    ticket_url: fields.ticket_url,
    hero_image: heroImage,
    is_free: fields.is_free,
    program_draft: fields.program_draft,
    source_urls: sources.filter((source) => !source.is_ai_overview).map((source) => source.url),
    confidence,
    missing_fields: [],
    gallery_image_urls: galleryImageUrls,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/admin/ingest/mcGov/buildAiResult.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/admin/ingest/mcGov/buildAiResult.ts lib/admin/ingest/mcGov/buildAiResult.test.ts
git commit -m "feat(ingest): map SmartResearchResult to research ai_result shape"
```

---

### Task 8: Page fetcher (network helper, not unit-tested)

**Files:**
- Create: `lib/admin/ingest/mcGov/fetchListPage.ts`

- [ ] **Step 1: Write the implementation**

Create `lib/admin/ingest/mcGov/fetchListPage.ts`:

```typescript
const BASE_PATH = "/вид-новина/събития-календар/";
const PAGE_QUERY_PARAM = "e-page-2f0f9c7";
const DELAY_BETWEEN_REQUESTS_MS = 400;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches one mc.gov.bg event-calendar list page. Page 1 has no query param;
 * page N>=2 uses ?e-page-2f0f9c7=N (confirmed against the live site during
 * planning — both forms return full server-rendered HTML, no JS execution
 * required). A fixed delay follows every request to avoid hammering the
 * government server.
 */
export async function fetchMcGovListPage(pageNumber: number): Promise<string> {
  const url = new URL(BASE_PATH, "https://mc.government.bg");
  if (pageNumber > 1) {
    url.searchParams.set(PAGE_QUERY_PARAM, String(pageNumber));
  }

  const response = await fetch(url.toString(), {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; FestivoIngestBot/1.0)" },
  });

  if (!response.ok) {
    throw new Error(`mc.gov.bg page fetch failed: ${response.status} ${url.toString()}`);
  }

  const html = await response.text();
  await delay(DELAY_BETWEEN_REQUESTS_MS);
  return html;
}
```

- [ ] **Step 2: Sanity-check it against the live site**

Run:
```bash
npx tsx -e "import('./lib/admin/ingest/mcGov/fetchListPage.ts').then(async (m) => { const html = await m.fetchMcGovListPage(1); console.log(html.length); })"
```
Expected: prints a number greater than 100000 (the page is large), no error.

- [ ] **Step 3: Commit**

```bash
git add lib/admin/ingest/mcGov/fetchListPage.ts
git commit -m "feat(ingest): add mc.gov.bg page fetcher"
```

---

### Task 9: CLI orchestration script

**Files:**
- Create: `scripts/mc-gov-import.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Add the progress log file to .gitignore**

Add this line under the existing "Claude Code local state" / scratch section of `.gitignore`:

```
scripts/.mc-gov-import-log.json
```

- [ ] **Step 2: Write the orchestration script**

Create `scripts/mc-gov-import.ts`:

```typescript
import path from "node:path";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { findDuplicateFestivals } from "@/lib/admin/research/findDuplicateFestivals";
import { runSmartResearchPipeline } from "@/lib/admin/research/smart-pipeline";
import { insertResearchIngestJob } from "@/lib/admin/ingest/insertResearchIngestJob";
import { fetchMcGovListPage } from "@/lib/admin/ingest/mcGov/fetchListPage";
import { parseMcGovListPage, type McGovScrapedEvent } from "@/lib/admin/ingest/mcGov/parseListPage";
import { matchesFestivalKeyword } from "@/lib/admin/ingest/mcGov/keywordFilter";
import { pickDuplicateWithDateGuard } from "@/lib/admin/ingest/mcGov/dedupDateGuard";
import {
  readImportLog,
  writeImportLog,
  hasImportLogEntry,
  setImportLogEntry,
} from "@/lib/admin/ingest/mcGov/importLog";
import { runPrescreen, PRESCREEN_SCORE_THRESHOLD } from "@/lib/admin/ingest/mcGov/prescreen";
import { buildAiResultFromSmartResearch } from "@/lib/admin/ingest/mcGov/buildAiResult";

const LOG_PATH = path.resolve(process.cwd(), "scripts/.mc-gov-import-log.json");

type CliArgs = { from: string; to: string; dryRun: boolean };

function parseArgs(argv: string[]): CliArgs {
  const parsed: Record<string, string | boolean> = {};
  for (const arg of argv) {
    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    const match = arg.match(/^--([a-z-]+)=(.+)$/);
    if (match) parsed[match[1]] = match[2];
  }

  const from = typeof parsed.from === "string" ? parsed.from : null;
  const to = typeof parsed.to === "string" ? parsed.to : null;
  if (!from || !to) {
    throw new Error("Usage: mc-gov-import.ts --from=YYYY-MM-DD --to=YYYY-MM-DD [--dry-run]");
  }

  return { from, to, dryRun: Boolean(parsed.dryRun) };
}

function nowIso(): string {
  return new Date().toISOString();
}

async function main(): Promise<void> {
  const { from, to, dryRun } = parseArgs(process.argv.slice(2));
  const log = readImportLog(LOG_PATH);
  const supabase = createSupabaseAdmin();

  const counts = {
    scraped: 0,
    inWindow: 0,
    keywordPass: 0,
    dedupPass: 0,
    prescreenPass: 0,
    inserted: 0,
    errors: 0,
  };

  let page = 1;
  while (true) {
    const html = await fetchMcGovListPage(page);
    const events = parseMcGovListPage(html);
    if (events.length === 0) break;
    counts.scraped += events.length;

    for (const event of events) {
      await processEvent(event, { from, to, dryRun, log, supabase, counts });
    }

    writeImportLog(LOG_PATH, log);
    page += 1;
  }

  writeImportLog(LOG_PATH, log);
  console.log("[mc-gov-import] summary:", counts);
}

async function processEvent(
  event: McGovScrapedEvent,
  ctx: {
    from: string;
    to: string;
    dryRun: boolean;
    log: ReturnType<typeof readImportLog>;
    supabase: ReturnType<typeof createSupabaseAdmin>;
    counts: Record<string, number>;
  },
): Promise<void> {
  const { from, to, dryRun, log, supabase, counts } = ctx;

  if (!event.startDate || event.startDate < from || event.startDate > to) return;
  counts.inWindow += 1;

  if (hasImportLogEntry(log, event.sourceUrl)) return;

  if (!matchesFestivalKeyword(event.title)) {
    setImportLogEntry(log, event.sourceUrl, {
      status: "skipped_not_festival_keyword",
      title: event.title,
      processed_at: nowIso(),
    });
    return;
  }
  counts.keywordPass += 1;

  try {
    const matches = await findDuplicateFestivals({ title: event.title, startDate: event.startDate });
    const duplicate = pickDuplicateWithDateGuard(matches, event.startDate);
    if (duplicate) {
      setImportLogEntry(log, event.sourceUrl, {
        status: "skipped_duplicate",
        title: event.title,
        matched_id: duplicate.id,
        processed_at: nowIso(),
      });
      return;
    }
    counts.dedupPass += 1;

    const prescreen = await runPrescreen(event);
    if (!prescreen || prescreen.score < PRESCREEN_SCORE_THRESHOLD) {
      setImportLogEntry(log, event.sourceUrl, {
        status: "skipped_low_score",
        title: event.title,
        processed_at: nowIso(),
      });
      return;
    }
    counts.prescreenPass += 1;

    if (dryRun) {
      console.log(`[dry-run] would enrich + insert: "${event.title}" (prescreen score ${prescreen.score})`);
      return;
    }

    const query = [event.title, event.locationName].filter(Boolean).join(" ");
    const smart = await runSmartResearchPipeline(query);
    const aiResult = buildAiResultFromSmartResearch(smart);
    const inserted = await insertResearchIngestJob(supabase, { ai_result: aiResult });

    if (!inserted.ok) {
      setImportLogEntry(log, event.sourceUrl, {
        status: "error",
        title: event.title,
        error: inserted.error,
        processed_at: nowIso(),
      });
      counts.errors += 1;
      return;
    }

    setImportLogEntry(log, event.sourceUrl, {
      status: "inserted",
      title: event.title,
      ingest_job_id: inserted.jobId,
      processed_at: nowIso(),
    });
    counts.inserted += 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setImportLogEntry(log, event.sourceUrl, { status: "error", title: event.title, error: message, processed_at: nowIso() });
    counts.errors += 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 3: Commit**

```bash
git add scripts/mc-gov-import.ts .gitignore
git commit -m "feat(ingest): add mc.gov.bg import CLI orchestration script"
```

---

### Task 10: Manual dry-run verification

**Files:** none (manual verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run lib/admin/ingest/mcGov`
Expected: PASS — all tests from Tasks 2–7 (23 tests total).

- [ ] **Step 2: Run a dry-run against the live site for a near-term window**

Run (replace dates with the actual current date and +14 days at execution time):
```bash
npx tsx scripts/mc-gov-import.ts --from=2026-06-23 --to=2026-07-07 --dry-run
```

Expected: the script walks pages, prints `[dry-run] would enrich + insert: ...` lines for
events that pass the keyword filter, dedup guard, and AI prescreen, and ends with a `summary:`
line showing non-zero `scraped`/`inWindow` counts. No rows are inserted (`dryRun` short-circuits
before `runSmartResearchPipeline`/`insertResearchIngestJob`) and `GEMINI_API_KEY` /
`SERPAPI_KEY` are not required to reach this point since the prescreen step does need
`GEMINI_API_KEY` — confirm it is set in `.env.local` before running, per the design doc's
"Error handling" section (`isGeminiConfigured()` throws otherwise, which is caught and logged
per-event as `status: "error"` rather than crashing the whole run).

- [ ] **Step 3: Inspect the resulting progress log**

Run: `cat scripts/.mc-gov-import-log.json`
Expected: one entry per event encountered in the window, with `status` values matching what was
printed to the console (`skipped_not_festival_keyword`, `skipped_duplicate`,
`skipped_low_score`, or — since this was a dry run — no `inserted` entries yet, since dry-run
returns before reaching the insert step and does not log an entry for prescreen-passing events
at all in this version; re-running without `--dry-run` will process those remaining events).

- [ ] **Step 4: Run a real (non-dry-run) import for the same window and confirm in the admin panel**

Run:
```bash
npx tsx scripts/mc-gov-import.ts --from=2026-06-23 --to=2026-07-07
```

Then open `/admin/pending-festivals` in the running app and confirm the newly inserted rows
appear with `needs_review` status, populated fields (title, dates, location, hero image where
available), and that the count is small (tens, not hundreds) per the spec's goal.

- [ ] **Step 5: Commit nothing further**

This task is verification-only; no code changes are committed here unless Step 2 or Step 4
surfaces a bug, in which case fix it in the relevant Task's file and commit with a `fix(ingest):
...` message before re-running.
