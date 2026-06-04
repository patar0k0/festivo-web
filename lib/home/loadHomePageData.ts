import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { serializeFilters, withDefaultFilters } from "@/lib/filters";
import { labelForPublicCategory } from "@/lib/festivals/publicCategories";
import { sortFestivalsForListing } from "@/lib/festival/sorting";
import { sofiaWallClockNow } from "@/lib/festival/temporal";
import { festivalDiscoveryCalendarBounds } from "@/lib/home/festivalDiscoveryBounds";
import { FESTIVAL_SELECT_MIN, fixFestivalText } from "@/lib/queries";
import { getCityLabel } from "@/lib/settlements/getCityLabel";
import { fixMojibakeBG } from "@/lib/text/fixMojibake";
import { Festival } from "@/lib/types";

/**
 * Anon client за homepage данни. Използва публичния anon ключ вместо service role,
 * така homepage-ът не зависи от SUPABASE_SERVICE_ROLE_KEY.
 * Всички нужни таблици (festivals, cities, festival_categories) и
 * RPC festivals_intersecting_range са достъпни за anon role чрез RLS/GRANT.
 */
function createHomeSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Missing Supabase public env vars");
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...(init ?? {}), cache: "no-store" }) },
  });
}

export type HomeCityOption = {
  name: string;
  slug: string | null;
  /** Стойност за `?city=` на началната страница; филтрира се по `festivals.city_slug`. */
  filterValue: string;
  /** Брой публикувани фестивали за този `city_id` / slug. */
  publishedFestivalCount: number;
};

export type HomeQuickChipHrefs = {
  free: string;
  weekend: string;
  month: string;
  categoryChips: { label: string; href: string }[];
};

/** Same chip labels/hrefs as the home hero (for `/festivals` discovery UI). */
export function buildFestivalsQuickChipLinks(categorySlugs: string[]): Array<{ label: string; href: string }> {
  const { weekendStart, weekendEnd, monthStart, monthEnd } = festivalDiscoveryCalendarBounds();

  // Top 3 by active count are fixed; the rest are shuffled randomly each request.
  const top3 = categorySlugs.slice(0, 3);
  const rest = categorySlugs.slice(3);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j]!, rest[i]!];
  }
  const categoryChips = [...top3, ...rest.slice(0, 2)].map((slug) => ({
    label: labelForPublicCategory(slug),
    href: `/festivals?tag=${encodeURIComponent(slug)}`,
  }));

  return [
    { label: "Само безплатни", href: `/festivals${serializeFilters(withDefaultFilters({ free: true }))}` },
    { label: "Този уикенд", href: `/festivals${serializeFilters(withDefaultFilters({ from: weekendStart, to: weekendEnd }))}` },
    { label: "Този месец", href: `/festivals${serializeFilters(withDefaultFilters({ from: monthStart, to: monthEnd }))}` },
    ...categoryChips,
  ];
}

/** Props for the public home page (`RealHomePage`). */
export type HomePageViewProps = {
  nearestFestivals: Festival[];
  currentFestivals: Festival[];
  weekendFestivals: Festival[];
  monthFestivals: Festival[];
  homeCityOptions: HomeCityOption[];
  totalFestivalsCount: number;
  selectedCityName?: string | null;
  quickChipHrefs: HomeQuickChipHrefs;
};

export function firstHomeSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return typeof value === "string" ? value : undefined;
}

type CityJoinRow = { slug: string | null; name_bg: string | null; is_village: boolean | null };

function normalizeFestivalCityJoin(
  raw: CityJoinRow | CityJoinRow[] | null | undefined,
): CityJoinRow | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

function effectiveEndYmdForCurrentRow(f: Festival): string {
  const end = f.end_date?.trim();
  if (end) return end;
  return f.start_date?.trim() || "9999-12-31";
}

function sortCurrentFestivalsForHome(festivals: Festival[]): Festival[] {
  return [...festivals].sort((a, b) => effectiveEndYmdForCurrentRow(a).localeCompare(effectiveEndYmdForCurrentRow(b)));
}

type CachedDbData = {
  nearestFestivalsRaw: Festival[];
  currentFestivalsRaw: Festival[];
  weekendFestivalsRaw: Festival[];
  monthFestivalsRaw: Festival[];
  totalFestivalsCount: number;
  citiesResult: HomeCityOption[];
  categorySlugs: string[];
};

type HomeDbParams = {
  today: string;
  weekendStart: string;
  weekendEnd: string;
  monthStart: string;
  monthEnd: string;
  citySlug?: string;
};

/**
 * All DB queries for the homepage in a single function.
 * Uses the anon client so it works outside of a request context (no cookies needed).
 *
 * IMPORTANT: every query THROWS on a Supabase error instead of silently
 * returning 0/[]. This is deliberate — when wrapped in `unstable_cache`, a
 * rejected promise is NOT persisted, so a transient DB/network failure can no
 * longer freeze an empty homepage ("0 фестивала" + празно меню с места) for the
 * full 5-minute cache window. The caller retries uncached on throw.
 */
async function fetchHomeDbData(params: HomeDbParams): Promise<CachedDbData> {
    const { today, weekendStart, weekendEnd, monthEnd, citySlug } = params;
    const supabase = createHomeSupabaseClient();

    async function fetchFestivalsInRange(from: string, to?: string, limit = 6): Promise<Festival[]> {
      const rangeTo = to ?? "2099-12-31";
      const { data: rangeIds, error: rangeRpcError } = await supabase.rpc("festivals_intersecting_range", {
        p_from: from,
        p_to: rangeTo,
      });

      let query = supabase
        .from("festivals")
        .select(FESTIVAL_SELECT_MIN)
        .or("status.eq.published,status.eq.verified,is_verified.eq.true")
        .neq("status", "archived")
        .order("start_date", { ascending: true })
        .limit(limit);

      if (citySlug) query = query.eq("city_slug", citySlug.trim().toLowerCase());

      if (!rangeRpcError && Array.isArray(rangeIds) && rangeIds.length > 0) {
        const ids = rangeIds
          .map((row: { festival_id?: string }) => (typeof row?.festival_id === "string" ? row.festival_id : ""))
          .filter(Boolean);
        query = query.in("id", ids);
      } else if (!rangeRpcError && Array.isArray(rangeIds) && rangeIds.length === 0) {
        query = query.eq("id", "00000000-0000-0000-0000-000000000001");
      } else if (to) {
        query = query.lte("start_date", to).or(`end_date.gte.${from},and(end_date.is.null,start_date.gte.${from})`);
      } else {
        query = query.or(`start_date.gte.${from},end_date.gte.${from}`);
      }

      const { data, error } = await query.returns<Festival[]>();
      if (error) throw new Error(`[loadHomePageData] fetchFestivalsInRange error: ${error.message}`);
      return (data ?? []).map(fixFestivalText);
    }

    async function fetchCurrentFestivalsInner(): Promise<Festival[]> {
      let query = supabase
        .from("festivals")
        .select(FESTIVAL_SELECT_MIN)
        .or("status.eq.published,status.eq.verified,is_verified.eq.true")
        .neq("status", "archived")
        .lte("start_date", today)
        .or(`end_date.gte.${today},and(end_date.is.null,start_date.gte.${today})`);
      if (citySlug) query = query.eq("city_slug", citySlug.trim().toLowerCase());
      const { data, error } = await query.limit(100).returns<Festival[]>();
      if (error) throw new Error(`[loadHomePageData] fetchCurrentFestivals error: ${error.message}`);
      return sortCurrentFestivalsForHome((data ?? []).map(fixFestivalText)).slice(0, 6);
    }

    async function fetchTotalCount(): Promise<number> {
      const { count, error } = await supabase
        .from("festivals")
        .select("*", { count: "exact", head: true })
        .or("status.eq.published,status.eq.verified,is_verified.eq.true")
        .neq("status", "archived")
        // Include festivals that have no end_date (fall back to start_date).
        .or(`end_date.gte.${today},and(end_date.is.null,start_date.gte.${today})`);
      if (error) {
        throw new Error(`[loadHomePageData] fetchTotalCount error: ${error.message}`);
      }
      return count ?? 0;
    }

    async function fetchCities(): Promise<HomeCityOption[]> {
      const { data, error } = await supabase
        .from("festivals")
        .select("cities:cities!festivals_city_id_fkey(slug,name_bg,is_village)")
        .or("status.eq.published,status.eq.verified,is_verified.eq.true")
        .neq("status", "archived")
        .not("city_id", "is", null)
        // Include festivals that have no end_date (fall back to start_date).
        .or(`end_date.gte.${today},and(end_date.is.null,start_date.gte.${today})`)
        .returns<Array<{ cities: CityJoinRow | CityJoinRow[] | null }>>();
      if (error) {
        throw new Error(`[loadHomePageData] fetchCities error: ${error.message}`);
      }

      const map = new Map<string, { name: string; slug: string | null; publishedFestivalCount: number }>();
      for (const row of data ?? []) {
        const joined = normalizeFestivalCityJoin(row.cities);
        const slug = joined?.slug?.trim();
        if (!joined || !slug) continue;
        const displayName = getCityLabel({ name_bg: fixMojibakeBG(joined.name_bg ?? slug), is_village: joined.is_village });
        const existing = map.get(slug);
        if (!existing) map.set(slug, { name: displayName, slug, publishedFestivalCount: 1 });
        else { existing.publishedFestivalCount += 1; existing.name = displayName; }
      }
      return Array.from(map.entries())
        .map(([filterValue, v]) => ({ filterValue, name: v.name, slug: v.slug, publishedFestivalCount: v.publishedFestivalCount }))
        .filter((row) => row.publishedFestivalCount > 0)
        .sort((a, b) => {
          const byCount = b.publishedFestivalCount - a.publishedFestivalCount;
          return byCount !== 0 ? byCount : a.name.localeCompare(b.name, "bg");
        });
    }

    async function fetchCategorySlugs(): Promise<string[]> {
      const { data, error } = await supabase
        .from("festival_categories")
        .select("slug")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("slug", { ascending: true });
      if (error) return [];
      return (data ?? []).map((r) => r.slug as string);
    }

    const [nearestFestivalsRaw, currentFestivalsRaw, weekendFestivalsRaw, monthFestivalsRaw, totalFestivalsCount, citiesResult, categorySlugs] =
      await Promise.all([
        fetchFestivalsInRange(today, undefined, 6),
        fetchCurrentFestivalsInner(),
        fetchFestivalsInRange(weekendStart, weekendEnd, 6),
        fetchFestivalsInRange(today, monthEnd, 6),
        fetchTotalCount(),
        fetchCities(),
        fetchCategorySlugs(),
      ]);

    return { nearestFestivalsRaw, currentFestivalsRaw, weekendFestivalsRaw, monthFestivalsRaw, totalFestivalsCount, citiesResult, categorySlugs };
}

/**
 * Cached wrapper around {@link fetchHomeDbData}.
 * Cached for 5 minutes per {today, citySlug, weekendStart, weekendEnd, monthStart, monthEnd}.
 * A rejected promise is not persisted, so transient failures never poison the cache.
 */
const _loadDbDataCached = unstable_cache(fetchHomeDbData, ["home-page-db-data"], { revalidate: 300 });

/**
 * Same queries and derived hrefs as the public home page (`app/page.tsx`).
 */
export async function loadHomePageData(citySlug: string | undefined): Promise<HomePageViewProps> {
  const today = sofiaWallClockNow().ymd;
  const { weekendStart, weekendEnd, monthStart, monthEnd } = festivalDiscoveryCalendarBounds(today);
  const params: HomeDbParams = { today, weekendStart, weekendEnd, monthStart, monthEnd, citySlug };

  let dbData: CachedDbData;
  try {
    dbData = await _loadDbDataCached(params);
  } catch (cachedErr) {
    // A query failed during a cache miss. `unstable_cache` does NOT persist a
    // rejected promise, so the empty result is never frozen for 5 minutes.
    // Retry once uncached so this visitor still sees real data, and the next
    // request re-attempts the cache cleanly.
    console.error("[loadHomePageData] cached load failed, retrying uncached:", cachedErr);
    try {
      dbData = await fetchHomeDbData(params);
    } catch (uncachedErr) {
      console.error("[loadHomePageData] uncached load also failed; serving empty (not cached):", uncachedErr);
      dbData = {
        nearestFestivalsRaw: [],
        currentFestivalsRaw: [],
        weekendFestivalsRaw: [],
        monthFestivalsRaw: [],
        totalFestivalsCount: 0,
        citiesResult: [],
        categorySlugs: [],
      };
    }
  }

  const { nearestFestivalsRaw, currentFestivalsRaw, weekendFestivalsRaw, monthFestivalsRaw, totalFestivalsCount, citiesResult, categorySlugs } =
    dbData;

  const cityKey = citySlug?.trim().toLowerCase();
  const selectedCityName = cityKey
    ? (citiesResult.find((item) => item.slug?.trim().toLowerCase() === cityKey)?.name ?? null)
    : null;

  const chipLinks = buildFestivalsQuickChipLinks(categorySlugs);
  const quickChipHrefs: HomeQuickChipHrefs = {
    free: chipLinks[0]!.href,
    weekend: chipLinks[1]!.href,
    month: chipLinks[2]!.href,
    categoryChips: chipLinks.slice(3),
  };

  const currentIds = new Set(currentFestivalsRaw.map((f) => f.id));
  const nearestFestivals = sortFestivalsForListing(nearestFestivalsRaw.filter((f) => !currentIds.has(f.id)));
  const weekendFestivals = sortFestivalsForListing(weekendFestivalsRaw);
  const monthFestivals = sortFestivalsForListing(monthFestivalsRaw);

  return {
    nearestFestivals,
    currentFestivals: currentFestivalsRaw,
    weekendFestivals,
    monthFestivals,
    homeCityOptions: citiesResult,
    totalFestivalsCount,
    selectedCityName,
    quickChipHrefs,
  };
}
