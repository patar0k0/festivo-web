# Hero Image → Gallery Sync

**Date:** 2026-05-24  
**Branch:** feat/festival-report  
**Scope:** Admin — pending festivals + published festivals

---

## Problem

When a hero image is found via `/admin/research` and stored in `pending_festivals.hero_image`, the gallery section (`gallery_image_urls`) remains empty. This causes "Няма снимки в галерията." to appear and, more critically, means the image is **not included in `festival_media` after approve** (because `insertFestivalMediaFromPending` only reads `gallery_image_urls`).

The same issue exists for published festivals: `commitHeroFromUrl` sets `festivals.hero_image` but never inserts a `festival_media` row, so the hero doesn't appear in the gallery grid.

Additionally, `PendingFestivalEditForm` has a visible native `<input type="file" className="text-xs">` alongside a "Замени файл" button — both trigger hero upload, causing a redundant "Choose File | No file chosen" element.

---

## Design

### Change 1 — Server: `hero-image/route.ts` (pending festivals)

**File:** `app/admin/api/pending-festivals/[id]/hero-image/route.ts`

In the `POST` handler, after writing `hero_image = publicUrl` to `pending_festivals`:

1. Fetch current `gallery_image_urls` for the row.
2. If `publicUrl` is not already in the array, append it.
3. Write the updated array back in the same `update` call (or a second update — atomic enough for admin ops).
4. Return `gallery_image_urls` in the response alongside `hero_image` and `hero_image_source`.

No limit check needed here: the hero URL already counts towards the gallery limit in the client (`totalGallerySlotsUsed`). Adding it to `gallery_image_urls` just makes client and server agree on the count.

### Change 2 — Client: `PendingFestivalEditForm`

**File:** `components/admin/PendingFestivalEditForm.tsx`

- Extend `HeroImageUploadResponse` type to include `gallery_image_urls?: string[]`.
- In `uploadHeroImage` and `runHeroImportFromUrl`: after success, call `setGalleryUrls(payload.gallery_image_urls)` when the field is present in the response.
- Fix duplicate file input: change `<input ref={fileInputRef} type="file" accept="image/*" className="text-xs" />` to `className="hidden"`. Change the "Замени/Качи файл" button to `onClick={() => fileInputRef.current?.click()}`. Move upload logic to the input's `onChange` handler (same pattern as the gallery upload below it).

### Change 3 — Server: `hero-image/route.ts` (published festivals)

**File:** `app/admin/api/festivals/[id]/hero-image/route.ts`

In the `POST` handler, after updating `festivals.hero_image`:

1. Check if a `festival_media` row with this URL already exists for the festival.
2. If not, determine the next `sort_order` (max existing + 1, or 0).
3. Insert a row: `{ festival_id, url: publicUrl, type: "image", sort_order, is_hero: false }`.
4. Return the upserted/found row as `media_row` in the response.

`is_hero: false` is used for consistency with `insertFestivalMediaFromPending` and `uploadHeroImageFile` flow. The "Главна" badge in the UI is driven by URL matching (`form.hero_image === row.url`), not the `is_hero` DB flag.

### Change 4 — Client: `FestivalEditForm` (none required)

`commitHeroFromUrl` already calls `router.refresh()` after success. The new `festival_media` row will be included in the refreshed `initialMedia` and will appear in `displayGalleryRows` automatically.

---

## What is NOT changed

- `DELETE` for pending hero: the URL stays in `gallery_image_urls` (admin can remove it from the gallery section manually if desired).
- Approve flow: `insertFestivalMediaFromPending` already reads `gallery_image_urls` → hero will now be included automatically.
- Backfill of existing published festivals that have a hero but no `festival_media` row — out of scope.
- `FestivalEditForm` file-upload path for hero (`uploadHeroImageFile`): already uploads to `/media` endpoint first, then calls `commitHeroFromUrl` — `festival_media` row is already created.

---

## Affected files

| File | Type |
|---|---|
| `app/admin/api/pending-festivals/[id]/hero-image/route.ts` | Server — add gallery sync |
| `app/admin/api/festivals/[id]/hero-image/route.ts` | Server — insert `festival_media` row |
| `components/admin/PendingFestivalEditForm.tsx` | Client — state update + duplicate input fix |
