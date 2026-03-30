import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { isSupportedVideoPageUrl } from "@/lib/festival/videoEmbed";
import { pendingRowToOrganizerEntries } from "@/lib/admin/pendingOrganizerEntries";
import { getMediaLimitExceededErrorMessage, resolveAllowedMediaLimitsFromOrganizerPlan, resolveMediaPlanFromOrganizer } from "@/lib/admin/mediaLimits";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id: pendingId } = await params;
    const body = (await request.json().catch(() => null)) as { video_url?: unknown } | null;
    const raw = typeof body?.video_url === "string" ? body.video_url.trim() : "";

    if (raw && !isSupportedVideoPageUrl(raw)) {
      return NextResponse.json(
        { error: "Поддържани са само публични линкове към YouTube или Facebook видео." },
        { status: 400 },
      );
    }

    // Enforce plan-based media limits before updating any row.
    const { data: pendingRow, error: pendingFetchError } = await ctx.supabase
      .from("pending_festivals")
      .select("organizer_id,organizer_entries,organizer_name")
      .eq("id", pendingId)
      .maybeSingle<{
        organizer_id: string | null;
        organizer_entries: unknown;
        organizer_name: string | null;
      }>();

    if (pendingFetchError) {
      return NextResponse.json({ error: pendingFetchError.message }, { status: 500 });
    }

    const organizerEntries = pendingRow ? pendingRowToOrganizerEntries(pendingRow as any) : [];
    const primaryOrganizerId = pendingRow?.organizer_id ?? organizerEntries[0]?.organizer_id ?? null;

    let organizerPlanRow: { plan?: string | null; plan_started_at?: string | null; plan_expires_at?: string | null } | null = null;
    if (primaryOrganizerId) {
      const { data: organizerRow, error: orgFetchError } = await ctx.supabase
        .from("organizers")
        .select("plan,plan_started_at,plan_expires_at")
        .eq("id", primaryOrganizerId)
        .maybeSingle<{
          plan: string | null;
          plan_started_at: string | null;
          plan_expires_at: string | null;
        }>();

      if (orgFetchError) {
        return NextResponse.json({ error: orgFetchError.message }, { status: 500 });
      }

      organizerPlanRow = organizerRow ?? null;
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

    const { error } = await ctx.supabase.from("pending_festivals").update({ video_url: raw || null }).eq("id", pendingId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, video_url: raw || null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
