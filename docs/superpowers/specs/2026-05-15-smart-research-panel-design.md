# Smart Research Panel — Design Spec

**Date:** 2026-05-15
**Status:** Approved

---

## Goal

Replace the three fragmented research modes (web search, Gemini pipeline, Perplexity direct) with a single unified "Smart Research" tab on `/admin/research`. One input, one button, best possible result — automatically combining Google Search, Google AI Overview, Perplexity, and Gemini extraction.

---

## Architecture

### Pipeline (backend)

```
POST /admin/api/research-smart { query: string }

Step 1 — Parallel search:
  A. SerpAPI (hl=en, gl=bg) → ai_overview text (if Google generated one)
  B. SerpAPI (hl=bg, gl=bg) → organic_results (url, title, snippet)

Step 2 — Quality check:
  If fewer than 3 results with .bg domain AND no ai_overview present:
    → Perplexity call for additional context

Step 3 — Gemini extraction:
  Input: ai_overview text + organic snippets + Perplexity context (if used)
  Output: all structured fields (see below)

Step 4 — Return:
  { fields, sources[], confidence, warnings[] }
```

### Quality check logic

| Condition | Action |
|---|---|
| `ai_overview` present | Skip Perplexity, go straight to Gemini |
| 3+ `.bg` domain results | Skip Perplexity, go straight to Gemini |
| < 3 `.bg` results AND no `ai_overview` | Run Perplexity, combine with SerpAPI results |
| All providers fail | Return low-confidence empty result |

---

## Extracted Fields

All fields match the `pending_festivals` schema and the existing `GeminiRawExtraction` type.

| Field | Type | Notes |
|---|---|---|
| `title` | string | Festival name in Bulgarian |
| `start_date` | string | YYYY-MM-DD |
| `end_date` | string | YYYY-MM-DD |
| `start_time` | string | HH:MM, Europe/Sofia |
| `end_time` | string | HH:MM, Europe/Sofia |
| `city` | string | City name |
| `location_name` | string | Venue name |
| `address` | string | Street address |
| `organizer_name` | string | Primary organizer |
| `organizer_names` | string[] | All organizers |
| `description` | string | Full description |
| `is_free` | boolean | Free entry |
| `category` | string | Event category |
| `tags` | string[] | Up to 12 tags |
| `website_url` | string | Official website |
| `facebook_url` | string | Facebook event/page |
| `instagram_url` | string | Instagram |
| `ticket_url` | string | Tickets link |
| `hero_image` | string | Cover image URL |
| `program_draft` | ProgramDraft | Schedule by day (if found) |

---

## API Response Shape

```typescript
{
  ok: true,
  result: {
    fields: SmartResearchFields,       // all extracted fields above
    sources: SmartResearchSource[],    // URLs used
    confidence: "high" | "medium" | "low",
    providers_used: string[],          // e.g. ["serpapi", "perplexity", "gemini"]
    warnings: string[],
  }
}
```

```typescript
type SmartResearchSource = {
  url: string;
  title: string | null;
  domain: string;
  snippet: string | null;
  is_ai_overview: boolean;            // true if from Google AI Overview
};
```

---

## Files to Create

### Backend

| File | Purpose |
|---|---|
| `app/admin/api/research-smart/route.ts` | POST handler — auth, validation, calls pipeline |
| `lib/admin/research/smart-pipeline.ts` | Core pipeline logic (search → quality check → extract) |

### Frontend

| File | Purpose |
|---|---|
| `components/admin/SmartResearchPanel.tsx` | New unified search + result component |

### Modified

| File | Change |
|---|---|
| `app/admin/(protected)/research/page.tsx` | Add tabs: "Умно търсене" (new, default) + "Класическо" |

---

## UI — SmartResearchPanel

### Search bar
- Single text input: placeholder `"Въведи фестивал + година"`
- Single button: `"Изследвай"` — dark/primary style
- Enter key triggers search

### Loading state
- Spinner with step label: `"Търся в Google..."` → `"Анализирам..."` → `"Структурирам..."`

### Result card (shown after success)
```
┌─────────────────────────────────────────────────┐
│  Между три планини                               │
│  ─────────────────────────────────────────────  │
│  📅 16 – 17 май 2026                            │
│  📍 Разлог · Централен площад "Преображение"    │
│  👤 Община Разлог, НЧ "15 февруари 1903"        │
│  🏷 фолклор · народна музика · събор            │
│  🔗 razlog.bg  facebook.com/...                 │
│                                                  │
│  Описание:                                       │
│  Традиционен фолклорен събор...                 │
│                                                  │
│  Източници:                                      │
│  · razlog.bg/novini/...            [AI Overview] │
│  · tourism-razlog.com/...                        │
└─────────────────────────────────────────────────┘
              [Изпрати в pipeline →]
```

### Field display rules
- Null/empty fields are hidden (not shown as "—")
- `is_ai_overview: true` sources get a badge `[AI Overview]`
- Confidence shown as a small chip: `● висока` / `● средна` / `● ниска`
- If confidence is low: show warning banner with reason

### "Изпрати в pipeline" button
- Creates `ingest_job` with `source_type=research`, `payload_json.pending_row` pre-filled
- Same handoff as existing `pendingCreateHandoff.ts`
- Navigates to `/admin/pending-festivals/[new-id]` on success

---

## Tabs on `/admin/research`

```
[ ✨ Умно търсене ]  [ Класическо ]
```

- "Умно търсене" is the default active tab
- "Класическо" renders the existing `ResearchFestivalPanel` unchanged
- Tab state lives in URL query param `?tab=smart` / `?tab=classic` for shareability

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| `SERPAPI_KEY` missing | Return 503 with message |
| SerpAPI returns 0 results | Perplexity fallback runs |
| Perplexity also fails | Gemini runs on empty context, returns low confidence |
| `GEMINI_API_KEY` missing | Return 503 with message |
| All providers fail | Return 200 with low-confidence empty result + warning |

---

## Security

- Endpoint requires admin role (via `getAdminContext`)
- All provider API keys are server-side only
- No client-side exposure of keys or raw provider responses

---

## Out of Scope

- Editing individual fields in the Smart panel (handled after pipeline handoff, in existing pending-festival review page)
- Streaming/progressive results
- Saving search history
- Multiple result candidates UI
