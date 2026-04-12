import Link from "next/link";
import { addDays, format, nextSaturday, nextSunday, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { pub } from "@/lib/public-ui/styles";
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
import { calendarYmdToUtcNoon, getFestivalTemporalState, sofiaWallClockNow } from "@/lib/festival/temporal";
import type { FestivalWhenFilter } from "@/lib/types";
import { hasActivePromotion, hasActiveVip } from "@/lib/monetization";
import { buildFestivalsTagOrFilter } from "@/lib/festivals/buildFestivalsTagOrFilter";

export const revalidate = 3600;

const FESTIVAL_SELECT =
  "id,title,slug,city_id,city,start_date,end_date,start_time,end_time,occurrence_dates,category,hero_image,image_url,is_free,status,is_verified,promotion_status,promotion_started_at,promotion_expires_at,promotion_rank,lat,lng,description,ticket_url,price_range,festival_media(url,type,sort_order),cities:cities!left(slug,name_bg,is_village),organizer:organizers!left(id,name,slug,plan,plan_started_at,plan_expires_at,organizer_rank)";
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

/** Extra `when` values beyond `FestivalWhenFilter` (listing-only query semantics). */
type FestivalsPageWhen = FestivalWhenFilter | "now" | "weekend";

type DateRange = {
  start: string;
  end: string;
  mode: "month" | "day";
};

function escapePostgrestLikeValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/,/g, "\\,")
    .replace(/\./g, "\\.");
}

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
  q?: string;
  city?: string;
  date?: string;
  tag?: string;
  when?: FestivalsPageWhen;
  page?: number;
}) {
  const query = new URLSearchParams();

  if (params.q) query.set("q", params.q);
  if (params.city) query.set("city", params.city);
  if (params.date) query.set("date", params.date);
  if (params.tag) query.set("tag", params.tag);
  if (params.when && params.when !== "all") query.set("when", params.when);
  if (params.page && params.page > 1) query.set("page", String(params.page));

  const suffix = query.toString();
  return suffix ? `/festivals?${suffix}` : "/festivals";
}

function parseWhenFilter(raw: string | undefined): FestivalsPageWhen {
  if (raw === "now") return "now";
  if (raw === "weekend") return "weekend";
  if (raw === "upcoming" || raw === "ongoing" || raw === "past" || raw === "all") {
    return raw;
  }
  return "all";
}

/** Friday–Sunday of the same calendar weekend as `nextSaturday(anchor)` (Sofia “today” anchor). */
function nextWeekendFridaySundayInclusive(todayYmd: string): { fri: string; sun: string } {
  const anchor = calendarYmdToUtcNoon(todayYmd);
  const sat = format(nextSaturday(anchor), "yyyy-MM-dd");
  const sun = format(nextSunday(anchor), "yyyy-MM-dd");
  const fri = format(addDays(calendarYmdToUtcNoon(sat), -1), "yyyy-MM-dd");
  return { fri, sun };
}

function festivalOverlapsWallClockYmdOnStartEndColumns(
  f: FestivalWithCity,
  todayYmd: string,
): boolean {
  const start = f.start_date?.trim();
  if (!start) return false;
  const end = f.end_date?.trim() || start;
  return start <= todayYmd && end >= todayYmd;
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
  const q = getParam(searchParams, "q")?.trim() ?? "";
  const city = getParam(searchParams, "city");
  const date = getParam(searchParams, "date");
  const tag = getParam(searchParams, "tag");
  const when = parseWhenFilter(getParam(searchParams, "when"));
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
      .select(FESTIVAL_SELECT)
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

    if (q) {
      const textFilter = `%${escapePostgrestLikeValue(q)}%`;
      query = query.or(
        `title.ilike.${textFilter},description.ilike.${textFilter},location_name.ilike.${textFilter},organizer_name.ilike.${textFilter}`,
      );
    }

    const { data, error } = await query.returns<FestivalWithCity[]>();

    if (error) {
      console.error("[festivals/page] Supabase festivals query failed", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        q: q || null,
        tag: tag ?? null,
      });
      queryError = [error.message, error.details, error.hint].filter(Boolean).join(" — ") || JSON.stringify(error);
    } else {
      const normalized = (data ?? []).map((row) => fixFestivalText(row as Festival));
      const todayYmd = sofiaWallClockNow().ymd;
      const { fri: weekendFri, sun: weekendSun } = nextWeekendFridaySundayInclusive(todayYmd);

      let scoped: FestivalWithCity[];
      if (when === "now") {
        scoped = normalized.filter((f) => festivalOverlapsWallClockYmdOnStartEndColumns(f, todayYmd));
      } else if (when === "weekend") {
        scoped = normalized.filter((f) => {
          const sd = f.start_date?.trim();
          if (!sd) return false;
          return sd >= weekendFri && sd <= weekendSun;
        });
      } else if (when === "upcoming") {
        scoped = normalized.filter((f) => {
          const sd = f.start_date?.trim();
          if (!sd) return false;
          return sd >= todayYmd;
        });
      } else if (when !== "all") {
        scoped = normalized.filter((f) => getFestivalTemporalState(f) === when);
      } else {
        scoped = normalized;
      }

      const sorted =
        when === "upcoming"
          ? [...scoped].sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""))
          : sortFestivalsForListing(scoped);
      festivals = sorted.slice(from, to);
      total = sorted.length;
      totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    }
  } catch (error) {
    console.error("[festivals/page] festivals query threw", error);
    queryError = error instanceof Error ? error.message : "Unknown error";
  }

  const activeFiltersCount =
    Number(Boolean(q)) +
    Number(Boolean(city)) +
    Number(Boolean(parsedDate)) +
    Number(Boolean(tag)) +
    Number(when !== "all");
  const clearHref = "/festivals";

  const todayYmd = sofiaWallClockNow().ymd;
  const sofiaAnchor = calendarYmdToUtcNoon(todayYmd);
  const monthDate = format(sofiaAnchor, "yyyy-MM");

  const weekendLink = buildFestivalsHref({ q, city, tag, when: "weekend" });
  const monthLink = buildFestivalsHref({ q, city, date: monthDate, tag, when });
  const visiblePages = Array.from({ length: totalPages }).slice(0, 5);

  return (
    <div className={pub.pageOverflow}>
        <ScrollRestoration />
        <Section className={pub.sectionLoose}>
          <Container>
            <div className={pub.stackLg}>
              <div className={pub.panelHero}>
                <div className="max-w-3xl">
                  <p className={pub.eyebrowMuted}>Festivo Explorer</p>
                  <h1 className={cn(pub.pageTitle, "mt-2")}>Фестивали в България</h1>
                  <p className={cn(pub.body, "mt-3")}>
                    Открий безплатни фестивали и събития в България по град, категория и дата.
                  </p>
                </div>

                <div className="mt-5 flex flex-wrap gap-2 md:mt-6">
                  <Link
                    href={weekendLink}
                    scroll={false}
                    className={cn(pub.chip, pub.focusRing, when === "weekend" ? pub.chipActive : "")}
                  >
                    Този уикенд
                  </Link>
                  <Link
                    href={monthLink}
                    scroll={false}
                    className={cn(pub.chip, pub.focusRing)}
                  >
                    Този месец
                  </Link>
                  <FestivalsTagChipsClient categories={popularCategoryChips} />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="self-center text-xs font-semibold uppercase tracking-[0.12em] text-black/40">
                    Време
                  </span>
                  {(
                    [
                      { key: "all" as const, label: "Всички" },
                      { key: "now" as const, label: "В момента" },
                      { key: "ongoing" as const, label: "Текущи" },
                      { key: "upcoming" as const, label: "Предстоящи" },
                      { key: "past" as const, label: "Отминали" },
                    ] as const
                  ).map(({ key, label }) => (
                    <Link
                      key={key}
                      href={buildFestivalsHref({ q, city, date, tag, when: key })}
                      scroll={false}
                      className={cn(pub.chipSm, pub.focusRing, when === key ? pub.chipActive : "")}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="min-w-0 space-y-5">
                <div
                  className={cn(
                    pub.panelMuted,
                    "flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-3 text-sm text-black/70">
                    <p className="font-semibold text-[#0c0e14]">Намерени: {total} фестивала</p>
                    <span className="text-black/35">•</span>
                    <p>
                      Активни филтри: <span className="font-semibold text-[#0c0e14]">{activeFiltersCount}</span>
                    </p>
                    <Link
                      href={clearHref}
                      scroll={false}
                      className={cn(pub.chipSm, pub.focusRing)}
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
                  <div className={cn(pub.sectionCardSoft, "px-6 py-12 text-center")}>
                    <p className="text-base font-semibold text-[#0c0e14]">Няма фестивали по тези филтри.</p>
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                      <Link
                        href={clearHref}
                        scroll={false}
                        className={cn(pub.btnPrimarySm, pub.focusRing)}
                      >
                        Изчисти филтрите
                      </Link>
                      <Link
                        href="/festivals"
                        scroll={false}
                        className={cn(pub.btnSecondarySm, "px-5 py-2.5 uppercase tracking-[0.15em]", pub.focusRing)}
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
                        occurrenceDates={festival.occurrence_dates}
                        startTime={festival.start_time}
                        endTime={festival.end_time}
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
                          href={buildFestivalsHref({ q, city, date, tag, when, page: pageNumber })}
                          scroll={false}
                          className={cn(
                            "rounded-full border border-black/[0.1] px-4 py-2 text-sm transition hover:border-black/20 hover:bg-white",
                            pub.focusRing,
                            pageNumber === page
                              ? cn(pub.chipActive, "normal-case tracking-normal")
                              : "bg-white/80 text-[#0c0e14]",
                          )}
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
