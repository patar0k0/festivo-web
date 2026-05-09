import { NextResponse } from "next/server";

import { fetchUserSavedFestivalIdSet } from "@/lib/api/mobile/planSaved";
import { serializeMobileFestivalListItem } from "@/lib/api/mobile/festivalSerialization";
import { mobileAuthErrorResponse, resolveMobileRequestAuth } from "@/lib/api/mobile/resolveMobileAuth";
import { getFestivals } from "@/lib/queries";
import {
  formatRecommendationExplanation,
  type RecommendationExplanation,
} from "@/lib/recommendations/explanations";

export const dynamic = "force-dynamic";

type FeedActivityType = "new_festival" | "trending" | "promoted" | "updated" | "starting_soon";

type FeedItem = {
  activity_type: FeedActivityType;
  score: number;
  festival_id: string;
  start_date: string;
  organizer_id: string | null;
  organizer_slug: string | null;
  organizer_name: string | null;
  explanation: RecommendationExplanation;
};

type CursorPayload = {
  score: number;
  start_date: string;
  festival_id: string;
};

const PAGE_SIZE_DEFAULT = 12;
const PAGE_SIZE_MAX = 30;

function parsePageSize(url: URL): number {
  const raw = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  if (!Number.isFinite(raw) || raw < 1) return PAGE_SIZE_DEFAULT;
  return Math.min(raw, PAGE_SIZE_MAX);
}

function encodeCursor(cursor: CursorPayload): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(raw: string | null): CursorPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<CursorPayload>;
    if (
      typeof parsed.score === "number" &&
      typeof parsed.start_date === "string" &&
      typeof parsed.festival_id === "string"
    ) {
      return {
        score: parsed.score,
        start_date: parsed.start_date,
        festival_id: parsed.festival_id,
      };
    }
  } catch {
    return null;
  }
  return null;
}

function stableSort(items: FeedItem[]): FeedItem[] {
  return [...items].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const dateCmp = a.start_date.localeCompare(b.start_date);
    if (dateCmp !== 0) return dateCmp;
    return a.festival_id.localeCompare(b.festival_id);
  });
}

function isAfterCursor(item: FeedItem, cursor: CursorPayload | null): boolean {
  if (!cursor) return true;
  if (item.score !== cursor.score) return item.score < cursor.score;
  const dateCmp = item.start_date.localeCompare(cursor.start_date);
  if (dateCmp !== 0) return dateCmp > 0;
  return item.festival_id > cursor.festival_id;
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00.000Z`);
  const b = Date.parse(`${toIso}T00:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 365;
  return Math.floor((b - a) / 86_400_000);
}

export async function GET(request: Request) {
  try {
    const auth = await resolveMobileRequestAuth(request);
    const authErr = mobileAuthErrorResponse(auth);
    if (authErr) return authErr;

    const url = new URL(request.url);
    const limit = parsePageSize(url);
    const cursor = decodeCursor(url.searchParams.get("cursor"));

    const [pool, trendingPool] = await Promise.all([
      getFestivals({ when: "all" }, 1, 180, { listingSort: "trending" }),
      getFestivals({ when: "all" }, 1, 80, { listingSort: "popular" }),
    ]);
    const allFestivals = pool.data;
    const trendingFestivals = trendingPool.data;
    const today = isoToday();

    const followedCities = new Set<string>();
    const followedOrganizers = new Set<string>();
    if (auth.user) {
      const [cityRows, organizerRows] = await Promise.all([
        auth.supabase.from("user_followed_cities").select("city_slug").eq("user_id", auth.user.id).limit(200),
        auth.supabase.from("user_followed_organizers").select("organizer_id").eq("user_id", auth.user.id).limit(200),
      ]);
      for (const row of cityRows.data ?? []) {
        const slug = typeof row.city_slug === "string" ? row.city_slug.trim().toLowerCase() : "";
        if (slug) followedCities.add(slug);
      }
      for (const row of organizerRows.data ?? []) {
        const id = typeof row.organizer_id === "string" ? row.organizer_id.trim() : "";
        if (id) followedOrganizers.add(id);
      }
    }

    const festivalById = new Map(allFestivals.map((f) => [String(f.id), f]));
    const feedRows: FeedItem[] = [];
    const seenFestivalIds = new Set<string>();

    for (const festival of allFestivals) {
      const festivalId = String(festival.id);
      if (seenFestivalIds.has(festivalId)) continue;
      const startDate = festival.start_date ?? today;
      const startInDays = daysUntil(today, startDate);
      const organizerId = festival.organizer_id ? String(festival.organizer_id) : null;
      const organizerSlug = festival.organizer?.slug ?? null;
      const organizerName = festival.organizer_name ?? festival.organizer?.name ?? null;
      const citySlug = String((festival as { city_slug?: string | null }).city_slug ?? "").toLowerCase();
      const saves = Number(festival.saves_count ?? 0);

      if (organizerId && followedOrganizers.has(organizerId)) {
        feedRows.push({
          activity_type: "new_festival",
          score: 2000 + Math.max(0, 60 - startInDays),
          festival_id: festivalId,
          start_date: startDate,
          organizer_id: organizerId,
          organizer_slug: organizerSlug,
          organizer_name: organizerName,
          explanation: formatRecommendationExplanation("because_follow", {
            name: organizerName ?? "this organizer",
          }),
        });
        seenFestivalIds.add(festivalId);
        continue;
      }

      if (festival.promotion_status === "promoted" && startInDays >= -2) {
        feedRows.push({
          activity_type: "promoted",
          score: 1500 + Math.max(0, 40 - startInDays),
          festival_id: festivalId,
          start_date: startDate,
          organizer_id: organizerId,
          organizer_slug: organizerSlug,
          organizer_name: organizerName,
          explanation: formatRecommendationExplanation("promoted_pick"),
        });
        seenFestivalIds.add(festivalId);
        continue;
      }

      if (startInDays >= 0 && startInDays <= 5) {
        feedRows.push({
          activity_type: "starting_soon",
          score: 1200 + Math.max(0, 10 - startInDays),
          festival_id: festivalId,
          start_date: startDate,
          organizer_id: organizerId,
          organizer_slug: organizerSlug,
          organizer_name: organizerName,
          explanation: formatRecommendationExplanation("starts_soon"),
        });
        seenFestivalIds.add(festivalId);
        continue;
      }

      if (citySlug && followedCities.has(citySlug) && saves >= 2) {
        feedRows.push({
          activity_type: "trending",
          score: 1000 + Math.min(80, saves),
          festival_id: festivalId,
          start_date: startDate,
          organizer_id: organizerId,
          organizer_slug: organizerSlug,
          organizer_name: organizerName,
          explanation: formatRecommendationExplanation("trending_near_you"),
        });
        seenFestivalIds.add(festivalId);
        continue;
      }

      if (startInDays >= -3 && startInDays <= 21) {
        feedRows.push({
          activity_type: "updated",
          score: 600 + Math.max(0, 25 - Math.abs(startInDays)),
          festival_id: festivalId,
          start_date: startDate,
          organizer_id: organizerId,
          organizer_slug: organizerSlug,
          organizer_name: organizerName,
          explanation: formatRecommendationExplanation("recently_updated"),
        });
        seenFestivalIds.add(festivalId);
      }
    }

    // Add a fallback slice from the trending pool to avoid stale/empty feeds for cold users.
    for (const festival of trendingFestivals) {
      const id = String(festival.id);
      if (seenFestivalIds.has(id)) continue;
      const startDate = festival.start_date ?? today;
      const organizerId = festival.organizer_id ? String(festival.organizer_id) : null;
      const organizerSlug = festival.organizer?.slug ?? null;
      const organizerName = festival.organizer_name ?? festival.organizer?.name ?? null;
      feedRows.push({
        activity_type: "trending",
        score: 500 + Number(festival.saves_count ?? 0),
        festival_id: id,
        start_date: startDate,
        organizer_id: organizerId,
        organizer_slug: organizerSlug,
        organizer_name: organizerName,
        explanation: formatRecommendationExplanation("popular_in_city", {
          city: festival.city_name_display ?? "your area",
        }),
      });
      seenFestivalIds.add(id);
    }

    const sorted = stableSort(feedRows).filter((row) => isAfterCursor(row, cursor));
    const pageRows = sorted.slice(0, limit);
    const nextCursor =
      sorted.length > limit
        ? encodeCursor({
            score: pageRows[pageRows.length - 1]!.score,
            start_date: pageRows[pageRows.length - 1]!.start_date,
            festival_id: pageRows[pageRows.length - 1]!.festival_id,
          })
        : null;

    const pageFestivalIds = [...new Set(pageRows.map((x) => x.festival_id))];
    const pageFestivals = pageFestivalIds.map((id) => festivalById.get(id)).filter(Boolean);
    let savedSet = new Set<string>();
    if (auth.user) {
      savedSet = await fetchUserSavedFestivalIdSet(auth.supabase, auth.user.id, pageFestivalIds);
    }

    const organizerIds = [...new Set(pageRows.map((x) => x.organizer_id).filter((x): x is string => Boolean(x)))];
    const [organizerFollowerRows, weeklyViewRows] = await Promise.all([
      organizerIds.length
        ? auth.supabase.from("user_followed_organizers").select("organizer_id").in("organizer_id", organizerIds)
        : Promise.resolve({ data: [], error: null } as const),
      pageFestivalIds.length
        ? auth.supabase
            .from("analytics_events")
            .select("festival_id")
            .eq("event", "festival_view")
            .gte("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString())
            .in("festival_id", pageFestivalIds)
        : Promise.resolve({ data: [], error: null } as const),
    ]);

    const organizerFollowerCount = new Map<string, number>();
    for (const row of organizerFollowerRows.data ?? []) {
      const id = typeof row.organizer_id === "string" ? row.organizer_id : "";
      if (!id) continue;
      organizerFollowerCount.set(id, (organizerFollowerCount.get(id) ?? 0) + 1);
    }
    const weeklyViews = new Map<string, number>();
    for (const row of weeklyViewRows.data ?? []) {
      const id = typeof row.festival_id === "string" ? row.festival_id : "";
      if (!id) continue;
      weeklyViews.set(id, (weeklyViews.get(id) ?? 0) + 1);
    }

    const trendingOrder = [...pageFestivals]
      .sort((a, b) => Number(b!.saves_count ?? 0) - Number(a!.saves_count ?? 0))
      .map((f) => String(f!.id));
    const trendingRank = new Map<string, number>(trendingOrder.map((id, idx) => [id, idx + 1]));

    const festivalPreviewById = new Map(
      pageFestivals.map((festival) => {
        const id = String(festival!.id);
        return [id, serializeMobileFestivalListItem(festival!, savedSet.has(id))];
      }),
    );

    const groupedOrganizers = new Map<
      string,
      {
        organizer_id: string;
        organizer_slug: string | null;
        organizer_name: string | null;
        follower_count: number;
        items: FeedItem[];
      }
    >();
    for (const row of pageRows) {
      const key = row.organizer_id ?? "none";
      if (!groupedOrganizers.has(key)) {
        groupedOrganizers.set(key, {
          organizer_id: row.organizer_id ?? "",
          organizer_slug: row.organizer_slug ?? null,
          organizer_name: row.organizer_name ?? null,
          follower_count: row.organizer_id ? organizerFollowerCount.get(row.organizer_id) ?? 0 : 0,
          items: [],
        });
      }
      groupedOrganizers.get(key)!.items.push(row);
    }

    return NextResponse.json({
      items: pageRows.map((row) => ({
        activity_type: row.activity_type,
        festival: festivalPreviewById.get(row.festival_id) ?? null,
        organizer: row.organizer_slug
          ? { id: row.organizer_id, slug: row.organizer_slug, name: row.organizer_name }
          : null,
        explanation: row.explanation,
        social_proof: {
          save_count: Number(festivalById.get(row.festival_id)?.saves_count ?? 0),
          organizer_follower_count: row.organizer_id ? organizerFollowerCount.get(row.organizer_id) ?? 0 : 0,
          trending_rank: trendingRank.get(row.festival_id) ?? null,
          weekly_views: weeklyViews.get(row.festival_id) ?? 0,
        },
      })),
      organizers: [...groupedOrganizers.values()].map((group) => ({
        organizer_id: group.organizer_id,
        organizer_slug: group.organizer_slug,
        organizer_name: group.organizer_name,
        follower_count: group.follower_count,
        item_count: group.items.length,
      })),
      next_cursor: nextCursor,
      has_more: Boolean(nextCursor),
    });
  } catch (error) {
    console.error("[api/mobile/follow-feed]", error);
    return NextResponse.json({ error: "Failed to load follow feed" }, { status: 500 });
  }
}
