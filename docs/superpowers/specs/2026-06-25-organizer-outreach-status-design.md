# Organizer outreach status on /admin/organizers — design

## Problem

The admin organizers list (`/admin/organizers`) has no way to tell which organizers have already received an outreach email and which haven't. Outreach is sent per-organizer from a modal on the organizer edit page (`OrganizerOutreachModal` → `POST /admin/api/organizer-outreach`), which enqueues an `email_jobs` row of type `organizer-outreach` with `dedupe_key = organizer-outreach:{organizerId}:{email}:{date}`. There's no aggregate view, so the admin has no way to know who's left to contact without opening every organizer individually.

## Goal

Add a "Кореспонденция" (correspondence) column + filter to the organizers list so the admin can see, at a glance, which organizers have never been emailed.

**Out of scope:** sending email from the list view, bulk send, any new database table/column, any new API route. This is a read-only status surface built entirely from data the outreach feature already writes.

## Data model (no migration)

Status is derived, not stored. For each active organizer:

- **Без имейл** — `organizers.email` is null/empty.
- **Не писан** — has an email, but no `email_jobs` row of `type = 'organizer-outreach'` whose `dedupe_key` starts with `organizer-outreach:{organizerId}:`.
- **Писан · {date}** — has at least one such row. Date shown is the most recent `created_at` among matches (an email attempt counts as "contacted" regardless of delivery outcome — bounce/suppressed detail stays on the per-organizer history view, unchanged).

### Fetching outreach status

In `app/admin/(protected)/organizers/page.tsx`, alongside the existing organizers query, fetch all `organizer-outreach` email_jobs rows (`select dedupe_key, created_at`, paginated in batches of 1000 via `.range()` until exhausted — avoids silently missing rows if volume grows past one page). Parse the organizer id out of `dedupe_key` (split on `:`, second segment) and reduce into `Map<organizerId, mostRecentCreatedAt>`.

This mirrors the existing pattern in the file for `organizer_members` counts — fetched once, joined in JS.

## UI changes

### New column: "Кореспонденция"

Placed between "Тип" and "Фестивали". Badge styles, reusing the existing `ORIGIN_BADGE`-style lookup table:

| State | Label | Color |
|---|---|---|
| Contacted | `Писан · {d MMM}` (bg-BG, Europe/Sofia) | emerald, like existing "Портал" badge |
| Not contacted (has email) | `Не писан` | amber, like existing "Чакащ" badge |
| No email | `Без имейл` | neutral/black-ish, like existing "Виртуален" badge |

### New filter: "Кореспонденция"

A second `<select name="outreach">` next to the existing "Тип" select, in the same `<form method="get">`. Options: Всички (default) / Неписани / Писани / Без имейл. Submits as a normal GET param, same pattern as `type`.

### Filtering + pagination interaction

The page already has a "derived filter forces full-fetch-then-paginate-in-JS" path for the `type` filter (see existing comment at line ~61-66 in the current file). Extend the same `hasTypeFilter`-style flag to also trigger on the outreach filter: if **either** `type` or `outreach` filter is active, fetch the full matching organizer set (no `.range()` on the main query), classify both origin and outreach status in JS, filter by whichever filters are active, then slice for pagination. With no derived filter active, keep the efficient DB-side `.range()` pagination as today.

The outreach-status Map itself is always fetched in full (it's small — one row per outreach attempt ever sent, not per organizer) regardless of which page/filter is active, since it's needed to compute the badge for whatever rows end up rendered.

### Query changes

Add `email` to the existing `organizers` select so "Без имейл" can be computed without an extra round-trip.

## Non-goals / explicitly excluded

- No send/bulk-send action from the list view — admin still opens an organizer and uses the existing modal.
- No new table, column, index, or RLS change. Pure read composition of existing `email_jobs` data.
- No change to the per-organizer outreach history UI (`OrganizerOutreachModal`, `GET /admin/api/organizer-outreach`) — that stays as the source of delivery-event detail (bounced/suppressed/delivered).
- No change to email sending behavior, dedupe logic, or the outreach email template itself.

## Risks / edge cases

- An organizer with **no slug** can still receive outreach (the modal just won't have festival links to include) — status logic doesn't care about slug, only about `email_jobs` history.
- If an organizer's email changes after being contacted, the "Писан" status still shows correctly (it's keyed by organizer id in the dedupe_key, not by current email value) — but a fresh outreach to the *new* email address would dedupe separately per day, which is existing behavior, unchanged here.
- Batch-fetching `email_jobs` in pages of 1000: if the outreach campaign sends to thousands of organizers over time this could mean multiple round trips on every page load of the admin list. Acceptable for now (admin-only, low traffic); revisit with an index or a materialized "last contacted" column if it becomes slow.
