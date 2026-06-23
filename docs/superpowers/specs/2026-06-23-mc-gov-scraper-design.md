# mc.gov.bg event scraper → ingest pipeline

**Date:** 2026-06-23
**Status:** Approved

## Problem

`mc.government.bg/вид-новина/събития-календар/` lists a large static archive of cultural
events for the year (~388 paginated list pages, several thousand entries). Most entries are
not relevant to Festivo (anniversaries, exhibitions, readings, formal municipal ceremonies).
A naive bulk import of everything would dump 1000+ unreviewed rows into `pending_festivals`,
which is unworkable for manual admin review.

The calendar is **static for the year** — it is not actively appended to with new entries —
so this is not a recurring-ingest problem in the traditional sense. The right cadence is a
**manually re-run rolling 2-week window**: run the script now for the next 14 days, run it
again in ~2 weeks for the following 14 days, and so on, until the year's archive is
exhausted.

## Goals

- Import only events within an admin-supplied date window (`--from` / `--to`), nominally ~2
  weeks at a time.
- Aggressively filter out non-festival content before it reaches `pending_festivals`, so each
  run produces a small, reviewable batch (target: tens, not hundreds).
- Never create a duplicate `ingest_job` / `pending_festivals` row for an event already
  published, already pending, or already processed by a previous run of this script.
- Reuse the existing research/enrichment pipeline (`lib/admin/research/`) rather than
  building a parallel one.

## Non-goals

- No new admin UI. This is an operator-run CLI script.
- No automatic cron/recurring schedule. The user manually re-runs the script with a new
  window each time.
- No changes to `pending_festivals` schema or the admin review UI.

## Architecture

```
scripts/mc-gov-import.ts  (run manually: npx tsx scripts/mc-gov-import.ts --from=YYYY-MM-DD --to=YYYY-MM-DD [--dry-run])
        │
        ├─ 1. SCRAPE: walk all mc.gov.bg list pages, parse title / start_date / end_date /
        │      location_name / organizer_name / source_url per event card
        │
        ├─ 2. WINDOW FILTER: keep only events whose start_date falls within [--from, --to]
        │
        ├─ 3. KEYWORD FILTER (wide): title must contain at least one of:
        │      фестивал, фест, събор, панаир, карнавал, надпяване, надсвирване,
        │      надиграване, концерт, празник
        │
        ├─ 4. PROGRESS LOG CHECK: skip source_url already present in
        │      scripts/.mc-gov-import-log.json from a prior run
        │
        ├─ 5. DEDUP CHECK: findDuplicateFestivals({ title, startDate }) against
        │      `festivals` + `pending_festivals`
        │      → treat as duplicate only if score ≥ 0.34 AND start_date matches exactly
        │        or is within ±2 days (see "Dedup date guard" below)
        │      → match found: log "skipped_duplicate", stop processing this event
        │
        ├─ 6. AI PRESCREEN: single cheap Gemini call per event, using only scraped fields
        │      (no web search) → { is_festival: bool, score: 0-100, reason }
        │      → score < 60: log "skipped_low_score", stop processing this event
        │
        ├─ 7. FULL ENRICH: runSmartResearchPipeline() — web search + image search +
        │      multi-source Gemini extraction, same code path as admin-triggered research
        │
        ├─ 8. BUILD PENDING ROW: buildResearchPendingRowFromRequest() — geocoding, hero
        │      image rehost, slug resolution, quality pipeline (same as existing research
        │      ingest flow)
        │
        ├─ 9. INSERT: ingest_jobs row with source_type="research", payload_json.pending_row
        │      set, via createSupabaseAdmin() (direct DB access, no HTTP round-trip)
        │
        └─ 10. APPEND result to scripts/.mc-gov-import-log.json (inserted / skipped_* / error)
```

### Why a two-stage filter (keyword → AI prescreen → full enrich)

Running the full `runSmartResearchPipeline()` (web search + image search + Gemini) for
every event that merely matches a keyword would be expensive and slow — a wide keyword
filter alone is expected to pass several hundred events per 2-week window. Instead:

1. The keyword filter is free (string matching) and removes the bulk of irrelevant content.
2. The AI prescreen is a single cheap Gemini call with no web search, and removes most of
   the remaining noise (formal ceremonies, anniversaries that happen to contain "празник").
3. Only the events that survive both filters — expected to be tens, not hundreds — go
   through the expensive full enrichment pipeline.

This reuses 100% of the existing research infrastructure for the expensive step; the new
code is the scraper, the two cheap filters, and the orchestration script.

### Dedup date guard

`findDuplicateFestivals` (`lib/admin/research/findDuplicateFestivals.ts`) scores title
similarity via Jaccard overlap of significant words (stopwords removed, words <3 chars
dropped) with `MIN_SCORE = 0.34`, and separately flags `same_year`. This is tuned for the
admin's interactive duplicate-review panel, where a human looks at every flagged match.

For this script, `same_year` alone is too weak a guard: village fairs and church-feast
events on mc.gov.bg frequently share a generic template ("Събор на риба" / "Тържество на
читалище") where 2-3 shared template words across two *different* villages can cross the
0.34 threshold in the same calendar year. Since these events are tied to a fixed calendar
date (a saint's day, a local tradition) rather than a recurring annual edition, exact date
match is a much stronger and simpler disambiguator than fuzzy title score + year. The
script therefore additionally requires the matched candidate's `start_date` to be equal to
or within ±2 days of the scraped event's `start_date` before treating it as a real
duplicate. A title score ≥ 0.34 with a `start_date` more than 2 days apart is not treated as
a duplicate.

## Components

| File | Purpose |
|---|---|
| `scripts/mc-gov-import.ts` | Entry point, CLI arg parsing, orchestration |
| `scripts/lib/mcGovScraper.ts` | Pagination walk + HTML parsing for mc.gov.bg list pages |
| `scripts/lib/mcGovKeywordFilter.ts` | Wide keyword match against title |
| `scripts/lib/mcGovPrescreen.ts` | Cheap Gemini prescreen call + response parsing |
| `scripts/lib/mcGovImportLog.ts` | Read/write `scripts/.mc-gov-import-log.json` |
| `scripts/.mc-gov-import-log.json` | Local, git-ignored progress state |

Reused without modification:
- `lib/admin/research/findDuplicateFestivals.ts` (with the additional date-guard check
  applied in the orchestration script, not inside the shared function — it is also used by
  the interactive admin panel, which should keep its existing behavior)
- `lib/admin/research/smart-pipeline.ts` (`runSmartResearchPipeline`)
- `lib/admin/ingest/researchPendingRowFromRequest.ts` (`buildResearchPendingRowFromRequest`)
- `lib/supabaseAdmin.ts` (`createSupabaseAdmin`)

## CLI

```bash
npx tsx scripts/mc-gov-import.ts --from=2026-06-23 --to=2026-07-07
npx tsx scripts/mc-gov-import.ts --from=2026-06-23 --to=2026-07-07 --dry-run
```

`--dry-run` runs the pipeline through step 6 (AI prescreen) and prints what *would* happen,
without running the expensive full enrichment (step 7) or inserting anything (step 9) — used
to sanity-check filters and estimate batch size before spending on enrichment.

## Progress log format

`scripts/.mc-gov-import-log.json` (git-ignored):

```json
{
  "entries": {
    "https://mc.government.bg/.../event-123": {
      "status": "inserted",
      "title": "Фолклорен събор на етносите...",
      "ingest_job_id": "uuid",
      "processed_at": "2026-06-23T10:00:00Z"
    },
    "https://mc.government.bg/.../event-456": {
      "status": "skipped_duplicate",
      "matched_id": "uuid",
      "processed_at": "2026-06-23T10:00:05Z"
    }
  }
}
```

Status values: `inserted` / `skipped_duplicate` / `skipped_low_score` /
`skipped_not_festival_keyword` / `error`.

## AI prescreen prompt (step 6)

Single Gemini call per event, input is the scraped fields only (no web fetch):

```
Заглавие: "{title}"
Организатор: "{organizer_name}"
Локация: "{location_name}"
Дата: {start_date}

Това многодневно/традиционно културно събитие (фестивал, събор, панаир) подходящо за
публичен фестивален каталог ли е, или е по-скоро формална общинска церемония (годишнина,
награждаване, отбелязване)?

Върни JSON: {"is_festival": bool, "score": 0-100, "reason": "кратко"}
```

Threshold: `score >= 60` proceeds to full enrichment.

## Error handling

- Small delay (~300-500ms) between mc.gov.bg page fetches to avoid hammering the server.
- A failed fetch of one list page is logged and skipped; the run continues with remaining
  pages.
- A failure in `runSmartResearchPipeline` or the insert step for one event is logged as
  `error` in the progress log; the run continues with the next event.
- End-of-run summary printed to console: total scraped, kept after window filter, kept after
  keyword filter, kept after dedup, kept after prescreen, inserted, errored.

## Testing

- Unit test for the mc.gov.bg HTML parser against a saved fixture page (title / dates /
  location / organizer / source_url extraction).
- Unit test for the keyword filter (pass/fail list of sample titles, including the
  `празник` keyword).
- Unit test for the dedup date guard using the "Събор на Краводер" / "Събор на Пудрия"
  case discussed during design: same template words, different villages, different dates →
  must NOT be flagged as duplicate.
- Full pipeline is validated manually via `--dry-run` against the live site before any real
  run that inserts data.

## Open items for the implementation plan

- Exact HTML structure / CSS selectors for mc.gov.bg list pages (to be confirmed against the
  live page during implementation — the design assumes a list of event cards with title,
  date range, location, and organizer text, consistent with the screenshots reviewed during
  brainstorming).
- Whether mc.gov.bg's calendar exposes a server-side date-range query parameter (would avoid
  walking all pages every run); if not found, the script walks all pages and applies the
  window filter client-side.
