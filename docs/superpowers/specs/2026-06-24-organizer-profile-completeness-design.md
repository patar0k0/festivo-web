# Organizer profile completeness indicator

## Why

The organizer portal edit page (`/organizer/organizations/[id]/edit`) shows a live preview of the public profile, but the preview doesn't tell the organizer what's *missing* — it just mirrors whatever is already typed. Admins already have a "Пълнота на профила" read-only checklist on the admin organizer edit form. We want the organizer-facing equivalent: a completeness signal that actively nudges the organizer to fill in their profile, in both places they'd see it — while editing, and on the dashboard overview.

## Scope

- Remove the live preview panel from the organizer portal edit form.
- Add a completeness progress indicator above the edit form.
- Add the same completeness signal per organization row on `/organizer/dashboard`.
- Shared, framework-agnostic calculation so both surfaces (server component + client component) use identical rules.

Out of scope: admin-facing checklist (already exists, untouched), deep-linking from a missing item to its form field, any change to the PATCH API contract.

## Completeness rules

5 equally-weighted items, computed by a new pure helper `lib/organizer/profileCompleteness.ts`:

| Key | Label (BG) | Done when |
|---|---|---|
| `logo` | Лого | `logo_url` non-empty |
| `description` | Описание | `description` non-empty |
| `links` | Уебсайт или социална мрежа | `website_url`, `facebook_url`, or `instagram_url` non-empty |
| `contact` | Контакт (имейл или телефон) | `email` or `phone` non-empty |
| `festival` | Поне 1 фестивал в каталога | `festivalCount > 0` |

`verified` is intentionally excluded — it's an admin-only flag, not actionable by the organizer, and showing it as "missing" would be confusing noise.

```ts
export type OrganizerCompletenessInput = {
  logo_url: string;
  description: string;
  website_url: string;
  facebook_url: string;
  instagram_url: string;
  email: string;
  phone: string;
  festivalCount: number;
};

export type OrganizerCompletenessItem = { key: string; label: string; done: boolean };

export type OrganizerCompletenessResult = {
  items: OrganizerCompletenessItem[];
  doneCount: number;
  total: number; // 5
};

export function computeOrganizerCompleteness(input: OrganizerCompletenessInput): OrganizerCompletenessResult;
```

Pure function, no React/Supabase dependency — usable from both a server component (dashboard) and a client component (edit form's `useMemo`).

**Festival count approximation:** counted via `festivals.organizer_id = <id> AND status IN ('verified', 'published')`. This skips the `festival_organizers` co-host join table that the public organizer page and admin workspace use for the authoritative count. Acceptable because this is a soft UI nudge, not a gate — worst case a co-host-only organizer briefly sees "0 festivals" until they have a directly-owned one.

## 1. Edit form (`components/organizer/OrganizerProfileEditForm.tsx`)

**Remove:** the entire right-column live preview block and everything that only existed to feed it:
- `verified` from `OrganizerProfileEditFormProps["initial"]`, the `verifiedPreview` state, and the `body.verified` handling in `executePatch` (the PATCH API route itself is unchanged — it still returns `verified` in its response, the client just stops reading it)
- `previewLogoUrl`, `previewInitials`, `previewWebsiteHref`, `previewFacebookHref`, `previewInstagramHref`, `hasSocialOrWeb`, `previewEmail`, `previewPhone`, `previewCityName`, `previewCityLabel`, `previewCityIsFallback`
- `OrganizerProfileLogo` import, `telHref`, `ExternalLinkIcon` helpers
- The outer `grid lg:grid-cols-[...]` wrapper collapses to a single-column layout (the form keeps its existing `max-w` styling/card chrome).

**Add:** a new prop `festivalCount: number` (server-fetched, passed down like `cities`/`initial`). Above the `FormSection` for "Основна информация", render a compact card:
- Progress bar (0–100%, `doneCount/total`)
- Text: "X/5 попълнени"
- If incomplete: small muted chips/text listing missing item labels (e.g. "Липсва: описание, контакт")

Recomputed via `useMemo` from `normalizeFormData(form)` + the static `festivalCount` prop, so it updates live as the organizer types — same debounced-autosave flow is untouched.

## 2. Dashboard (`app/organizer/(workspace)/dashboard/page.tsx`)

- Expand the `organizers` select to add `description, website_url, facebook_url, instagram_url, email, phone` (currently only `id,name,slug,logo_url`).
- Add one batched query: `festivals` where `organizer_id IN (orgIds)` AND `status IN ('verified','published')`, selecting `organizer_id`, then group-count in JS per org.
- In the existing "Моите организации" list, under each org's name/slug, render the same progress bar + "X/5 попълнени" + missing-item chips (reusing `computeOrganizerCompleteness`). No new top-level section — this augments the existing row, the "Редактирай" button stays as the action to fix it.

## Data flow

```
organizers/[id]/edit/page.tsx (server)
  → fetch organizer row (drop `verified` from the select + from the `initial` prop — no longer consumed anywhere once the preview's badge is removed)
  → fetch festivals count (new)
  → <OrganizerProfileEditForm festivalCount={...} .../>
       → useMemo: computeOrganizerCompleteness(form + festivalCount)
       → render progress card

dashboard/page.tsx (server)
  → fetch organizers (expanded columns)
  → fetch festivals counts grouped by organizer_id (new)
  → per org: computeOrganizerCompleteness(...)
  → render progress bar per row
```

## Testing

- Manual verification via dev server / preview tool: edit form with progressively filled fields shows the bar moving and the form layout single-column; dashboard shows correct per-org counts for an organizer with 0 and >0 published festivals.
- No automated test suite currently covers this area of the organizer portal; no new test infra introduced (consistent with existing patterns in this codebase, which favors manual preview verification for portal UI per CLAUDE.md preview workflow).
