import { NextResponse } from "next/server";
import { serializeMobileFestivalDetail } from "@/lib/api/mobile/festivalSerialization";
import { fetchFestivalLikesCount, isFestivalLikedByUser } from "@/lib/api/mobile/festivalLikes";
import { isFestivalInUserPlan } from "@/lib/api/mobile/planSaved";
import { mobileAuthErrorResponse, resolveMobileRequestAuth } from "@/lib/api/mobile/resolveMobileAuth";
import { getFestivalDetail, normalizePublicFestivalSlugParam } from "@/lib/queries";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = await resolveMobileRequestAuth(request);
    const authErr = mobileAuthErrorResponse(auth);
    if (authErr) {
      return authErr;
    }

    const { slug: rawSlug } = await context.params;
    const slug = normalizePublicFestivalSlugParam(rawSlug);

    const detail = await getFestivalDetail(slug, { supabaseForFestivalLoad: auth.supabase });
    if (!detail) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const festivalId = String(detail.festival.id);
    const [isSaved, isLiked, likesCount] = await Promise.all([
      auth.user ? isFestivalInUserPlan(auth.supabase, auth.user.id, festivalId) : Promise.resolve(false),
      auth.user ? isFestivalLikedByUser(auth.supabase, auth.user.id, festivalId) : Promise.resolve(false),
      fetchFestivalLikesCount(auth.supabase, festivalId),
    ]);

    const body = serializeMobileFestivalDetail(detail.festival, detail.media, isSaved, {
      days: detail.days,
      scheduleItems: detail.scheduleItems,
      isLiked,
      likesCount,
    });
    return NextResponse.json(body);
  } catch (e) {
    console.error("[api/mobile/festivals/[slug]]", e);
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
