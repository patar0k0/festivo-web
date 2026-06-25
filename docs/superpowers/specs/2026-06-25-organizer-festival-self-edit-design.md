# Organizer self-edit on published festivals

## Problem

Festivo is moderation-first: every new festival goes through `pending_festivals` → admin review → `festivals`. There is currently zero organizer-write path to an already-published `festivals` row. This causes real friction: organizers who want to fix or update their own festival have no way to do it themselves, and at least one organizer responded by submitting a brand-new duplicate festival instead of asking an admin to edit the existing one (root cause of a live duplicate-merge incident this session, PR #661).

The owner of the organizer relationship already has full knowledge of their event's current state — dates, schedule changes, venue, etc. — better than an admin reviewing secondhand. Pre-approval for every such edit adds friction without adding safety, since these are established, already-verified organizers, not new untrusted submitters.

## Decision

Verified organizer-portal owners (active membership on the organizer that owns the festival) can directly `PATCH` their own already-published festival (`status` = `verified`/`published`), bypassing `pending_festivals`. Two safety nets replace pre-moderation:

1. Every organizer edit is logged to `admin_audit_logs` with a full diff.
2. A new `festivals.last_edited_by_organizer_at` column lets the admin festival list flag edited records for post-hoc spot-checking.

Follower/update notifications (`scheduleFestivalUpdateNotifications`) are explicitly **not** triggered from this path — deliberately out of scope for this iteration.

## Scope: editable fields

Reuses `FESTIVAL_PATCH_ALLOWED_KEYS` (`lib/admin/patchAllowedKeys.ts`) minus admin-only/ownership/monetization fields. New constant `ORGANIZER_FESTIVAL_PATCH_ALLOWED_KEYS`:

```ts
export const ORGANIZER_FESTIVAL_PATCH_ALLOWED_KEYS = [
  "title", "description", "description_short", "category", "tags",
  "city_id", "city_name_display", "city",
  "venue_name", "location_name", "address",
  "latitude", "lat", "longitude", "lng", "coords_override", "place_id",
  "start_date", "end_date", "start_time", "end_time", "occurrence_dates",
  "hero_image", "image_url", "website_url", "ticket_url", "price_range", "is_free",
] as const;
```

**Excluded (admin-only):** `slug` (breaks SEO URLs), `status`, `is_verified`, `organizer_id`/`organizer_ids`/`organizer_name`/`organizer_entries` (ownership), `promotion_status`/`promotion_started_at`/`promotion_expires_at`/`promotion_rank` (monetization), `source_url`/`source_type` (system bookkeeping).

Gallery images, video link, and program/schedule are handled by separate sub-resource endpoints (see below), not by the main field allowlist.

## Auth gate

Shared helper, reused by every new route below:

1. `getPortalSessionUser()` → 401 if no session.
2. Resolve `festivals.organizer_id` (fallback to `festival_organizers` join, same pattern as `app/admin/api/festivals/[id]/media/route.ts`).
3. `hasActiveOrganizerMembership(admin, userId, organizerId)` → 403 if not an active member.
4. `festivals.status` must be `verified`/`published` → 403 otherwise ("Можете да редактирате само одобрени фестивали.").

## API routes

New tree under `app/api/organizer/festivals/[id]/`, mirroring the naming convention of `app/admin/api/festivals/[id]/`:

| Route | Method | Purpose |
|---|---|---|
| `route.ts` | `PATCH` | Core fields (title, dates, location, etc.) |
| `media/route.ts` | `GET`, `POST` | Gallery list + add (rehost URL or multipart upload) |
| `media/[mediaId]/route.ts` | `DELETE` | Remove a gallery image |
| `media/video/route.ts` | `PUT` | Video link |
| `hero-image/route.ts` | `PUT` | Hero image |
| `schedule/route.ts` | `PUT`/`POST` | Program days + items |

Deliberately **not** mirrored: `archive`, `cancel`, `uncancel`, `bulk`, `facebook-post`, `merge` — all admin-only lifecycle/ownership actions.

### Reused logic (no changes needed)

- `resolveOrCreateCityReference` / `normalizeSettlementInput` — city resolution
- `rehostHeroImageIfRemote` — hero/gallery image rehosting
- `fetchOrganizerPlanRow`, `resolveAllowedMediaLimitsFromOrganizerPlan`, `getMediaLimitExceededErrorMessage` — same plan-based gallery/video limits already enforced for admin and organizer-portal submissions
- `parseProgramDraftUnknown` / `programDraftToPublishPayload` — schedule validation
- `canonicalPatchFromUnknown` / `festivalPatchFromCanonicalPartial` — field mapping, restricted to the new allowlist
- `validateNoUnknownKeys` — strict body validation against `ORGANIZER_FESTIVAL_PATCH_ALLOWED_KEYS`
- `getPortalAdminClient()` — service-role client for the actual writes (organizer routes never use a user-scoped client for the mutation itself, since RLS is not designed for this access pattern)

### UI

New page `/organizer/festivals/[id]/edit`, modeled on the existing `NewFestivalSubmissionClient` (same form components/UX as the "submit new festival" flow). Reached via an "Редактирай" action added to the existing "Вече публикувани фестивали" read-only list on `/organizer/dashboard` (shipped in PR #661).

## Audit logging

Every successful organizer edit calls the existing `logAdminAction()` (`lib/admin/audit-log.ts` — generic despite the admin-sounding name/path) with a per-route action name:

```ts
await logAdminAction({
  actor_user_id: session.user.id,
  action: "festival.organizer_edited", // or organizer_media_added / organizer_media_removed / organizer_video_updated / organizer_hero_updated / organizer_schedule_updated
  entity_type: "festival",
  entity_id: festivalId,
  route: "/api/organizer/festivals/[id]",
  method: "PATCH",
  details: {
    organizer_id: organizerId,
    changed_fields: Object.keys(patch),
    before: pick(beforeFestival, Object.keys(patch)),
    after: pick(afterFestival, Object.keys(patch)),
  },
});
```

## Admin indicator

New column `festivals.last_edited_by_organizer_at timestamptz null`, set to `now()` on every successful write from any of the new organizer routes. The admin festival list (`/admin/festivals`) shows a badge on rows with a non-null value, sortable/filterable by it. The column is a simple historical marker — it is **not** cleared when an admin later edits or reviews the row; there is no separate "resolved" flag, keeping scope minimal.

## Migration

`scripts/sql/20260625_festival_organizer_edit_indicator.sql`:

```sql
alter table public.festivals
  add column if not exists last_edited_by_organizer_at timestamptz null;

create index if not exists idx_festivals_last_edited_by_organizer_at
  on public.festivals (last_edited_by_organizer_at)
  where last_edited_by_organizer_at is not null;
```

No RLS policy changes needed — all new organizer routes write through the service-role client (`getPortalAdminClient()`), same pattern as the existing `pending-festivals` organizer route.

## Error handling

- Unknown body key → 400 (`validateNoUnknownKeys`).
- Festival not verified/published → 403, "Можете да редактирате само одобрени фестивали."
- No active organizer membership → 403.
- City resolution fails → 400, same message as the pending-festivals route.
- Gallery/video limit exceeded → 409, same messages as the admin media routes (`getMediaLimitExceededErrorMessage`).
- No optimistic locking — last write wins. Acceptable for this scope: single owner per organizer typically edits their own festival, low contention.

## Explicitly out of scope

- Follower/update notifications (`scheduleFestivalUpdateNotifications` is never called from these routes).
- `status` changes, archive/delete, cancel/uncancel.
- Ownership reassignment (`organizer_id`/`organizer_ids`).
- Promotion/VIP fields.
- `slug` changes.
- Any "resolved" flag or audit-log review workflow for admins — the indicator is read-only history.
