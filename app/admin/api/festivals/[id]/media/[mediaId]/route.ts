import { NextResponse } from "next/server";
import { removeHeroStorageObjectIfUnreferenced } from "@/lib/admin/festivalHeroStorageCleanup";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string; mediaId: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: festivalId, mediaId } = await params;
  const mediaDb = createSupabaseAdmin();

  const { data: row, error: fetchError } = await mediaDb
    .from("festival_media")
    .select("id, festival_id, url, type")
    .eq("id", mediaId)
    .eq("festival_id", festivalId)
    .maybeSingle<{ id: string; festival_id: string; url: string | null; type: string | null }>();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json({ error: "Media not found." }, { status: 404 });
  }

  const typeLower = (row.type ?? "").toLowerCase();
  const isVideo = typeLower.includes("video");

  const mediaUrl = !isVideo && typeof row.url === "string" ? row.url.trim() : "";

  const { error } = await mediaDb.from("festival_media").delete().eq("id", mediaId).eq("festival_id", festivalId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Reference-safe: only delete the blob if no other row still points at it.
  if (mediaUrl) {
    const removal = await removeHeroStorageObjectIfUnreferenced(mediaDb, mediaUrl);
    if (!removal.ok) {
      return NextResponse.json({ error: `Storage cleanup failed: ${removal.message}` }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
