import { NextResponse } from "next/server";
import { getPortalSessionUser, getPortalAdminClient } from "@/lib/organizer/portal";
import { assertOrganizerCanEditPublishedFestival } from "@/lib/organizer/festivalSelfEdit";
import { rehostHeroImageIfRemote } from "@/lib/admin/rehostHeroImageFromUrl";
import { logAdminAction } from "@/lib/admin/audit-log";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const { id: festivalId } = await params;
  const gate = await assertOrganizerCanEditPublishedFestival(admin, session.user.id, festivalId);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  try {
    const body = (await request.json().catch(() => null)) as { source_url?: unknown } | null;
    const sourceUrl = typeof body?.source_url === "string" ? body.source_url : "";
    if (!sourceUrl.trim()) {
      return NextResponse.json({ error: "Изисква се връзка към снимка." }, { status: 400 });
    }

    const timestamp = Date.now();
    const outcome = await rehostHeroImageIfRemote(
      admin,
      sourceUrl,
      (ext) => `festival-hero/organizer/festival-${festivalId}-${timestamp}.${ext}`,
    );
    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.error }, { status: 422 });
    }

    const publicUrl = outcome.publicUrl;
    const updatedAt = new Date().toISOString();

    const { data: updatedRow, error: updateError } = await admin
      .from("festivals")
      .update({ hero_image: publicUrl, image_url: publicUrl, updated_at: updatedAt, last_edited_by_organizer_at: updatedAt })
      .eq("id", festivalId)
      .select("id, hero_image, image_url")
      .maybeSingle();

    if (updateError) {
      return NextResponse.json({ error: `Грешка при обновяване на основната снимка: ${updateError.message}` }, { status: 500 });
    }
    if (!updatedRow) {
      return NextResponse.json({ error: "Фестивалът не е намерен." }, { status: 404 });
    }

    const { data: existingMedia } = await admin
      .from("festival_media")
      .select("id")
      .eq("festival_id", festivalId)
      .eq("url", publicUrl)
      .maybeSingle();

    if (!existingMedia) {
      const { data: maxOrderRow } = await admin
        .from("festival_media")
        .select("sort_order")
        .eq("festival_id", festivalId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextOrder = typeof maxOrderRow?.sort_order === "number" ? maxOrderRow.sort_order + 1 : 0;

      await admin.from("festival_media").insert({
        festival_id: festivalId,
        url: publicUrl,
        type: "image",
        sort_order: nextOrder,
        is_hero: false,
      });
    }

    try {
      await logAdminAction({
        actor_user_id: session.user.id,
        action: "festival.organizer_hero_updated",
        entity_type: "festival",
        entity_id: festivalId,
        route: "/api/organizer/festivals/[id]/hero-image",
        method: "PUT",
        details: { organizer_id: gate.organizerId, hero_image: publicUrl },
      });
    } catch (auditError) {
      const message = auditError instanceof Error ? auditError.message : "unknown";
      console.error("[organizer/audit] festival.organizer_hero_updated failed", { message });
    }

    return NextResponse.json({ ok: true, hero_image: updatedRow.hero_image, image_url: updatedRow.image_url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неочаквана грешка при основната снимка.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
