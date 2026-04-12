import { format, nextSaturday, nextSunday, startOfMonth, endOfMonth } from "date-fns";
import { serializeFilters, withDefaultFilters } from "@/lib/filters";
import { listHomeCitySelectOptions } from "@/lib/festivals";
import { labelForPublicCategory } from "@/lib/festivals/publicCategories";
import { listPublicFestivalCategorySlugs } from "@/lib/festivals/publicCategories.server";
import { sortFestivalsForListing } from "@/lib/festival/sorting";
import { calendarYmdToUtcNoon, sofiaWallClockNow } from "@/lib/festival/temporal";
import { FESTIVAL_SELECT_MIN, fixFestivalText } from "@/lib/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Festival } from "@/lib/types";

export type HomeCityOption = {
  name: string;
  slug: string | null;
  filterValue: string;
};

export type HomeQuickChipHrefs = {
  free: string;
  weekend: string;
  month: string;
  categoryChips: { label: string; href: string }[];
};

/** Props for the public home page (`RealHomePage`). */
export type HomePageViewProps = {
  nearestFestivals: Festival[];
  weekendFestivals: Festival[];
  homeCityOptions: HomeCityOption[];
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
    query = query.eq("city_slug", params.citySlug);
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

/**
 * Same queries and derived hrefs as the public home page (`app/page.tsx`).
 */
export async function loadHomePageData(citySlug: string | undefined): Promise<HomePageViewProps> {
  const today = sofiaWallClockNow().ymd;
  const anchor = calendarYmdToUtcNoon(today);
  const weekendStart = format(nextSaturday(anchor), "yyyy-MM-dd");
  const weekendEnd = format(nextSunday(anchor), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(anchor), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(anchor), "yyyy-MM-dd");

  const [nearestFestivalsRaw, weekendFestivalsRaw, citiesResult, categorySlugs] = await Promise.all([
    fetchHomeFestivals({ from: today, citySlug, limit: 6 }),
    fetchHomeFestivals({ from: weekendStart, to: weekendEnd, citySlug, limit: 6 }),
    listHomeCitySelectOptions().catch(() => []),
    listPublicFestivalCategorySlugs().catch(() => [] as string[]),
  ]);

  const selectedCityName = citySlug
    ? (citiesResult.find((item) => item.slug === citySlug)?.name ?? null)
    : null;

  const quickChipHrefs: HomeQuickChipHrefs = {
    free: `/festivals${serializeFilters(withDefaultFilters({ free: true }))}`,
    weekend: `/festivals${serializeFilters(withDefaultFilters({ from: weekendStart, to: weekendEnd }))}`,
    month: `/festivals${serializeFilters(withDefaultFilters({ from: monthStart, to: monthEnd }))}`,
    categoryChips: categorySlugs.slice(0, 5).map((slug) => ({
      label: labelForPublicCategory(slug),
      href: `/festivals?tag=${encodeURIComponent(slug)}`,
    })),
  };

  const nearestFestivals = sortFestivalsForListing(nearestFestivalsRaw);
  const weekendFestivals = sortFestivalsForListing(weekendFestivalsRaw);

  return {
    nearestFestivals,
    weekendFestivals,
    homeCityOptions: citiesResult,
    selectedCityName,
    quickChipHrefs,
  };
}
