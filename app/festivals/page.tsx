import Link from "next/link";
import { addDays, format, nextSaturday, parseISO } from "date-fns";
import {
  listPublicFestivalCategorySlugs,
  listPublicFestivalCategorySlugsSortedByActiveCount,
} from "@/lib/festivals/publicCategories.server";
import FestivalsTagChipsClient from "@/components/FestivalsTagChipsClient";
import ScrollRestoration from "@/components/ScrollRestoration";
import Container from "@/components/ui/Container";
import EventCard from "@/components/ui/EventCard";
import Section from "@/components/ui/Section";
import { getFestivalHeroImage } from "@/lib/festival/getFestivalHeroImage";
import { getBaseUrl, listMeta } from "@/lib/seo";
import { fixFestivalText } from "@/lib/queries";
import { festivalCityLabel } from "@/lib/settlements/formatDisplayName";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Festival } from "@/lib/types";
import { sortFestivalsForListing } from "@/lib/festival/sorting";
import { hasActivePromotion, hasActiveVip } from "@/lib/monetization";
import { buildFestivalsTagOrFilter } from "@/lib/festivals/buildFestivalsTagOrFilter";
import "../landing.css";

export const revalidate = 3600;

const FESTIVAL_SELECT =
  "id,title,slug,city_id,city,start_date,end_date,occurrence_dates,category,hero_image,image_url,is_free,status,is_verified,promotion_status,promotion_started_at,promotion_expires_at,promotion_rank,lat,lng,description,ticket_url,price_range,festival_media(url,type,sort_order),cities:cities!left(slug,name_bg,is_village),organizer:organizers!left(id,name,slug,plan,plan_started_at,plan_expires_at,organizer_rank)";
const PAGE_SIZE = 12;
const HAS_TAGS_COLUMN = true;

type FestivalWithCity = Festival & {
  cities?: {
    slug?: string | null;
    name_bg?: string | null;
    is_village?: boolean | null;
  } | null;
};

type PageSearchParams = Record<string, string | string[] | undefined>;

type DateRange = {
  start: string;
  end: string;
  mode: "month" | "day";
};

function getParam(searchParams: PageSearchParams, key: string): string | undefined {
  const value = searchParams[key];
  if (Array.isArray(value)) {
    return value[0];
  }
  return typeof value === "string" ? value : undefined;
}

function toUtcDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDateFilter(value: string | undefined): DateRange | null {
  if (!value) {
    return null;
  }

  const monthMatch = value.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]);
    if (month < 1 || month > 12) {
      return null;
    }

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 1));

    return {
      start: toUtcDateString(startDate),
      end: toUtcDateString(endDate),
      mode: "month",
    };
  }

  const dayMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dayMatch) {
    return null;
  }

  const year = Number(dayMatch[1]);
  const month = Number(dayMatch[2]);
  const day = Number(dayMatch[3]);

  const startDate = new Date(Date.UTC(year, month - 1, day));
  if (
    startDate.getUTCFullYear() !== year ||
    startDate.getUTCMonth() !== month - 1 ||
    startDate.getUTCDate() !== day
  ) {
    return null;
  }

  const endDate = new Date(Date.UTC(year, month - 1, day + 1));

  return {
    start: toUtcDateString(startDate),
    end: toUtcDateString(endDate),
    mode: "day",
  };
}

function buildFestivalsHref(params: {
  city?: string;
  date?: string;
  tag?: string;
  page?: number;
}) {
  const query = new URLSearchParams();

  if (params.city) query.set("city", params.city);
  if (params.date) query.set("date", params.date);
  if (params.tag) query.set("tag", params.tag);
  if (params.page && params.page > 1) query.set("page", String(params.page));

  const suffix = query.toString();
  return suffix ? `/festivals?${suffix}` : "/festivals";
}

export async function generateMetadata() {
  const meta = listMeta();
  return {
    ...meta,
    title: "Фестивали в България | Festivo",
    description: "Открий безплатни фестивали и събития в България по град, категория и дата.",
    alternates: {
      canonical: `${getBaseUrl()}/festivals`,
    },
  };
}

export default async function FestivalsPage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  const city = getParam(searchParams, "city");
  const date = getParam(searchParams, "date");
  const tag = getParam(searchParams, "tag");
  const parsedDate = parseDateFilter(date);

  const pageRaw = Number(getParam(searchParams, "page") ?? "1");
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE;

  let festivals: FestivalWithCity[] = [];
  let total = 0;
  let totalPages = 1;
  let queryError: string | null = null;

  const popularCategoryChips = await listPublicFestivalCategorySlugsSortedByActiveCount().catch(() =>
    listPublicFestivalCategorySlugs()
  );

  try {
    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("festivals")
      .select(FESTIVAL_SELECT, { count: "exact" })
      .or("status.eq.published,status.eq.verified,is_verified.eq.true")
      .neq("status", "archived");

    if (city) {
      query = query.eq("cities.slug", city);
    }

    if (parsedDate) {
      const rangeEndInclusive =
        parsedDate.mode === "day"
          ? parsedDate.start
          : format(addDays(parseISO(parsedDate.end), -1), "yyyy-MM-dd");
      const { data: rangeIds, error: rangeRpcError } = await supabase.rpc("festivals_intersecting_range", {
        p_from: parsedDate.start,
        p_to: rangeEndInclusive,
      });
      if (!rangeRpcError && Array.isArray(rangeIds) && rangeIds.length > 0) {
        const ids = rangeIds
          .map((row: { festival_id?: string }) => (typeof row?.festival_id === "string" ? row.festival_id : ""))
          .filter(Boolean);
        query = query.in("id", ids);
      } else if (!rangeRpcError && Array.isArray(rangeIds) && rangeIds.length === 0) {
        query = query.eq("id", "00000000-0000-0000-0000-000000000001");
      } else {
        query = query.gte("start_date", parsedDate.start).lt("start_date", parsedDate.end);
      }
    }

    if (tag) {
      query = HAS_TAGS_COLUMN ? query.or(buildFestivalsTagOrFilter(tag)) : query.eq("category", tag);
    }

    if (!city && !parsedDate && !tag) {
      const now = new Date();
      const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const todayStr = toUtcDateString(todayUtc);
      const { data: upcomingIds, error: upcomingRpcError } = await supabase.rpc("festivals_intersecting_range", {
        p_from: todayStr,
        p_to: "2099-12-31",
      });
      if (!upcomingRpcError && Array.isArray(upcomingIds) && upcomingIds.length > 0) {
        const ids = upcomingIds
          .map((row: { festival_id?: string }) => (typeof row?.festival_id === "string" ? row.festival_id : ""))
          .filter(Boolean);
        query = query.in("id", ids);
      } else if (!upcomingRpcError && Array.isArray(upcomingIds) && upcomingIds.length === 0) {
        query = query.eq("id", "00000000-0000-0000-0000-000000000001");
      } else {
        query = query.gte("start_date", todayStr);
      }
    }

    const { data, count, error } = await query.returns<FestivalWithCity[]>();

    if (error) {
      console.error("[festivals/page] Supabase festivals query failed", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        tag: tag ?? null,
      });
      queryError = [error.message, error.details, error.hint].filter(Boolean).join(" — ") || JSON.stringify(error);
    } else {
      const normalized = (data ?? []).map((row) => fixFestivalText(row as Festival));
      const sorted = sortFestivalsForListing(normalized);
      festivals = sorted.slice(from, to);
      total = count ?? 0;
      totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    }
  } catch (error) {
    console.error("[festivals/page] festivals query threw", error);
    queryError = error instanceof Error ? error.message : "Unknown error";
  }

  const activeFiltersCount = Number(Boolean(city)) + Number(Boolean(parsedDate)) + Number(Boolean(tag));
  const clearHref = "/festivals";

  const today = new Date();
  const weekendDate = format(nextSaturday(today), "yyyy-MM-dd");
  const monthDate = format(today, "yyyy-MM");

  const weekendLink = buildFestivalsHref({ city, date: weekendDate, tag });
  const monthLink = buildFestivalsHref({ city, date: monthDate, tag });
  const visiblePages = Array.from({ length: totalPages }).slice(0, 5);

  return (
    <div className="landing-bg overflow-x-hidden text-[#0c0e14]">
        <ScrollRestoration />
        <Section className="overflow-x-clip bg-transparent pb-8 pt-8 md:pb-10 md:pt-10">
          <Container>
            <div className="space-y-7 lg:space-y-8">
              <div className="rounded-[28px] border border-black/[0.08] bg-white/75 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_12px_30px_rgba(12,14,20,0.08)] backdrop-blur md:p-7">
                <div className="max-w-3xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">Festivo Explorer</p>
                  <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Фестивали в България</h1>
                  <p className="mt-3 text-sm text-black/65 md:text-[15px]">
                    Открий безплатни фестивали и събития в България по град, категория и дата.
                  </p>
                </div>

                <div className="mt-5 flex flex-wrap gap-2 md:mt-6">
                  <Link
                    href={weekendLink}
                    scroll={false}
                    className="rounded-full border border-black/[0.1] bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] transition hover:border-black/20 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                  >
                    Този уикенд
                  </Link>
                  <Link
                    href={monthLink}
                    scroll={false}
                    className="rounded-full border border-black/[0.1] bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] transition hover:border-black/20 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                  >
                    Този месец
                  </Link>
                  <FestivalsTagChipsClient categories={popularCategoryChips} />
                </div>
              </div>

              <div className="min-w-0 space-y-5">
                <div className="flex flex-col gap-3 rounded-2xl border border-black/[0.08] bg-white/80 p-4 shadow-[0_2px_0_rgba(12,14,20,0.05),0_8px_22px_rgba(12,14,20,0.07)] backdrop-blur md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-wrap items-center gap-3 text-sm text-black/70">
                    <p className="font-semibold text-[#0c0e14]">Намерени: {total} фестивала</p>
                    <span className="text-black/35">•</span>
                    <p>
                      Active filters: <span className="font-semibold text-[#0c0e14]">{activeFiltersCount}</span>
                    </p>
                    <Link
                      href={clearHref}
                      scroll={false}
                      className="rounded-full border border-black/[0.1] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#0c0e14] transition hover:border-black/20 hover:bg-[#f8f7f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                    >
                      Изчисти
                    </Link>
                  </div>
                </div>

                {queryError ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-800">
                    <p>Възникна грешка при зареждане на фестивалите. Опитайте отново.</p>
                    <p className="mt-2 break-words font-mono text-xs text-red-700">{queryError}</p>
                  </div>
                ) : null}

                {!queryError && festivals.length === 0 ? (
                  <div className="rounded-2xl border border-black/[0.08] bg-white/80 px-6 py-12 text-center shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.06)]">
                    <p className="text-base font-semibold text-[#0c0e14]">Няма фестивали по тези филтри.</p>
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                      <Link
                        href={clearHref}
                        scroll={false}
                        className="rounded-xl bg-[#0c0e14] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-white transition hover:bg-[#1d202b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                      >
                        Изчисти филтрите
                      </Link>
                      <Link
                        href="/festivals"
                        scroll={false}
                        className="rounded-xl border border-black/[0.1] bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-[#0c0e14] transition hover:border-black/20 hover:bg-[#faf9f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                      >
                        Виж всички
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-5 sm:grid-cols-2 xl:gap-6">
                    {festivals.map((festival) => (
                      <EventCard
                        key={festival.slug}
                        title={festival.title}
                        city={festivalCityLabel(festival)}
                        category={festival.category}
                        imageUrl={getFestivalHeroImage(festival)}
                        startDate={festival.start_date}
                        endDate={festival.end_date}
                        isFree={festival.is_free}
                        isPromoted={hasActivePromotion(festival)}
                        isVipOrganizer={hasActiveVip(festival.organizer)}
                        description={festival.description}
                        showDescription
                        showDetailsButton
                        detailsHref={`/festivals/${festival.slug}`}
                        showPlanControls
                        festivalId={festival.id}
                      />
                    ))}
                  </div>
                )}

                {totalPages > 1 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {visiblePages.map((_, index) => {
                      const pageNumber = index + 1;
                      return (
                        <Link
                          key={pageNumber}
                          href={buildFestivalsHref({ city, date, tag, page: pageNumber })}
                          scroll={false}
                          className={`rounded-full border border-black/[0.1] px-4 py-2 text-sm transition hover:border-black/20 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25 ${
                            pageNumber === page
                              ? "border-[#0c0e14] bg-[#0c0e14] text-white hover:bg-[#0c0e14]"
                              : "bg-white/80 text-[#0c0e14]"
                          }`}
                        >
                          {pageNumber}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          </Container>
        </Section>
      </div>
  );
}
