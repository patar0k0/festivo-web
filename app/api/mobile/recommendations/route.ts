import { NextResponse } from "next/server";
import { resolveMobileRequestAuth, mobileAuthErrorResponse } from "@/lib/api/mobile/resolveMobileAuth";
import { getFestivals } from "@/lib/queries";
import { scoreFestivalForUser, type ScoredFestival } from "@/lib/recommendations/scorer";
import { serializeMobileFestivalListItem } from "@/lib/api/mobile/festivalSerialization";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type SectionKey = "for_you" | "near_you" | "trending" | "this_weekend" | "from_followed_organizers";

type SectionPayload = {
  key: SectionKey;
  title: string;
  items: ReturnType<typeof serializeMobileFestivalListItem>[];
};

function pageFromSearch(url: URL): number {
  const raw = url.searchParams.get("page");
  const parsed = raw ? Number.parseInt(raw, 10) : 1;
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

function chunkForPage<T>(items: T[], page: number, perPage: number): T[] {
  const from = (page - 1) * perPage;
  return items.slice(from, from + perPage);
}

async function loadRecentlyViewedFestivalIds(userId: string): Promise<Set<string>> {
  const admin = createSupabaseAdmin();
  if (!admin) return new Set<string>();
  const { data, error } = await admin
    .from("analytics_events")
    .select("festival_id")
    .eq("user_id", userId)
    .eq("event", "festival_view")
    .not("festival_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) return new Set<string>();
  const ids = (data ?? [])
    .map((row) => (typeof row.festival_id === "string" ? row.festival_id : ""))
    .filter(Boolean);
  return new Set(ids);
}

function sortStable(list: ScoredFestival[]): ScoredFestival[] {
  return [...list].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const dateCmp = String(a.festival.start_date).localeCompare(String(b.festival.start_date));
    if (dateCmp !== 0) return dateCmp;
    return String(a.festival.id).localeCompare(String(b.festival.id));
  });
}

export async function GET(request: Request) {
  try {
    const auth = await resolveMobileRequestAuth(request);
    const authError = mobileAuthErrorResponse(auth);
    if (authError) return authError;

    const url = new URL(request.url);
    const page = pageFromSearch(url);
    const perSection = 8;

    const [pool, weekPool, trendingPool] = await Promise.all([
      getFestivals({ when: "all" }, 1, 120, { listingSort: "trending" }),
      getFestivals({ when: "this_week" }, 1, 60, { listingSort: "trending" }),
      getFestivals({ when: "all" }, 1, 40, { listingSort: "popular" }),
    ]);

    const all = pool.data;
    const week = weekPool.data;
    const trending = trendingPool.data;
    const trendingMax = Math.max(...all.map((f) => Number((f as { saves_count?: number }).saves_count ?? 0)), 1);

    const followedCities = new Set<string>();
    const followedCategories = new Set<string>();
    const followedOrganizers = new Set<string>();
    let recentlyViewed = new Set<string>();

    if (auth.user) {
      const [cityRows, categoryRows, organizerRows, viewedIds] = await Promise.all([
        auth.supabase.from("user_followed_cities").select("city_slug").eq("user_id", auth.user.id).limit(200),
        auth.supabase.from("user_followed_categories").select("category_slug").eq("user_id", auth.user.id).limit(200),
        auth.supabase.from("user_followed_organizers").select("organizer_id").eq("user_id", auth.user.id).limit(200),
        loadRecentlyViewedFestivalIds(auth.user.id),
      ]);
      for (const row of cityRows.data ?? []) {
        const key = typeof row.city_slug === "string" ? row.city_slug.trim().toLowerCase() : "";
        if (key) followedCities.add(key);
      }
      for (const row of categoryRows.data ?? []) {
        const key = typeof row.category_slug === "string" ? row.category_slug.trim().toLowerCase() : "";
        if (key) followedCategories.add(key);
      }
      for (const row of organizerRows.data ?? []) {
        const key = typeof row.organizer_id === "string" ? row.organizer_id.trim() : "";
        if (key) followedOrganizers.add(key);
      }
      recentlyViewed = viewedIds;
    }

    const nowIsoDate = new Date().toISOString().slice(0, 10);
    const scored = all.map((festival) =>
      scoreFestivalForUser(festival, {
        followedOrganizerIds: followedOrganizers,
        followedCities,
        followedCategories,
        recentlyViewedFestivalIds: recentlyViewed,
        trendingMax,
        nowIsoDate,
      }),
    );

    const seen = new Set<string>();
    const toSerialized = (items: ScoredFestival[]) =>
      items.map((entry) => serializeMobileFestivalListItem(entry.festival, false));
    const takeUnique = (items: ScoredFestival[]): ScoredFestival[] => {
      const out: ScoredFestival[] = [];
      for (const item of items) {
        const id = String(item.festival.id);
        if (seen.has(id)) continue;
        seen.add(id);
        out.push(item);
      }
      return out;
    };

    const forYouAll = sortStable(scored);
    const nearYouAll = sortStable(scored.filter((row) => followedCities.has(String(row.festival.city_slug ?? "").toLowerCase())));
    const fromFollowedAll = sortStable(
      scored.filter((row) => {
        const orgId = row.festival.organizer_id ? String(row.festival.organizer_id).trim() : "";
        return orgId ? followedOrganizers.has(orgId) : false;
      }),
    );
    const trendingAll = sortStable(
      trending.map((festival) =>
        scoreFestivalForUser(festival, {
          followedOrganizerIds: followedOrganizers,
          followedCities,
          followedCategories,
          recentlyViewedFestivalIds: recentlyViewed,
          trendingMax,
          nowIsoDate,
        }),
      ),
    );
    const weekendAll = sortStable(
      week.map((festival) =>
        scoreFestivalForUser(festival, {
          followedOrganizerIds: followedOrganizers,
          followedCities,
          followedCategories,
          recentlyViewedFestivalIds: recentlyViewed,
          trendingMax,
          nowIsoDate,
        }),
      ),
    );

    const sections: SectionPayload[] = [
      { key: "for_you", title: "For You", items: toSerialized(takeUnique(chunkForPage(forYouAll, page, perSection))) },
      { key: "near_you", title: "Near You", items: toSerialized(takeUnique(chunkForPage(nearYouAll, page, perSection))) },
      { key: "trending", title: "Trending", items: toSerialized(takeUnique(chunkForPage(trendingAll, page, perSection))) },
      { key: "this_weekend", title: "This Weekend", items: toSerialized(takeUnique(chunkForPage(weekendAll, page, perSection))) },
      {
        key: "from_followed_organizers",
        title: "From Organizers You Follow",
        items: toSerialized(takeUnique(chunkForPage(fromFollowedAll, page, perSection))),
      },
    ].filter((section) => section.items.length > 0);

    return NextResponse.json({ page, per_section: perSection, sections });
  } catch (error) {
    console.error("[api/mobile/recommendations]", error);
    return NextResponse.json({ error: "Failed to load recommendations" }, { status: 500 });
  }
}
