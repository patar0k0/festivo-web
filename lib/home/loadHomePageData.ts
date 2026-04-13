import { serializeFilters, withDefaultFilters } from "@/lib/filters";
import { labelForPublicCategory } from "@/lib/festivals/publicCategories";
import { listPublicFestivalCategorySlugs } from "@/lib/festivals/publicCategories.server";
import { sortFestivalsForListing } from "@/lib/festival/sorting";
import { sofiaWallClockNow } from "@/lib/festival/temporal";
import { festivalDiscoveryCalendarBounds } from "@/lib/home/festivalDiscoveryBounds";
import { FESTIVAL_SELECT_MIN, fixFestivalText } from "@/lib/queries";
import { festivalSettlementDisplayText } from "@/lib/settlements/formatDisplayName";
import { fixMojibakeBG } from "@/lib/text/fixMojibake";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Festival } from "@/lib/types";

export type HomeCityOption = {
  name: string;
  slug: string | null;
  /** `cities.slug` — стойност за `?city=` на началната страница. */
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
  return [
    { label: "Само безплатни", href: `/festivals${serializeFilters(withDefaultFilters({ free: true }))}` },
    { label: "Този уикенд", href: `/festivals${serializeFilters(withDefaultFilters({ from: weekendStart, to: weekendEnd }))}` },
    { label: "Този месец", href: `/festivals${serializeFilters(withDefaultFilters({ from: monthStart, to: monthEnd }))}` },
    ...categorySlugs.slice(0, 5).map((slug) => ({
      label: labelForPublicCategory(slug),
      href: `/festivals?tag=${encodeURIComponent(slug)}`,
    })),
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

async function fetchHomeFestivals(params: {
  from: string;
  to?: string;
  citySlug?: string;
  limit?: number;
}): Promise<Festival[]> {
  const supabase = await createSupabaseServerClient();
  const limit = params.limit ?? 6;

  let query = supabase
    .from("festivals")
    .select(FESTIVAL_SELECT_MIN)
    .or("status.eq.published,status.eq.verified,is_verified.eq.true")
    .neq("status", "archived")
    .order("start_date", { ascending: true })
    .limit(limit);

  if (params.citySlug) {
    query = query.eq("cities.slug", params.citySlug);
  }

  const rangeTo = params.to ?? "2099-12-31";
  const { data: rangeIds, error: rangeRpcError } = await supabase.rpc("festivals_intersecting_range", {
    p_from: params.from,
    p_to: rangeTo,
  });

  if (!rangeRpcError && Array.isArray(rangeIds) && rangeIds.length > 0) {
    const ids = rangeIds
      .map((row: { festival_id?: string }) => (typeof row?.festival_id === "string" ? row.festival_id : ""))
      .filter(Boolean);
    query = query.in("id", ids);
  } else if (!rangeRpcError && Array.isArray(rangeIds) && rangeIds.length === 0) {
    query = query.eq("id", "00000000-0000-0000-0000-000000000001");
  } else if (params.to) {
    query = query.lte("start_date", params.to).or(`end_date.gte.${params.from},and(end_date.is.null,start_date.gte.${params.from})`);
  } else {
    query = query.or(`start_date.gte.${params.from},end_date.gte.${params.from}`);
  }

  const { data, error } = await query.returns<Festival[]>();
  if (error) {
    return [];
  }
  return (data ?? []).map(fixFestivalText);
}

function effectiveEndYmdForCurrentRow(f: Festival): string {
  const end = f.end_date?.trim();
  if (end) return end;
  return f.start_date?.trim() || "9999-12-31";
}

/** DB: start_date <= today AND coalesce(end_date, start_date) >= today; then sort by effective end ascending. */
function sortCurrentFestivalsForHome(festivals: Festival[]): Festival[] {
  return [...festivals].sort((a, b) => effectiveEndYmdForCurrentRow(a).localeCompare(effectiveEndYmdForCurrentRow(b)));
}

type CityJoinRow = { slug: string | null; name_bg: string | null; is_village: boolean | null };

function normalizeFestivalCityJoin(
  raw: CityJoinRow | CityJoinRow[] | null | undefined,
): CityJoinRow | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

async function fetchPublishedFestivalsTotalCount(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("festivals")
    .select("*", { count: "exact", head: true })
    .or("status.eq.published,status.eq.verified,is_verified.eq.true")
    .neq("status", "archived");

  if (error) {
    console.error("[loadHomePageData] fetchPublishedFestivalsTotalCount", error);
    throw new Error(`fetchPublishedFestivalsTotalCount: ${error.message}`);
  }
  return count ?? 0;
}

/** Населени места от `cities` с поне един публикуван фестивал (`city_id`); сортиране по брой DESC. */
async function fetchHomePublishedCityOptionsWithCounts(): Promise<HomeCityOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("festivals")
    .select("cities:cities!inner(slug,name_bg,is_village)")
    .or("status.eq.published,status.eq.verified,is_verified.eq.true")
    .neq("status", "archived")
    .not("city_id", "is", null)
    .returns<Array<{ cities: CityJoinRow | CityJoinRow[] | null }>>();

  if (error) {
    console.error("[loadHomePageData] fetchHomePublishedCityOptionsWithCounts", error);
    throw new Error(`fetchHomePublishedCityOptionsWithCounts: ${error.message}`);
  }

  const map = new Map<string, { name: string; slug: string | null; publishedFestivalCount: number }>();

  for (const row of data ?? []) {
    const joined = normalizeFestivalCityJoin(row.cities);
    const slug = joined?.slug?.trim();
    if (!joined || !slug) continue;

    const displayName =
      festivalSettlementDisplayText(joined.name_bg, joined.is_village) ?? fixMojibakeBG(joined.name_bg ?? slug);

    const existing = map.get(slug);
    if (!existing) {
      map.set(slug, { name: displayName, slug, publishedFestivalCount: 1 });
    } else {
      existing.publishedFestivalCount += 1;
      existing.name = displayName;
    }
  }

  return Array.from(map.entries())
    .map(([filterValue, v]) => ({
      filterValue,
      name: v.name,
      slug: v.slug,
      publishedFestivalCount: v.publishedFestivalCount,
    }))
    .filter((row) => row.publishedFestivalCount > 0)
    .sort((a, b) => {
      const byCount = b.publishedFestivalCount - a.publishedFestivalCount;
      if (byCount !== 0) return byCount;
      return a.name.localeCompare(b.name, "bg");
    });
}

async function fetchCurrentFestivals(params: { today: string; citySlug?: string }): Promise<Festival[]> {
  const supabase = await createSupabaseServerClient();
  const { today, citySlug } = params;

  let query = supabase
    .from("festivals")
    .select(FESTIVAL_SELECT_MIN)
    .or("status.eq.published,status.eq.verified,is_verified.eq.true")
    .neq("status", "archived")
    .lte("start_date", today)
    .or(`end_date.gte.${today},and(end_date.is.null,start_date.gte.${today})`);

  if (citySlug) {
    query = query.eq("cities.slug", citySlug);
  }

  const { data, error } = await query.limit(100).returns<Festival[]>();

  if (error) {
    console.error("[loadHomePageData] fetchCurrentFestivals", error);
    throw new Error(`fetchCurrentFestivals: ${error.message}`);
  }

  const rows = (data ?? []).map(fixFestivalText);
  return sortCurrentFestivalsForHome(rows).slice(0, 6);
}

/**
 * Same queries and derived hrefs as the public home page (`app/page.tsx`).
 */
export async function loadHomePageData(citySlug: string | undefined): Promise<HomePageViewProps> {
  const today = sofiaWallClockNow().ymd;
  const { weekendStart, weekendEnd, monthStart, monthEnd } = festivalDiscoveryCalendarBounds(today);

  const [nearestFestivalsRaw, currentFestivals, weekendFestivalsRaw, monthFestivalsRaw, totalFestivalsCount, citiesResult, categorySlugs] =
    await Promise.all([
      fetchHomeFestivals({ from: today, citySlug, limit: 6 }),
      fetchCurrentFestivals({ today, citySlug }),
      fetchHomeFestivals({ from: weekendStart, to: weekendEnd, citySlug, limit: 6 }),
      fetchHomeFestivals({ from: monthStart, to: monthEnd, citySlug, limit: 6 }),
      fetchPublishedFestivalsTotalCount(),
      fetchHomePublishedCityOptionsWithCounts(),
      listPublicFestivalCategorySlugs().catch(() => [] as string[]),
    ]);

  const selectedCityName = citySlug
    ? (citiesResult.find((item) => item.slug === citySlug)?.name ?? null)
    : null;

  const chipLinks = buildFestivalsQuickChipLinks(categorySlugs);
  const quickChipHrefs: HomeQuickChipHrefs = {
    free: chipLinks[0]!.href,
    weekend: chipLinks[1]!.href,
    month: chipLinks[2]!.href,
    categoryChips: chipLinks.slice(3),
  };

  const currentIds = new Set(currentFestivals.map((f) => f.id));
  const nearestFestivals = sortFestivalsForListing(
    nearestFestivalsRaw.filter((f) => !currentIds.has(f.id)),
  );
  const weekendFestivals = sortFestivalsForListing(weekendFestivalsRaw);
  const monthFestivals = sortFestivalsForListing(monthFestivalsRaw);

  return {
    nearestFestivals,
    currentFestivals,
    weekendFestivals,
    monthFestivals,
    homeCityOptions: citiesResult,
    totalFestivalsCount,
    selectedCityName,
    quickChipHrefs,
  };
}
