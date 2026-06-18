# Poster Bot: Enrich Existing Festival

**Date:** 2026-06-19
**Status:** Approved

## Overview

When the Telegram poster bot detects a duplicate festival, the operator can choose to enrich the existing festival (pending or published) with data extracted from the poster, instead of only creating a new entry. All enrichment is fill-null-only and additive — never overwrites existing values.

---

## Flow

```
User sends poster photo
  → vision extraction (existing)
  → duplicate detected
  → bot shows: [✅ Създай нов] [🔄 Обогати] [❌ Откажи]
  → user clicks "Обогати"
       ↓
  target = pending_festival?
    → fill-null-only UPDATE directly on the pending row
    → admin sees enriched version in normal review (no new UI needed)

  target = published festival?
    → INSERT into festival_enrichment_proposals (only the diff/patch)
    → admin reviews at /admin/enrichment-proposals/[id]
    → approve → patch applied to festivals row
    → reject → proposal marked rejected, no changes
```

---

## Enrichable Fields

Fill-null-only on the target record. Only fields where the target has `NULL` or empty string are candidates.

| Field | Source in PosterExtraction |
|---|---|
| `description` | `extraction.description.value` |
| `program_draft` | `extraction.program` |
| `facebook_url` | `extraction.facebook_url.value` |
| `website_url` | `extraction.website_url.value` |
| `instagram_url` | `extraction.instagram_url.value` |
| `ticket_url` | `extraction.ticket_url.value` |
| `location_name` | `extraction.venue_name.value` |
| `address` | `extraction.address.value` |
| `is_free` | `extraction.is_free.value` |
| `category` | `extraction.category.value` |

**Never touched:** `title`, `start_date`, `end_date`, `occurrence_dates`, `status`, `is_verified`.

---

## Data Model

### New table: `festival_enrichment_proposals`

```sql
CREATE TABLE festival_enrichment_proposals (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status               text NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'approved', 'rejected')),
  target_festival_id   bigint REFERENCES festivals(id),
  patch_json           jsonb NOT NULL,
  poster_ingest_job_id bigint REFERENCES poster_ingest_jobs(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  reviewed_at          timestamptz,
  reviewed_by          uuid REFERENCES auth.users(id)
);

CREATE INDEX ON festival_enrichment_proposals (status);
CREATE INDEX ON festival_enrichment_proposals (target_festival_id);
```

`patch_json` contains only the fields that will be filled — keys are column names, values are the new values. Example:
```json
{ "description": "Три дни народна музика...", "facebook_url": "https://facebook.com/events/123" }
```

**RLS:** service-role only. No public or user-authenticated access.

### No new table for `pending_festival` target

For pending targets, the patch is applied directly via `UPDATE ... WHERE id = X AND <field> IS NULL` — no proposal table needed. The admin sees the enriched draft in the normal pending review flow.

---

## Telegram Bot Changes

### Duplicate keyboard

New third button alongside the existing two:

```
[✅ Създай нов]  [🔄 Обогати]  [❌ Откажи]
```

`callback_data` format: `dup:{jobId}:enrich`

The top-scoring duplicate (highest score, same year) is the enrichment target. If multiple duplicates exist, only the top one is enrichable from the keyboard; the others remain informational.

### "Обогати" decision handler

1. Load `extraction_json` from `poster_ingest_jobs` (already stored at duplicate-detection time).
2. Load target festival's current field values from DB.
3. Compute `patch` = fill-null-only diff (only fields that are NULL/empty on the target AND non-null in extraction).
4. If patch is empty → reply: `"Няма какво да се добави — фестивалът вече има всички полета."` → done.
5. If target is `pending_festival`:
   - `UPDATE pending_festivals SET <fields> WHERE id = X AND <field> IS NULL` for each patched field.
   - Reply: `"✅ Черновата е обогатена:\n+ description\n+ facebook_url\nАдмин ще я прегледа при нормален review."`
6. If target is `festivals` (published):
   - `INSERT INTO festival_enrichment_proposals (target_festival_id, patch_json, poster_ingest_job_id)`.
   - Reply: `"✅ Предложено обогатяване на: {title}\n+ description\n+ facebook_url\nИзпратено за одобрение."`

Bot message always lists which fields are proposed, e.g.:
```
🔄 Предложено обогатяване на: Родопски фолклорен фест 2026
   + description
   + facebook_url
```

### `poster_ingest_jobs` — no schema change needed

The `dup_matches` column already stores the top duplicate(s) including `type` ("pending" | "published") and `id`. The handler reads these to determine `target_type` and `target_id`.

---

## Admin UI

### `/admin/enrichment-proposals`

List page showing all proposals with `status = 'pending'` (and optionally approved/rejected with filter). Columns: festival name, fields to enrich, created_at, status.

### `/admin/enrichment-proposals/[id]`

Detail/review page. Shows:

- Festival title + link to the published festival
- For each field in `patch_json`: field label + proposed value on a green background with a `📷 від плакат` badge
- No "before" value shown (the field is empty on the festival — that's the whole point)
- **[✅ Одобри всички]** — applies the patch fill-null-only (re-checks nullity at apply time in case a concurrent edit happened), marks proposal `approved`
- **[❌ Откажи]** — marks proposal `rejected`, no changes to festival

### `/admin/pending-festivals/[id]` — enriched fields badge

When a pending festival row has fields that came from a poster enrichment, those fields are visually distinguished with a `📷 від плакат` badge and green background. Implementation: store which fields were added by enrichment in a `enrichment_source_fields` jsonb column on `pending_festivals`, or derive it from `poster_ingest_jobs.extraction_json` diff at render time.

**Simpler option (recommended):** add `enriched_fields` jsonb to `pending_festivals` (array of field names). Set it during the enrich UPDATE. The review page uses it to render the badge. No complex diff logic needed at render time.

---

## Error Handling

- If target festival is deleted between enrich-click and apply → proposal apply skips silently, admin sees error in UI.
- If patch becomes empty at apply time (field was filled by someone else) → skip that field, still mark approved.
- Vision extraction errors already handled by existing pipeline; enrichment is only triggered after a successful extraction.

---

## Out of Scope

- Enriching a field-by-field (partial approve) — all or nothing for MVP.
- Enriching from a non-poster source.
- Auto-enrichment without operator confirmation.
- Multiple enrichment proposals for the same festival (allowed in DB, last-approved wins at apply time).
