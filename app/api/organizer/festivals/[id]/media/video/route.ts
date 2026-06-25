import { NextResponse } from "next/server";
import { getPortalSessionUser, getPortalAdminClient } from "@/lib/organizer/portal";
import { assertOrganizerCanEditPublishedFestival } from "@/lib/organizer/festivalSelfEdit";
import { isSupportedVideoPageUrl } from "@/lib/festival/videoEmbed";
import {
  fetchOrganizerPlanRow,
  getMediaLimitExceededErrorMessage,
  resolveAllowedMediaLimitsFromOrganizerPlan,
  resolveMediaPlanFromOrganizer,
} from "@/lib/admin/mediaLimits";
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
    const body = (await request.json().catch(() => null)) as { video_url?: unknown } | null;
    const raw = typeof body?.video_url === "string" ? body.video_url.trim() : "";

    if (raw && !isSupportedVideoPageUrl(raw)) {
      return NextResponse.json(
        { error: "Поддържани са само публични линкове към YouTube или Facebook видео." },
        { status: 400 },
      );
    }

    const { data: organizerPlanRow, error: orgFetchError } = await fetchOrganizerPlanRow(admin, gate.organizerId);
    if (orgFetchError) {
      return NextResponse.json({ error: orgFetchError.message }, { status: 500 });
    }

    const plan = resolveMediaPlanFromOrganizer(organizerPlanRow);
    const limits = resolveAllowedMediaLimitsFromOrganizerPlan(organizerPlanRow);

    const futureVideoCount = raw ? 1 : 0;
    if (futureVideoCount > limits.video) {
      return NextResponse.json(
        { error: getMediaLimitExceededErrorMessage({ mediaType: "video", current: futureVideoCount, limit: limits.video, plan }) },
        { status: 409 },
      );
    }

    const { error: legacyVideoDelError } = await admin
      .from("festival_media")
      .delete()
      .eq("festival_id", festivalId)
      .ilike("type", "%video%");
    if (legacyVideoDelError) {
      return NextResponse.json({ error: legacyVideoDelError.message }, { status: 500 });
    }

    const updatedAt = new Date().toISOString();
    const { error: updError } = await admin
      .from("festivals")
      .update({ video_url: raw || null, updated_at: updatedAt, last_edited_by_organizer_at: updatedAt })
      .eq("id", festivalId);

    if (updError) {
      return NextResponse.json({ error: updError.message }, { status: 500 });
    }

    try {
      await logAdminAction({
        actor_user_id: session.user.id,
        action: "festival.organizer_video_updated",
        entity_type: "festival",
        entity_id: festivalId,
        route: "/api/organizer/festivals/[id]/media/video",
        method: "PUT",
        details: { organizer_id: gate.organizerId, video_url: raw || null },
      });
    } catch (auditError) {
      const message = auditError instanceof Error ? auditError.message : "unknown";
      console.error("[organizer/audit] festival.organizer_video_updated failed", { message });
    }

    return NextResponse.json({ ok: true, video_url: raw || null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неочаквана грешка.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
