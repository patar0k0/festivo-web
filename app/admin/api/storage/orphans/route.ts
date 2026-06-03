import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { findHeroOrphans, getHeroImagesBucketName } from "@/lib/admin/storageGc";
import { logAdminAction } from "@/lib/admin/audit-log";

const ONE_HOUR_MS = 60 * 60 * 1000;
const MAX_DELETE_PER_REQUEST = 500;
const REMOVE_BATCH = 100;

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
