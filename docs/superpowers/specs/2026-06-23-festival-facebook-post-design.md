# Festival → Facebook Post button — Design

**Date:** 2026-06-23
**Status:** Approved (design); ready for implementation plan

## Goal

Add a "Публикувай във Facebook" button on the admin festival **edit** page (`/admin/festivals/[id]`) that lets an admin publish a link post about that festival to the Festivo Facebook **Page**, with an editable caption, and record that it was posted.

## Scope

- **Where:** edit page of an already-approved festival only (not pending-festival approval). Approved festivals already have a final hero image, slug, and public URL.
- **Target:** the Festivo Facebook **Page** (not groups), via Graph API.
- **Post type:** **link post** — `POST /{PAGE_ID}/feed` with `message` + `link`. Facebook pulls the preview image/title from the festival page's existing Open Graph meta tags. No image upload in this feature.
- **Button behaviour:** opens a small dialog with a pre-filled, editable caption; admin confirms to publish.
- **Tracking:** record the Facebook post id + timestamp so the UI shows "already posted" and re-posting is a deliberate, warned action.

## Out of scope

- Posting to Facebook groups.
- Photo/collage posts (the weekend-roundup worker already covers image posts).
- Auto-posting on approval (this is a manual button).
- OAuth / `social_accounts` integration — we reuse the existing env-based Page token.

## Existing building blocks (reused / mirrored)

- `festivo-workers/workers/lib/publishers/facebook.js` already posts to the Festivo Page using `FB_PAGE_ID` + `FB_PAGE_ACCESS_TOKEN` (Graph API v21.0). The token is already minted for the weekend-post feature. We mirror its approach for a **link** post on the web side.
- Admin edit page: `app/admin/(protected)/festivals/[id]/page.tsx` → `components/admin/FestivalEditForm.tsx` (already has `${baseUrl}/festivals/${slug}` and the admin-API `fetch` pattern).
- Admin API auth pattern: `getAdminContext()` + `logAdminAction()` (see `app/admin/api/festivals/[id]/archive/route.ts`).

## Architecture decision

**Web posts directly (synchronous), not via the worker queue.** For a manual button with an editable caption, immediate feedback matters and the Graph call is a single `fetch`. The worker-queue path (`social_scheduled_posts`) is async (up to 5 min) and is overkill here.

## Components

### 1. Schema migration
`scripts/sql/20260623_festival_facebook_post.sql` — add two columns to `festivals`:

- `facebook_post_id text` — Graph API post id (used to link to the live post)
- `facebook_posted_at timestamptz` — when it was last published

No new RLS policies (columns written only by the service-role admin route; existing `festivals` RLS unchanged). No index (not used in filter/sort paths).

### 2. Server Graph helper
`lib/admin/facebook/postToPage.ts` — pure-ish helper:

```
postFestivalLinkToPage({ message, link }) -> { postId }
```

- `POST https://graph.facebook.com/${FB_GRAPH_VERSION|v21.0}/${FB_PAGE_ID}/feed`
- body: `{ message, link, access_token: FB_PAGE_ACCESS_TOKEN }`
- reads `FB_PAGE_ID` + `FB_PAGE_ACCESS_TOKEN` from env; throws a clear error if unset
- throws on non-OK response with the Graph error message
- returns `{ postId: json.id }`

### 3. Admin API route
`app/admin/api/festivals/[id]/facebook-post/route.ts` (POST):

1. `getAdminContext()` guard → 403 if not admin.
2. Parse body `{ message: string }` (the edited caption). Validate non-empty.
3. Load the festival (`slug`, `title`) from DB via the admin context client — **the link is built server-side** (`${baseUrl}/festivals/${slug}`), never trusted from the client.
4. Call `postFestivalLinkToPage({ message, link })`.
5. On success: update `festivals` with `facebook_post_id`, `facebook_posted_at = now()`.
6. `logAdminAction({ action: "festival.facebook_posted", entity_type: "festival", entity_id: id, details: { postId } })`.
7. Return `{ ok: true, postId, postedAt }`; on failure `{ error }` with appropriate status.

### 4. UI — dialog in FestivalEditForm
A "Публикувай във Facebook" button in the edit-form header (next to existing actions). On click, open a small dialog:

- Textarea pre-filled with: `{title} — {city}, {date}\n\n{link}` (fully editable).
- If `facebook_posted_at` is already set → show a warning "Вече публикувано на DD.MM.YYYY" with a link to the existing post, but still allow re-posting.
- Buttons: "Публикувай" / "Откажи".
- On success → toast/confirmation + link to the live FB post; reflect the new posted state in the UI.

The festival's `facebook_post_id` / `facebook_posted_at` are passed from the page into the form so the initial state is correct.

### 5. Env + docs
- Add `FB_PAGE_ID` + `FB_PAGE_ACCESS_TOKEN` to Vercel production (same token already in Railway). `FB_GRAPH_VERSION` optional override.
- Document the vars in the CLAUDE.md env table + README.
- Add a short note in CLAUDE.md describing the feature.

## Data flow

```
Admin opens festival edit page
  → clicks "Публикувай във Facebook"
  → edits caption in dialog → confirms
  → POST /admin/api/festivals/[id]/facebook-post { message }
      → admin guard
      → load slug/title from DB, build link server-side
      → postFestivalLinkToPage → Graph API /{PAGE_ID}/feed
      → write facebook_post_id + facebook_posted_at
      → logAdminAction
  → UI shows success + link to the post; button now shows posted state
```

## Error handling

- Missing env (`FB_PAGE_ID`/`FB_PAGE_ACCESS_TOKEN`) → 500 with a clear message; nothing written to DB.
- Graph API error → surface the Graph message to the admin; DB unchanged.
- Empty/whitespace message → 400 before any Graph call.
- Re-post is allowed but warned in the UI; each successful post overwrites `facebook_post_id`/`facebook_posted_at` with the latest.

## Testing

- Unit-test `postFestivalLinkToPage` with an injected `fetch` (success → returns postId; non-OK → throws with Graph message; missing env → throws).
- Route-level: admin guard returns 403 for non-admins; empty message → 400; success path writes the two columns and logs the action (can be exercised with a mocked helper).

## Security

- Admin-only via `getAdminContext()`.
- Page token stays server-side (env), never sent to the browser.
- The published link is derived from the DB slug, not from client input.
