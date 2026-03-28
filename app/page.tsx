import type { Metadata } from "next";
import { cookies } from "next/headers";
import { endOfMonth, format, nextSaturday, nextSunday, startOfMonth } from "date-fns";
import ComingSoonPublic from "@/components/home/ComingSoonPublic";
import RealHomePage from "@/components/home/RealHomePage";
import { serializeFilters, withDefaultFilters } from "@/lib/filters";
import { listHomeCitySelectOptions } from "@/lib/festivals";
import { labelForPublicCategory } from "@/lib/festivals/publicCategories";
import { listPublicFestivalCategorySlugs } from "@/lib/festivals/publicCategoriesServer";
import { FESTIVAL_SELECT_MIN, fixFestivalText } from "@/lib/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Festival } from "@/lib/types";
import "./landing.css";

const PREVIEW_COOKIE_NAME = "festivo_preview";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Festivo - Очаквайте скоро",
  description: "Festivo стартира скоро.",
  alternates: {
    canonical: "https://festivo.bg/",
  },
};

type HomeSearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string | undefined {
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

export default async function HomePage({
  searchParams,
}: {
  searchParams: HomeSearchParams;
}) {
  const cookieStore = await cookies();
  const previewCookie = cookieStore.get(PREVIEW_COOKIE_NAME)?.value;
  const hasPreviewAccess = Boolean(previewCookie);
  const comingSoonMode = process.env.FESTIVO_PUBLIC_MODE === "coming-soon";
  const city = firstParam(searchParams.city)?.trim();

  if (comingSoonMode && !hasPreviewAccess) {
    return <ComingSoonPublic />;
  }

  const today = format(new Date(), "yyyy-MM-dd");
  const weekendStart = format(nextSaturday(new Date()), "yyyy-MM-dd");
  const weekendEnd = format(nextSunday(new Date()), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

  const [nearestFestivals, weekendFestivals, citiesResult, categorySlugs] = await Promise.all([
    fetchHomeFestivals({ from: today, citySlug: city, limit: 6 }),
    fetchHomeFestivals({ from: weekendStart, to: weekendEnd, citySlug: city, limit: 6 }),
    listHomeCitySelectOptions().catch(() => []),
    listPublicFestivalCategorySlugs().catch(() => [] as string[]),
  ]);
  const selectedCityName = city
    ? (citiesResult.find((item) => item.slug === city)?.name ?? null)
    : null;

  const quickChipHrefs = {
    free: `/festivals${serializeFilters(withDefaultFilters({ free: true }))}`,
    weekend: `/festivals${serializeFilters(withDefaultFilters({ from: weekendStart, to: weekendEnd }))}`,
    month: `/festivals${serializeFilters(withDefaultFilters({ from: monthStart, to: monthEnd }))}`,
    categoryChips: categorySlugs.slice(0, 5).map((slug) => ({
      label: labelForPublicCategory(slug),
      href: `/festivals?tag=${encodeURIComponent(slug)}`,
    })),
  };

  return (
    <div className="mx-auto max-w-6xl px-4">
      <RealHomePage
        nearestFestivals={nearestFestivals}
        weekendFestivals={weekendFestivals}
        homeCityOptions={citiesResult}
        selectedCityName={selectedCityName}
        quickChipHrefs={quickChipHrefs}
      />
    </div>
  );
}
