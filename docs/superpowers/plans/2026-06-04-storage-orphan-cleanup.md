# Storage Orphan Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-panel button that scans the `festival-hero-images` bucket for orphaned objects (files not referenced by any DB row) and deletes them safely, plus harden the existing inline cleanup.

**Architecture:** A shared TS detection module (`lib/admin/storageGc.ts`) is the single source of truth for the app. An admin-only API route exposes `GET` (scan) and `POST` (delete-with-revalidation). A client panel renders the scan/delete UI. Deletions are recorded via the existing `logAdminAction` into `admin_audit_logs`. The existing inline cleanup helper gains a reference-safety guard.

**Tech Stack:** Next.js 14 App Router, TypeScript, `@supabase/supabase-js` (service-role client), Supabase Storage API, Tailwind.

> **Note on verification:** this project has **no automated test runner** (no vitest/jest; `package.json` scripts are only `dev`/`build`/`lint`). Per CLAUDE.md ("avoid new dependencies unless genuinely required"), we do **not** add one. Verification gates per task are: `npm run lint` (ESLint) + `npm run build` (TypeScript typecheck + compile) + the already-proven CLI dry-run + manual admin-panel checks. The CLI script (`scripts/cleanup-orphan-hero-images.mjs`, standalone `.mjs`, cannot import TS) keeps its own mirrored logic; `lib/admin/storageGc.ts` is the app's source of truth, with a cross-reference comment in both files.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/admin/storageGc.ts` (create) | Orphan detection: collect referenced paths, list bucket objects, diff → orphans; plus `isHeroUrlReferencedAnywhere` for inline guard. |
| `app/admin/api/storage/orphans/route.ts` (create) | Admin-only `GET` (scan) + `POST` (revalidate + delete + audit). |
| `app/admin/(protected)/storage/page.tsx` (create) | Server page: admin gate, renders the client panel. |
| `components/admin/StorageOrphansPanel.tsx` (create) | Client UI: scan button, orphan table, delete button. |
| `lib/admin/adminNavConfig.ts` (modify) | Add "Storage" nav item under "Система". |
| `lib/admin/festivalHeroStorageCleanup.ts` (modify) | Add reference-safety guard to inline blob deletion. |
| `app/admin/api/pending-festivals/[id]/gallery-image/route.ts` (modify) | Reorder: update DB first, then reference-safe cleanup. |
| `app/admin/api/festivals/[id]/media/[mediaId]/route.ts` (modify) | Same reference-safe cleanup. |
| `CLAUDE.md` (modify) | Note the new admin storage surface. |

---

## Task 1: Shared detection module — referenced paths

**Files:**
- Create: `lib/admin/storageGc.ts`

- [ ] **Step 1: Create the module with reference collection**

Reuses `extractHeroStorageObjectPathFromOurPublicUrl` and `getHeroImagesBucketName` from `lib/admin/rehostHeroImageFromUrl.ts` (both already exported).

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  extractHeroStorageObjectPathFromOurPublicUrl,
  getHeroImagesBucketName,
} from "@/lib/admin/rehostHeroImageFromUrl";

// NOTE: detection logic is mirrored (standalone, no TS imports) in
// scripts/cleanup-orphan-hero-images.mjs — keep both in sync.

export type OrphanObject = {
  path: string; // bucket-relative, e.g. "research-ai/123-abc.jpg"
  folder: string; // first path segment
  sizeBytes: number;
  uploadedAt: string | null;
};

const PAGE = 1000;

function addPath(set: Set<string>, url: unknown): void {
  if (typeof url !== "string" || !url.trim()) return;
  const p = extractHeroStorageObjectPathFromOurPublicUrl(url);
  if (p) set.add(p);
}

/** Every bucket-relative hero path referenced by any DB row. */
export async function collectReferencedHeroPaths(supabase: SupabaseClient): Promise<Set<string>> {
  const refs = new Set<string>();

  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("festivals")
      .select("hero_image, image_url")
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`festivals: ${error.message}`);
    if (!data?.length) break;
    for (const r of data as Array<{ hero_image: unknown; image_url: unknown }>) {
      addPath(refs, r.hero_image);
      addPath(refs, r.image_url);
    }
    if (data.length < PAGE) break;
  }

  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("pending_festivals")
      .select("hero_image, gallery_image_urls")
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`pending_festivals: ${error.message}`);
    if (!data?.length) break;
    for (const r of data as Array<{ hero_image: unknown; gallery_image_urls: unknown }>) {
      addPath(refs, r.hero_image);
      if (Array.isArray(r.gallery_image_urls)) {
        for (const g of r.gallery_image_urls) addPath(refs, g);
      }
    }
    if (data.length < PAGE) break;
  }

  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("festival_media")
      .select("url")
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`festival_media: ${error.message}`);
    if (!data?.length) break;
    for (const r of data as Array<{ url: unknown }>) addPath(refs, r.url);
    if (data.length < PAGE) break;
  }

  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("organizers")
      .select("logo_url")
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`organizers: ${error.message}`);
    if (!data?.length) break;
    for (const r of data as Array<{ logo_url: unknown }>) addPath(refs, r.logo_url);
    if (data.length < PAGE) break;
  }

  return refs;
}

export { getHeroImagesBucketName };
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: compiles with no TypeScript error in `lib/admin/storageGc.ts` (build may proceed to Next page compilation; only the type stage matters here).

- [ ] **Step 3: Commit**

```bash
git add lib/admin/storageGc.ts
git commit -m "feat(storage): add referenced-hero-paths collector"
```

---

## Task 2: Shared detection module — list objects + diff

**Files:**
- Modify: `lib/admin/storageGc.ts`

- [ ] **Step 1: Append object listing + orphan diff**

```ts
/** Recursively list every object in the hero bucket (Storage list is per-prefix, max 1000). */
export async function listAllHeroObjects(supabase: SupabaseClient, prefix = ""): Promise<OrphanObject[]> {
  const bucket = getHeroImagesBucketName();
  const out: OrphanObject[] = [];
  const limit = 1000;
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`list "${prefix}": ${error.message}`);
    if (!data?.length) break;
    for (const entry of data) {
      const full = prefix ? `${prefix}/${entry.name}` : entry.name;
      // Folders have null id/metadata; recurse.
      if (entry.id === null || entry.metadata == null) {
        const nested = await listAllHeroObjects(supabase, full);
        out.push(...nested);
      } else {
        out.push({
          path: full,
          folder: full.split("/")[0] ?? "",
          sizeBytes: Number((entry.metadata as { size?: unknown })?.size ?? 0),
          uploadedAt: entry.created_at ?? null,
        });
      }
    }
    if (data.length < limit) break;
    offset += limit;
  }
  return out;
}

/** Objects in the bucket not referenced by any DB row. `minAgeMs` excludes too-new uploads. */
export async function findHeroOrphans(
  supabase: SupabaseClient,
  opts: { minAgeMs?: number } = {},
): Promise<OrphanObject[]> {
  const minAgeMs = opts.minAgeMs ?? 0;
  const cutoff = minAgeMs > 0 ? Date.now() - minAgeMs : null;

  const [referenced, objects] = await Promise.all([
    collectReferencedHeroPaths(supabase),
    listAllHeroObjects(supabase),
  ]);

  return objects.filter((o) => {
    if (referenced.has(o.path)) return false;
    if (cutoff !== null) {
      const ts = o.uploadedAt ? Date.parse(o.uploadedAt) : 0;
      if (ts && ts > cutoff) return false; // too new — may not be wired into DB yet
    }
    return true;
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: no TypeScript error.

- [ ] **Step 3: Functional check against production (read-only)**

The CLI script already implements identical logic and was proven correct (48 orphans → 0) on 2026-06-04. Re-run its dry-run to confirm the bucket is still clean and the detection logic agrees:

Run: `SUPABASE_URL=https://hpvfsdmpatgceohigswm.supabase.co node scripts/cleanup-orphan-hero-images.mjs`
Expected: `Orphans found: 0` (or only objects younger than the script's age filter). If non-zero, investigate before proceeding.

- [ ] **Step 4: Commit**

```bash
git add lib/admin/storageGc.ts
git commit -m "feat(storage): add bucket listing + orphan diff"
```

---

## Task 3: Inline reference-safety guard helper

**Files:**
- Modify: `lib/admin/storageGc.ts`

- [ ] **Step 1: Append targeted reference check**

Unlike `collectReferencedHeroPaths` (full scan), this does cheap targeted existence queries for a single URL — suitable to run on each inline delete.

```ts
/**
 * True when `publicUrl` is still referenced by any DB row. Targeted (per-URL)
 * existence checks — cheap enough for inline cleanup at delete time.
 * Returns true on any query error (fail-safe: do not delete if unsure).
 */
export async function isHeroUrlReferencedAnywhere(supabase: SupabaseClient, publicUrl: string): Promise<boolean> {
  const url = publicUrl.trim();
  if (!url) return false;

  const head = { count: "exact" as const, head: true };

  const checks: Array<Promise<{ count: number | null; error: unknown }>> = [
    supabase.from("festivals").select("id", head).or(`hero_image.eq.${url},image_url.eq.${url}`),
    supabase.from("pending_festivals").select("id", head).eq("hero_image", url),
    supabase.from("festival_media").select("id", head).eq("url", url),
    supabase.from("organizers").select("id", head).eq("logo_url", url),
    // jsonb array containment: gallery_image_urls @> ["<url>"]
    supabase.from("pending_festivals").select("id", head).contains("gallery_image_urls", [url]),
  ];

  const results = await Promise.all(checks);
  for (const r of results) {
    if (r.error) return true; // fail-safe
    if ((r.count ?? 0) > 0) return true;
  }
  return false;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: no TypeScript error. (If `.or()` with a URL containing commas/dots is flagged at runtime later, note that hero public URLs contain no commas; dots are literal in PostgREST values. This is acceptable for our controlled URL shape.)

- [ ] **Step 3: Commit**

```bash
git add lib/admin/storageGc.ts
git commit -m "feat(storage): add per-url reference check for inline cleanup"
```

---

## Task 4: Admin API route — scan (GET)

**Files:**
- Create: `app/admin/api/storage/orphans/route.ts`

- [ ] **Step 1: Implement GET**

Mirrors the admin auth pattern from `app/admin/api/pending-festivals/[id]/hero-image/route.ts` (`getAdminContext` + `createSupabaseAdmin`).

```ts
import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { findHeroOrphans, getHeroImagesBucketName } from "@/lib/admin/storageGc";

const ONE_HOUR_MS = 60 * 60 * 1000;

export async function GET() {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const admin = createSupabaseAdmin();
    const orphans = await findHeroOrphans(admin, { minAgeMs: ONE_HOUR_MS });
    const totalBytes = orphans.reduce((sum, o) => sum + o.sizeBytes, 0);
    return NextResponse.json({
      bucket: getHeroImagesBucketName(),
      count: orphans.length,
      totalBytes,
      orphans,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected scan error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: no TypeScript error; route compiles.

- [ ] **Step 3: Commit**

```bash
git add app/admin/api/storage/orphans/route.ts
git commit -m "feat(storage): add admin orphan scan endpoint"
```

---

## Task 5: Admin API route — delete (POST)

**Files:**
- Modify: `app/admin/api/storage/orphans/route.ts`

- [ ] **Step 1: Add POST with server-side revalidation, batching, audit**

```ts
import { logAdminAction } from "@/lib/admin/audit-log";

const MAX_DELETE_PER_REQUEST = 500;
const REMOVE_BATCH = 100;

export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => null)) as { paths?: unknown } | null;
    const requested = Array.isArray(body?.paths)
      ? (body!.paths as unknown[]).filter((p): p is string => typeof p === "string" && p.trim().length > 0)
      : [];
    if (!requested.length) {
      return NextResponse.json({ error: "paths is required and must be a non-empty string array." }, { status: 400 });
    }

    const admin = createSupabaseAdmin();

    // Anti-race: re-confirm orphans server-side (also excludes <1h objects) and
    // intersect with the requested set. Only delete still-confirmed orphans.
    const confirmed = await findHeroOrphans(admin, { minAgeMs: ONE_HOUR_MS });
    const confirmedPaths = new Set(confirmed.map((o) => o.path));
    const sizeByPath = new Map(confirmed.map((o) => [o.path, o.sizeBytes]));

    const toDelete = requested.filter((p) => confirmedPaths.has(p)).slice(0, MAX_DELETE_PER_REQUEST);
    const skipped = requested.filter((p) => !confirmedPaths.has(p));

    if (!toDelete.length) {
      return NextResponse.json({ deletedCount: 0, freedBytes: 0, skipped });
    }

    const bucket = getHeroImagesBucketName();
    let deletedCount = 0;
    let freedBytes = 0;
    for (let i = 0; i < toDelete.length; i += REMOVE_BATCH) {
      const batch = toDelete.slice(i, i + REMOVE_BATCH);
      const { error } = await admin.storage.from(bucket).remove(batch);
      if (error) {
        return NextResponse.json(
          { error: `Delete failed after ${deletedCount} object(s): ${error.message}`, deletedCount, freedBytes },
          { status: 500 },
        );
      }
      deletedCount += batch.length;
      for (const p of batch) freedBytes += sizeByPath.get(p) ?? 0;
    }

    await logAdminAction({
      actor_user_id: ctx.user.id,
      action: "storage_orphans_deleted",
      entity_type: "storage_object",
      route: "/admin/api/storage/orphans",
      method: "POST",
      details: {
        bucket,
        deletedCount,
        freedBytes,
        samplePaths: toDelete.slice(0, 20),
        skippedCount: skipped.length,
      },
    });

    return NextResponse.json({ deletedCount, freedBytes, skipped });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected delete error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run build && npm run lint`
Expected: no TypeScript error, no new lint error.

- [ ] **Step 3: Commit**

```bash
git add app/admin/api/storage/orphans/route.ts
git commit -m "feat(storage): add admin orphan delete endpoint with revalidation + audit"
```

---

## Task 6: Client panel component

**Files:**
- Create: `components/admin/StorageOrphansPanel.tsx`

- [ ] **Step 1: Implement the panel**

```tsx
"use client";

import { useState } from "react";

type OrphanObject = {
  path: string;
  folder: string;
  sizeBytes: number;
  uploadedAt: string | null;
};

type ScanResult = {
  bucket: string;
  count: number;
  totalBytes: number;
  orphans: OrphanObject[];
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function StorageOrphansPanel() {
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function runScan() {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/admin/api/storage/orphans", { method: "GET" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Грешка при сканиране.");
      setScan(json as ScanResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Грешка при сканиране.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteAll() {
    if (!scan?.orphans.length) return;
    if (!window.confirm(`Сигурни ли сте? Ще се изтрият ${scan.count} файла (${formatBytes(scan.totalBytes)}).`)) {
      return;
    }
    setDeleting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/admin/api/storage/orphans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paths: scan.orphans.map((o) => o.path) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Грешка при изтриване.");
      setNotice(`Изтрити ${json.deletedCount} файла, освободени ${formatBytes(json.freedBytes)}.`);
      await runScan();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Грешка при изтриване.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={runScan}
          disabled={loading || deleting}
          className="rounded-xl border border-black/[0.18] bg-white px-4 py-2 text-sm font-semibold hover:bg-[#f7f6f3] disabled:opacity-50"
        >
          {loading ? "Сканиране…" : "Сканирай"}
        </button>
        {scan && scan.count > 0 && (
          <button
            type="button"
            onClick={deleteAll}
            disabled={deleting || loading}
            className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            {deleting ? "Изтриване…" : `Изтрий всички (${scan.count})`}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-green-700">{notice}</p>}

      {scan && (
        <div className="space-y-2">
          <p className="text-sm text-black/70">
            Bucket <code>{scan.bucket}</code>: {scan.count} orphan файла · {formatBytes(scan.totalBytes)}
            {" "}(изключени са файлове по-млади от 1 час)
          </p>
          {scan.count > 0 && (
            <div className="overflow-x-auto rounded-xl border border-black/10">
              <table className="w-full text-left text-xs">
                <thead className="bg-black/[0.04] text-black/60">
                  <tr>
                    <th className="px-3 py-2">Папка</th>
                    <th className="px-3 py-2">Път</th>
                    <th className="px-3 py-2">Размер</th>
                    <th className="px-3 py-2">Качен</th>
                  </tr>
                </thead>
                <tbody>
                  {scan.orphans.map((o) => (
                    <tr key={o.path} className="border-t border-black/5">
                      <td className="px-3 py-1.5">{o.folder}</td>
                      <td className="px-3 py-1.5 font-mono">{o.path}</td>
                      <td className="px-3 py-1.5">{formatBytes(o.sizeBytes)}</td>
                      <td className="px-3 py-1.5">{o.uploadedAt ? o.uploadedAt.slice(0, 10) : "?"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run build && npm run lint`
Expected: no error.

- [ ] **Step 3: Commit**

```bash
git add components/admin/StorageOrphansPanel.tsx
git commit -m "feat(storage): add admin orphan cleanup panel component"
```

---

## Task 7: Admin page + nav link

**Files:**
- Create: `app/admin/(protected)/storage/page.tsx`
- Modify: `lib/admin/adminNavConfig.ts`

- [ ] **Step 1: Create the server page**

The `(protected)` layout already enforces the admin gate, matching peers like `app/admin/(protected)/observability/page.tsx`.

```tsx
import type { Metadata } from "next";
import StorageOrphansPanel from "@/components/admin/StorageOrphansPanel";

export const metadata: Metadata = { title: "Storage — Админ" };

export default function AdminStoragePage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Storage — почистване</h1>
        <p className="text-sm text-black/60">
          Намира файлове в bucket-а <code>festival-hero-images</code>, които не се ползват от нито един запис,
          и позволява изтриването им. Изтриването е необратимо.
        </p>
      </header>
      <StorageOrphansPanel />
    </div>
  );
}
```

- [ ] **Step 2: Add the nav item under "Система"**

In `lib/admin/adminNavConfig.ts`, add to the "Система" group's `items` array (after the `observability` entry):

```ts
      { href: "/admin/observability", label: "Observability", match: "prefix" },
      { href: "/admin/storage", label: "Storage", match: "prefix" },
```

- [ ] **Step 3: Typecheck + lint**

Run: `npm run build && npm run lint`
Expected: no error; `/admin/storage` route present in build output.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, log in as admin, open `/admin/storage`.
Expected: page loads with "Сканирай" button. Click it → table renders (likely 0 orphans since bucket was cleaned). If test orphans exist, "Изтрий всички" deletes them and the re-scan shows fewer. Confirm an `admin_audit_logs` row with `action = 'storage_orphans_deleted'` appears (via Supabase) only when something was deleted.

- [ ] **Step 5: Commit**

```bash
git add "app/admin/(protected)/storage/page.tsx" lib/admin/adminNavConfig.ts
git commit -m "feat(storage): add admin storage cleanup page + nav link"
```

---

## Task 8: Harden inline cleanup (reference-safe)

**Files:**
- Modify: `lib/admin/festivalHeroStorageCleanup.ts`
- Modify: `app/admin/api/pending-festivals/[id]/gallery-image/route.ts`
- Modify: `app/admin/api/festivals/[id]/media/[mediaId]/route.ts`

- [ ] **Step 1: Add a reference-safe variant to the cleanup helper**

Append to `lib/admin/festivalHeroStorageCleanup.ts`:

```ts
import { isHeroUrlReferencedAnywhere } from "@/lib/admin/storageGc";

/**
 * Like {@link removeHeroStorageObjectForPublicUrlIfApplicable}, but first checks
 * the URL is no longer referenced by any DB row. Call AFTER the row that held the
 * reference has been updated/deleted, so the just-removed reference is already gone.
 */
export async function removeHeroStorageObjectIfUnreferenced(
  supabase: SupabaseClient,
  publicUrl: string,
): Promise<{ ok: true; deleted: boolean } | { ok: false; message: string }> {
  const stillReferenced = await isHeroUrlReferencedAnywhere(supabase, publicUrl);
  if (stillReferenced) {
    return { ok: true, deleted: false };
  }
  const result = await removeHeroStorageObjectForPublicUrlIfApplicable(supabase, publicUrl);
  if (!result.ok) return result;
  return { ok: true, deleted: true };
}
```

- [ ] **Step 2: Reorder pending gallery DELETE to update DB first, then reference-safe cleanup**

In `app/admin/api/pending-festivals/[id]/gallery-image/route.ts`, the current `DELETE` removes the blob (line ~266) BEFORE updating `gallery_image_urls` (line ~273). Reorder so the DB update happens first, then call the reference-safe variant. Replace this block:

```ts
    const removal = await removeHeroStorageObjectForPublicUrlIfApplicable(admin, url);
    if (!removal.ok) {
      return NextResponse.json({ error: `Storage cleanup failed: ${removal.message}` }, { status: 500 });
    }

    const filtered = gallery.filter((u) => u !== url);

    const { error: updateError } = await admin.from("pending_festivals").update({ gallery_image_urls: filtered }).eq("id", pendingId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
```

with:

```ts
    const filtered = gallery.filter((u) => u !== url);

    const { error: updateError } = await admin.from("pending_festivals").update({ gallery_image_urls: filtered }).eq("id", pendingId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Reference-safe: only delete the blob if no other row (e.g. hero_image) still points at it.
    const removal = await removeHeroStorageObjectIfUnreferenced(admin, url);
    if (!removal.ok) {
      return NextResponse.json({ error: `Storage cleanup failed: ${removal.message}` }, { status: 500 });
    }
```

Update the import on line 2 from:

```ts
import { removeHeroStorageObjectForPublicUrlIfApplicable } from "@/lib/admin/festivalHeroStorageCleanup";
```

to:

```ts
import { removeHeroStorageObjectIfUnreferenced } from "@/lib/admin/festivalHeroStorageCleanup";
```

- [ ] **Step 3: Apply the same reference-safe cleanup in festival media DELETE**

Open `app/admin/api/festivals/[id]/media/[mediaId]/route.ts`. It currently deletes the `festival_media` row and calls `removeHeroStorageObjectForPublicUrlIfApplicable`. Ensure the row delete happens first, then replace the cleanup call with `removeHeroStorageObjectIfUnreferenced(admin, url)` and update its import the same way. (Read the file first to match its exact variable names and ordering; the change is: DB delete → reference-safe blob delete.)

- [ ] **Step 4: Typecheck + lint**

Run: `npm run build && npm run lint`
Expected: no error.

- [ ] **Step 5: Manual verification**

With `npm run dev`: in a pending festival that has a hero image also present in its gallery, delete that gallery entry. Expected: the gallery entry is removed but the hero image still displays (blob NOT deleted because `hero_image` still references it). Deleting a gallery image that is *not* the hero removes its blob.

- [ ] **Step 6: Commit**

```bash
git add lib/admin/festivalHeroStorageCleanup.ts "app/admin/api/pending-festivals/[id]/gallery-image/route.ts" "app/admin/api/festivals/[id]/media/[mediaId]/route.ts"
git commit -m "fix(storage): make inline hero cleanup reference-safe"
```

---

## Task 9: Docs + finish

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Note the new admin surface**

In `CLAUDE.md`, under "Key modules & locations" → "Routes" table (admin pages area) or the admin section, add a one-line note that `/admin/storage` provides manual orphan cleanup of the hero bucket. Keep it to a single row/sentence consistent with surrounding entries.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no error.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: note admin storage orphan cleanup surface"
```

- [ ] **Step 4: Push, PR, merge**

```bash
git push -u origin feat/storage-orphan-cleanup
gh pr create --title "feat(storage): admin orphan cleanup for hero bucket" --body "Adds an admin-panel button to scan and delete orphaned objects in festival-hero-images, plus reference-safe inline cleanup. See docs/superpowers/specs/2026-06-04-storage-orphan-cleanup-design.md."
gh pr merge --merge --delete-branch
```

---

## Self-Review Notes

- **Spec coverage:** shared module (Tasks 1–3), API GET/POST with revalidation + 1h exclusion + 500 cap + 100 batch + audit (Tasks 4–5), admin UI + nav (Tasks 6–7), inline hardening with reference re-check (Task 8), CLI script retained (unchanged, referenced in Task 2), `admin_audit_logs` reuse (Task 5), docs (Task 9). No new table/migration — matches the "reuse admin_audit_logs" decision.
- **Type consistency:** `OrphanObject` shape identical across module, route, and component (`path`/`folder`/`sizeBytes`/`uploadedAt`). `findHeroOrphans(supabase, { minAgeMs })` signature consistent in Tasks 2, 4, 5. `removeHeroStorageObjectIfUnreferenced` defined in Task 8 Step 1, used in Steps 2–3.
- **No automated tests:** intentional — project has no runner; gates are build/lint + CLI dry-run + manual, stated in the header.
```
