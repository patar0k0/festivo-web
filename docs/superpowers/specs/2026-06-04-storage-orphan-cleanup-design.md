# Storage Orphan Cleanup — Design

**Date:** 2026-06-04
**Status:** Approved (pending spec review)
**Scope:** Detect and delete orphaned objects in the `festival-hero-images` Storage bucket via an admin-triggered button.

## Problem

The `festival-hero-images` bucket accumulates orphaned objects — files that exist in Storage but are not referenced by any database row. A one-time audit on 2026-06-04 found 48 orphans (15.7 MB, ~15% of the bucket), already cleaned manually. They keep accruing because uploads are never garbage-collected at their source:

| Source | Why it orphans |
|---|---|
| `research-ai/` candidates (was 41/48) | Rehosted during AI research **before** anyone knows if the candidate will be used. Rejected/superseded candidates are never deleted. |
| Deleted/rejected `pending_festivals` rows | Their `hero_image` + `gallery_image_urls` blobs orphan all at once. |
| Hero swap (`festival-hero/manual`, `…/url`) | On swap the old `hero_image` is overwritten in the DB, blob left behind. (Note: the old hero usually still lives in `gallery_image_urls`, so it is *not* immediately orphaned — it becomes orphaned only when truly unreferenced.) |

Existing inline cleanup (`lib/admin/festivalHeroStorageCleanup.ts` → `removeHeroStorageObjectForPublicUrlIfApplicable`) deletes the blob on **gallery image DELETE** and **festival media DELETE** only. It does **not** check whether the URL is still referenced elsewhere — a latent bug, since a hero image is also added to the gallery, so deleting that gallery entry can delete a blob that `hero_image` still points to.

## Decision

A **manual admin button**, not an automated cron. The admin scans, reviews the orphan list, and clicks delete. This removes the need for `cron_locks` throttling and eliminates the risk of automated deletion of in-flight uploads. (Earlier we considered a daily GC job inside `/api/cron/worker`; rejected in favor of explicit human control.)

- **Retention / race safety:** the real protection is a **server-side reference re-check at delete time** + excluding objects **younger than 1 hour** (active uploads not yet wired into the DB).
- **Audit:** reuse `admin_audit_logs` via the existing `logAdminAction()` helper — this is now a genuine admin action, so no new table/migration is needed.
- **Batch limits:** Storage `remove` in batches of ≤100; cap ≤500 deletions per request (project safety rule).

## Components

### 1. `lib/admin/storageGc.ts` (shared detection module)

Single source of truth for orphan detection, used by both the API and the CLI script.

```ts
export type OrphanObject = {
  path: string;        // bucket-relative, e.g. "research-ai/123-abc.jpg"
  folder: string;      // first path segment
  sizeBytes: number;
  uploadedAt: string | null;
};

// Collect every referenced bucket-relative path from the DB.
export async function collectReferencedHeroPaths(supabase): Promise<Set<string>>;

// List every object in the hero bucket (recursive, paginated).
export async function listAllHeroObjects(supabase): Promise<OrphanObject[]>;

// Diff → orphans. minAgeMs excludes too-new objects (default 1h for API).
export async function findHeroOrphans(supabase, opts?: { minAgeMs?: number }): Promise<OrphanObject[]>;
```

Referenced columns scanned: `festivals.hero_image`, `festivals.image_url`, `pending_festivals.hero_image`, `pending_festivals.gallery_image_urls` (jsonb array), `festival_media.url`, `organizers.logo_url`. Paths are extracted from public URLs using the existing helper logic in `lib/admin/rehostHeroImageFromUrl.ts` (`extractHeroStorageObjectPathFromOurPublicUrl`), generalized for arbitrary referenced URLs.

### 2. `app/admin/api/storage/orphans/route.ts`

Admin-only (`getAdminContext` / admin role check), service-role client for Storage + DB.

- **`GET`** → `{ count, totalBytes, orphans: OrphanObject[] }`. Pure scan, deletes nothing. Excludes objects < 1h old.
- **`POST`** (body `{ paths: string[] }`) → deletes the requested paths after:
  1. Re-running `findHeroOrphans` server-side and intersecting with `paths` (anti-race — only delete paths still confirmed orphan).
  2. Excluding any path < 1h old.
  3. Capping at 500; remove in batches of 100 via Storage API.
  4. Writing one `logAdminAction` entry: `action: "storage_orphans_deleted"`, `entity_type: "storage_object"`, `details: { bucket, deletedCount, freedBytes, samplePaths }`.
  - Returns `{ deletedCount, freedBytes, skipped: string[] }`.

### 3. Admin UI — `app/admin/(protected)/storage/page.tsx`

- "Сканирай" button → calls `GET`, renders a table: folder · path · size · uploaded date · age.
- Summary line: total count + total size.
- "Изтрий" button (delete-all-shown, with confirm) → calls `POST` with the scanned paths, then re-scans. Shows freed space.
- Linked from the admin nav (mirror an existing entry such as `observability`).
- v1 deletes all shown orphans; per-row checkbox selection is out of scope (YAGNI).

### 4. CLI script (existing)

`scripts/cleanup-orphan-hero-images.mjs` is refactored to import the shared detection logic where practical (it currently runs under Node with `@supabase/supabase-js` directly). Kept for ad-hoc / one-off use. Its `--apply` / `--min-age-days` behavior is unchanged.

### 5. Inline cleanup hardening

`removeHeroStorageObjectForPublicUrlIfApplicable` gains an optional reference-safety check: before deleting a blob, confirm the URL is not referenced by any other DB column. Applied to the two existing call sites (gallery DELETE, media DELETE) to close the latent gallery↔hero shared-blob bug.

## Data Flow

```
Admin clicks "Сканирай"
  → GET /admin/api/storage/orphans
      → findHeroOrphans(supabase, { minAgeMs: 1h })
          → collectReferencedHeroPaths()  (festivals, pending_festivals, festival_media, organizers)
          → listAllHeroObjects()          (recursive Storage list)
          → diff
  → table rendered

Admin clicks "Изтрий"
  → POST /admin/api/storage/orphans { paths }
      → re-validate orphans server-side ∩ paths, drop <1h, cap 500
      → storage.remove(batch≤100) ×N
      → logAdminAction("storage_orphans_deleted", …)
  → re-scan, show freed space
```

## Error Handling

- Storage "not found" on remove → treated as success (object already gone), per existing `isBenignStorageRemoveError`.
- Partial batch failure → return error with how many succeeded; admin can re-scan and retry (idempotent — gone objects simply won't reappear).
- Audit write is best-effort (`logAdminAction` already retries and never throws).
- DB scan error → abort the whole operation, delete nothing.

## Testing

- Unit: `findHeroOrphans` against a fixture set of referenced URLs + object list → correct orphan diff; objects < minAge excluded; gallery jsonb array parsed.
- Unit: reference re-check skips a path that is still referenced.
- Manual: scan in admin panel shows expected orphans; delete frees the reported space; `admin_audit_logs` row written.

## Out of Scope (YAGNI)

- Automated cron GC.
- Per-row checkbox selection in v1.
- Configurable retention stored in DB.
- `organizer-logos` bucket cleanup (empty / not present currently).
- New audit table (`admin_audit_logs` suffices).

## Security

- Endpoint is admin-only; service-role client server-side only.
- No new RLS surface (reuses `admin_audit_logs`, which already has service-role-only RLS).
- Reference re-check at delete time prevents deleting in-use blobs.
```
