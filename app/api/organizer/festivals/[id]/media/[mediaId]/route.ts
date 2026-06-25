import { NextResponse } from "next/server";
import { getPortalSessionUser, getPortalAdminClient } from "@/lib/organizer/portal";
import { assertOrganizerCanEditPublishedFestival } from "@/lib/organizer/festivalSelfEdit";
import { removeHeroStorageObjectIfUnreferenced } from "@/lib/admin/festivalHeroStorageCleanup";
import { logAdminAction } from "@/lib/admin/audit-log";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; mediaId: string }> }) {
  const session = await getPortalSessionUser();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Необходим е вход." }, { status: 401 });
  }

  let admin;
  try {
    admin = getPortalAdminClient();
  } catch {
    return NextResponse.json({ error: "Услугата е временно недостъпна." }, { status: 503 });
  }

  const { id: festivalId, mediaId } = await params;
  const gate = await assertOrganizerCanEditPublishedFestival(admin, session.user.id, festivalId);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const { data: row, error: fetchError } = await admin
    .from("festival_media")
    .select("id, festival_id, url, type")
    .eq("id", mediaId)
    .eq("festival_id", festivalId)
    .maybeSingle<{ id: string; festival_id: string; url: string | null; type: string | null }>();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Не е намерено." }, { status: 404 });
  }

  const typeLower = (row.type ?? "").toLowerCase();
  const isVideo = typeLower.includes("video");
  const mediaUrl = !isVideo && typeof row.url === "string" ? row.url.trim() : "";

  const { error } = await admin.from("festival_media").delete().eq("id", mediaId).eq("festival_id", festivalId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (mediaUrl) {
    const removal = await removeHeroStorageObjectIfUnreferenced(admin, mediaUrl);
    if (!removal.ok) {
      return NextResponse.json({ error: `Грешка при изчистване на хранилището: ${removal.message}` }, { status: 500 });
    }
  }

  await admin.from("festivals").update({ last_edited_by_organizer_at: new Date().toISOString() }).eq("id", festivalId);

  try {
    await logAdminAction({
      actor_user_id: session.user.id,
      action: "festival.organizer_media_removed",
      entity_type: "festival",
      entity_id: festivalId,
      route: "/api/organizer/festivals/[id]/media/[mediaId]",
      method: "DELETE",
      details: { organizer_id: gate.organizerId, url: mediaUrl || row.url },
    });
  } catch (auditError) {
    const message = auditError instanceof Error ? auditError.message : "unknown";
    console.error("[organizer/audit] festival.organizer_media_removed failed", { message });
  }

  return NextResponse.json({ ok: true });
}
