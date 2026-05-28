# Hero Gallery Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a hero image is set on a festival (pending or published), its URL is automatically included in the gallery data so it persists after approve and is visible in the gallery grid.

**Architecture:** Three server-side touches (pending hero route + published hero route) and one client touch (PendingFestivalEditForm). No schema changes. No new files. The pending festival route now reads current `gallery_image_urls`, appends the hero URL if absent, and writes both in one update. The published festival route inserts a `festival_media` row after updating `festivals.hero_image`. The client consumes the new `gallery_image_urls` field in the hero upload response and fixes a visible duplicate file input.

**Tech Stack:** Next.js 14 App Router route handlers · Supabase JS client · TypeScript · React state

---

## File Map

| File | Change |
|---|---|
| `app/admin/api/pending-festivals/[id]/hero-image/route.ts` | Read + write `gallery_image_urls` alongside `hero_image` |
| `app/admin/api/festivals/[id]/hero-image/route.ts` | Insert `festival_media` row after setting hero |
| `components/admin/PendingFestivalEditForm.tsx` | Consume `gallery_image_urls` from response; fix duplicate file input |

---

## Task 1 — Server: sync hero URL into `gallery_image_urls` (pending festivals)

**Files:**
- Modify: `app/admin/api/pending-festivals/[id]/hero-image/route.ts`

### Context

After upload/rehost produces `publicUrl`, the route currently does one update: `{ hero_image, hero_image_source, hero_image_original_url }`. We extend it to also append `publicUrl` to `gallery_image_urls` if absent.

Both the JSON (URL import) and multipart (file upload) paths share the same "write to DB" step — we add a helper function to avoid repeating the logic.

### Steps

- [ ] **Step 1: Add a helper that merges the hero URL into a gallery array**

  In `app/admin/api/pending-festivals/[id]/hero-image/route.ts`, add this function near the top (after the `extensionFromFileName` helper, before `POST`):

  ```ts
  function addToGalleryIfAbsent(current: unknown, url: string): string[] {
    const arr = Array.isArray(current) ? (current as unknown[]).filter((v): v is string => typeof v === "string" && v.trim().length > 0) : [];
    return arr.some((u) => u.trim() === url.trim()) ? arr : [...arr, url];
  }
  ```

- [ ] **Step 2: In the JSON path — fetch gallery, update hero + gallery together**

  Replace the block starting at `const updateRow: Record<string, unknown> = {` through the `return NextResponse.json({...})` at the end of the JSON branch with:

  ```ts
  const { data: existingRow, error: fetchError } = await ctx.supabase
    .from("pending_festivals")
    .select("gallery_image_urls")
    .eq("id", id)
    .maybeSingle<{ gallery_image_urls: unknown }>();

  if (fetchError) {
    return NextResponse.json({ error: `Failed to fetch gallery: ${fetchError.message}` }, { status: 500 });
  }

  const updatedGallery = addToGalleryIfAbsent(existingRow?.gallery_image_urls, outcome.publicUrl);

  const updateRow: Record<string, unknown> = {
    hero_image: outcome.publicUrl,
    hero_image_source: outcome.originalUrl ? "url_import" : "manual_upload",
    hero_image_original_url: outcome.originalUrl ?? null,
    gallery_image_urls: updatedGallery,
  };

  const { data: updatedFromUrl, error: updateFromUrlError } = await ctx.supabase
    .from("pending_festivals")
    .update(updateRow)
    .eq("id", id)
    .select("id, hero_image, hero_image_source")
    .maybeSingle();

  if (updateFromUrlError) {
    return NextResponse.json({ error: `Failed to update pending festival hero image: ${updateFromUrlError.message}` }, { status: 500 });
  }

  if (!updatedFromUrl) {
    return NextResponse.json({ error: "Pending festival not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    hero_image: updatedFromUrl.hero_image,
    hero_image_source: updatedFromUrl.hero_image_source,
    gallery_image_urls: updatedGallery,
  });
  ```

- [ ] **Step 3: In the file upload path — fetch gallery, update hero + gallery together**

  Replace the block starting at `const { data: updatedRow, error: updateError } = await ctx.supabase` (the file-upload branch update, around line 126) through its `return NextResponse.json({...})` with:

  ```ts
  const { data: existingGalleryRow, error: galleryFetchError } = await ctx.supabase
    .from("pending_festivals")
    .select("gallery_image_urls")
    .eq("id", id)
    .maybeSingle<{ gallery_image_urls: unknown }>();

  if (galleryFetchError) {
    return NextResponse.json({ error: `Failed to fetch gallery: ${galleryFetchError.message}` }, { status: 500 });
  }

  const updatedGallery = addToGalleryIfAbsent(existingGalleryRow?.gallery_image_urls, publicUrl);

  const { data: updatedRow, error: updateError } = await ctx.supabase
    .from("pending_festivals")
    .update({
      hero_image: publicUrl,
      hero_image_source: "manual_upload",
      hero_image_original_url: null,
      gallery_image_urls: updatedGallery,
    })
    .eq("id", id)
    .select("id, hero_image, hero_image_source")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: `Failed to update pending festival hero image: ${updateError.message}` }, { status: 500 });
  }

  if (!updatedRow) {
    return NextResponse.json({ error: "Pending festival not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    hero_image: updatedRow.hero_image,
    hero_image_source: updatedRow.hero_image_source,
    gallery_image_urls: updatedGallery,
  });
  ```

- [ ] **Step 4: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit 2>&1 | head -30
  ```

  Expected: no errors in the modified file.

- [ ] **Step 5: Commit**

  ```bash
  git add app/admin/api/pending-festivals/[id]/hero-image/route.ts
  git commit -m "feat(admin): sync hero image url into gallery_image_urls on pending festival"
  ```

---

## Task 2 — Client: consume `gallery_image_urls` from hero response + fix duplicate file input

**Files:**
- Modify: `components/admin/PendingFestivalEditForm.tsx`

### Context

`HeroImageUploadResponse` currently doesn't include `gallery_image_urls`. The upload and import handlers don't call `setGalleryUrls`. Additionally the hero section has a visible native `<input type="file" className="text-xs">` that shows "Choose File | No file chosen" — redundant with the "Замени файл" button.

### Steps

- [ ] **Step 1: Extend `HeroImageUploadResponse` type**

  At line 156, change:

  ```ts
  type HeroImageUploadResponse = {
    ok?: boolean;
    hero_image?: string | null;
    hero_image_source?: string | null;
    error?: string;
  };
  ```

  to:

  ```ts
  type HeroImageUploadResponse = {
    ok?: boolean;
    hero_image?: string | null;
    hero_image_source?: string | null;
    gallery_image_urls?: string[];
    error?: string;
  };
  ```

- [ ] **Step 2: Update `uploadHeroImage` to sync gallery state**

  Inside `uploadHeroImage`, after the line:
  ```ts
  setHeroImageSourceState(typeof payload.hero_image_source === "string" ? payload.hero_image_source : "manual_upload");
  ```
  add:
  ```ts
  if (Array.isArray(payload.gallery_image_urls)) {
    setGalleryUrls(payload.gallery_image_urls);
  }
  ```

- [ ] **Step 3: Update `runHeroImportFromUrl` to sync gallery state**

  Inside `runHeroImportFromUrl`, after the line:
  ```ts
  setHeroImageSourceState(typeof payload.hero_image_source === "string" ? payload.hero_image_source : "url_import");
  ```
  add:
  ```ts
  if (Array.isArray(payload.gallery_image_urls)) {
    setGalleryUrls(payload.gallery_image_urls);
  }
  ```

- [ ] **Step 4: Fix the duplicate file input — hide native input, wire button to trigger it**

  In the hero section (around line 1950), replace:

  ```tsx
  <input ref={fileInputRef} type="file" accept="image/*" className="text-xs" />
  <button
    type="button"
    onClick={uploadHeroImage}
    disabled={...}
    className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] disabled:opacity-50"
  >
    {uploadingHeroImage ? "Качване..." : heroImageUrl ? "Замени файл" : "Качи файл"}
  </button>
  ```

  with:

  ```tsx
  <input
    ref={fileInputRef}
    type="file"
    accept="image/*"
    className="hidden"
    onChange={(e) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (f) void uploadHeroImage();
    }}
  />
  <button
    type="button"
    onClick={() => fileInputRef.current?.click()}
    disabled={
      saving ||
      Boolean(runningAction) ||
      uploadingHeroImage ||
      importingHeroFromUrl ||
      removingHeroImage ||
      (!heroHasImage && galleryImageCount >= mediaLimits.gallery)
    }
    className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] disabled:opacity-50"
  >
    {uploadingHeroImage ? "Качване..." : heroImageUrl ? "Замени файл" : "Качи файл"}
  </button>
  ```

  > Note: `uploadHeroImage()` already reads `fileInputRef.current?.files?.[0]` — it works unchanged. The `onChange` triggers it automatically after file selection. `e.target.value = ""` resets the input so selecting the same file twice fires `onChange` again.

- [ ] **Step 5: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit 2>&1 | head -30
  ```

  Expected: no errors.

- [ ] **Step 6: Manual test — pending festival with research hero**

  1. Open any pending festival that has a hero image set (found by research) at `/admin/pending-festivals/[id]`.
  2. Scroll to Media section → Gallery.
  3. Expected: the hero image appears as a card in the gallery grid with badge "Главна" and "Премахни" button. "Няма снимки в галерията." is gone.
  4. Click "Замени файл" — file dialog should open (no "Choose File" text visible anymore).
  5. Select any image file — it should upload and the gallery should update with the new URL.

- [ ] **Step 7: Commit**

  ```bash
  git add components/admin/PendingFestivalEditForm.tsx
  git commit -m "feat(admin): show hero image in gallery grid and fix duplicate file input on pending festival"
  ```

---

## Task 3 — Server: insert `festival_media` row when hero is set on published festival

**Files:**
- Modify: `app/admin/api/festivals/[id]/hero-image/route.ts`

### Context

`commitHeroFromUrl` in `FestivalEditForm` calls `POST /admin/api/festivals/[id]/hero-image` with a JSON body `{ source_url }`. The route rehost the image and updates `festivals.hero_image` but never creates a `festival_media` row. So the hero never appears in `displayGalleryRows`.

The `FestivalEditForm` already calls `router.refresh()` on success, which reloads `initialMedia` — no client changes needed.

### Steps

- [ ] **Step 1: After the `festivals` update, check for an existing `festival_media` row**

  In `app/admin/api/festivals/[id]/hero-image/route.ts`, after:

  ```ts
  return NextResponse.json({
    ok: true,
    hero_image: updatedRow.hero_image,
    image_url: updatedRow.image_url,
  });
  ```

  replace that final return with the following (keeping all the code above it unchanged):

  ```ts
  const supabaseAdmin = createSupabaseAdmin();

  // Ensure the hero URL has a festival_media row so it appears in the gallery grid.
  const { data: existingMedia } = await supabaseAdmin
    .from("festival_media")
    .select("id")
    .eq("festival_id", id)
    .eq("url", publicUrl)
    .maybeSingle();

  if (!existingMedia) {
    const { data: maxOrderRow } = await supabaseAdmin
      .from("festival_media")
      .select("sort_order")
      .eq("festival_id", id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = typeof maxOrderRow?.sort_order === "number" ? maxOrderRow.sort_order + 1 : 0;

    await supabaseAdmin.from("festival_media").insert({
      festival_id: id,
      url: publicUrl,
      type: "image",
      sort_order: nextOrder,
      is_hero: false,
    });
  }

  return NextResponse.json({
    ok: true,
    hero_image: updatedRow.hero_image,
    image_url: updatedRow.image_url,
  });
  ```

  > `is_hero: false` is intentional — the "Главна" badge in the UI is driven by URL matching against `festivals.hero_image`, not the `is_hero` DB flag. This is consistent with how `insertFestivalMediaFromPending` and `uploadHeroImageFile` work.

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit 2>&1 | head -30
  ```

  Expected: no errors.

- [ ] **Step 3: Manual test — published festival hero import**

  1. Open a published festival at `/admin/festivals/[id]` that has NO gallery images.
  2. Type a valid image URL into the Hero Image field.
  3. Click "Импорт от URL".
  4. After success toast: scroll to Gallery section.
  5. Expected: the imported image appears as a card with badge "Главна". "Няма снимки в галерията." is gone.
  6. Reload the page — card should still be there (persisted in `festival_media`).

- [ ] **Step 4: Commit**

  ```bash
  git add app/admin/api/festivals/[id]/hero-image/route.ts
  git commit -m "feat(admin): insert festival_media row when hero image is imported on published festival"
  ```

---

## Task 4 — Push, PR, merge

- [ ] **Step 1: Push branch**

  ```bash
  git push -u origin feat/festival-report
  ```

- [ ] **Step 2: Open PR**

  ```bash
  gh pr create --title "feat(admin): sync hero image into gallery on pending and published festivals" --body "$(cat <<'EOF'
  ## Proposed Change
  - Summary: Hero image is now automatically added to the gallery when set — both on pending festivals (gallery_image_urls) and published festivals (festival_media row).
  - Why now: Hero found by research showed "Няма снимки в галерията." and was not preserved after approve. Also fixes duplicate file input in pending festival hero section.

  ## Impacted Docs
  - None (no schema change, no new API contract)

  ## Checklist
  - [ ] Schema: no migration needed
  - [ ] API contract: additive only (new gallery_image_urls field in pending hero response)
  - [ ] Background jobs: not affected
  - [ ] Security: service role server-only, unchanged
  - [ ] SEO: not affected
  - [ ] Mobile sync: not affected
  - [ ] Docs: spec in docs/superpowers/specs/2026-05-24-hero-gallery-sync-design.md
  EOF
  )"
  ```

- [ ] **Step 3: Merge**

  ```bash
  gh pr merge --merge --delete-branch
  ```
