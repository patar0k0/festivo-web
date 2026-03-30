import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { isSupportedVideoPageUrl } from "@/lib/festival/videoEmbed";
import {
  fetchOrganizerPlanRow,
  getMediaLimitExceededErrorMessage,
  resolveAllowedMediaLimitsFromOrganizerPlan,
  resolveMediaPlanFromOrganizer,
} from "@/lib/admin/mediaLimits";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id: festivalId } = await params;
    const body = (await request.json().catch(() => null)) as { video_url?: unknown } | null;
    const raw = typeof body?.video_url === "string" ? body.video_url.trim() : "";

    if (raw && !isSupportedVideoPageUrl(raw)) {
      return NextResponse.json(
        { error: "Поддържани са само публични линкове към YouTube или Facebook видео." },
        { status: 400 },
      );
    }

    // Enforce plan-based media limits before writing any rows.
    const { data: festivalRow, error: festivalFetchError } = await ctx.supabase
      .from("festivals")
      .select("organizer_id")
      .eq("id", festivalId)
      .maybeSingle<{ organizer_id: string | null }>();

    if (festivalFetchError) {
      return NextResponse.json({ error: festivalFetchError.message }, { status: 500 });
    }

    let organizerId: string | null = festivalRow?.organizer_id ?? null;
    if (!organizerId) {
      const { data: linkRow, error: linkError } = await ctx.supabase
        .from("festival_organizers")
        .select("organizer_id")
        .eq("festival_id", festivalId)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle<{ organizer_id: string | null }>();

      if (linkError) {
        return NextResponse.json({ error: linkError.message }, { status: 500 });
      }
      organizerId = linkRow?.organizer_id ?? null;
    }

    const { data: organizerPlanRow, error: orgFetchError } = await fetchOrganizerPlanRow(ctx.supabase, organizerId);

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

    const { error: delError } = await ctx.supabase
      .from("festival_media")
      .delete()
      .eq("festival_id", festivalId)
      .ilike("type", "%video%");

    if (delError) {
      return NextResponse.json({ error: delError.message }, { status: 500 });
    }

    if (!raw) {
      return NextResponse.json({ ok: true, video_url: null });
    }

    const { data: maxRow } = await ctx.supabase
      .from("festival_media")
      .select("sort_order")
      .eq("festival_id", festivalId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = typeof maxRow?.sort_order === "number" ? maxRow.sort_order + 1 : 0;

    const { data: inserted, error: insError } = await ctx.supabase
      .from("festival_media")
      .insert({
        festival_id: festivalId,
        url: raw,
        type: "video",
        sort_order: nextOrder,
        is_hero: false,
      })
      .select("id, festival_id, url, type, sort_order")
      .maybeSingle();

    if (insError) {
      return NextResponse.json({ error: insError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, video_url: raw, row: inserted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
