import Link from "next/link";
import { format, nextSaturday } from "date-fns";
import { festivalCategories } from "@/components/CategoryChips";
import FestivalsTagChipsClient from "@/components/FestivalsTagChipsClient";
import { PlanStateProvider } from "@/components/plan/PlanStateProvider";
import ScrollRestoration from "@/components/ScrollRestoration";
import Container from "@/components/ui/Container";
import EventCard from "@/components/ui/EventCard";
import Section from "@/components/ui/Section";
import { getOptionalUser } from "@/lib/authUser";
import { getPrimaryScheduleItemByFestivalIds, getPlanStateByUser } from "@/lib/plan/server";
import { getBaseUrl, listMeta } from "@/lib/seo";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Festival } from "@/lib/types";
import "../landing.css";

export const revalidate = 3600;

const FESTIVAL_SELECT =
  "id,title,slug,city,city_slug,region,start_date,end_date,category,image_url,is_free,status,is_verified,lat,lng,description,ticket_url,price_range";
const PAGE_SIZE = 12;
const HAS_TAGS_COLUMN = true;

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
  const to = from + PAGE_SIZE - 1;

  let festivals: Festival[] = [];
  let total = 0;
  let totalPages = 1;
  let queryError: string | null = null;

  try {
    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("festivals")
      .select(FESTIVAL_SELECT, { count: "exact" })
      .or("status.eq.published,status.eq.verified,is_verified.eq.true")
      .order("start_date", { ascending: true });

    if (city) {
      query = query.eq("city_slug", city);
    }

    if (parsedDate) {
      query = query.gte("start_date", parsedDate.start).lt("start_date", parsedDate.end);
    }

    if (tag) {
      query = HAS_TAGS_COLUMN ? query.contains("tags", [tag]) : query.eq("category", tag);
    }

    if (!city && !parsedDate && !tag) {
      const now = new Date();
      const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      query = query.gte("start_date", toUtcDateString(todayUtc));
    }

    const { data, count, error } = await query.range(from, to).returns<Festival[]>();

    if (error) {
      queryError = JSON.stringify(error, null, 2);
    } else {
      festivals = data ?? [];
      total = count ?? 0;
      totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    }
  } catch (error) {
    queryError = error instanceof Error ? error.message : "Unknown error";
  }

  const user = await getOptionalUser();
  const [planState, primaryScheduleByFestival] = await Promise.all([
    user ? getPlanStateByUser(user.id) : Promise.resolve({ scheduleItemIds: [], reminders: {} }),
    getPrimaryScheduleItemByFestivalIds(festivals.map((festival) => festival.id)),
  ]);

  const activeFiltersCount = Number(Boolean(city)) + Number(Boolean(parsedDate)) + Number(Boolean(tag));
  const clearHref = "/festivals";

  const today = new Date();
  const weekendDate = format(nextSaturday(today), "yyyy-MM-dd");
  const monthDate = format(today, "yyyy-MM");

  const freeLink = buildFestivalsHref({ city, date, tag });
  const weekendLink = buildFestivalsHref({ city, date: weekendDate, tag });
  const monthLink = buildFestivalsHref({ city, date: monthDate, tag });
  const popularCategoryChips = Array.from(new Set(festivalCategories)).slice(0, 5);

  const visiblePages = Array.from({ length: totalPages }).slice(0, 5);

  return (
    <PlanStateProvider
      initialScheduleItemIds={planState.scheduleItemIds}
      initialReminders={planState.reminders}
      isAuthenticated={Boolean(user)}
    >
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
                    href={freeLink}
                    scroll={false}
                    className="rounded-full border border-black/[0.1] bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] transition hover:border-black/20 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                  >
                    Само безплатни
                  </Link>
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
                    {process.env.NODE_ENV !== "production" ? (
                      <p className="mt-2 break-words text-xs text-red-700">{queryError}</p>
                    ) : null}
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
                        city={festival.city}
                        category={festival.category}
                        imageUrl={festival.image_url}
                        startDate={festival.start_date}
                        endDate={festival.end_date}
                        isFree={festival.is_free}
                        description={festival.description}
                        showDescription
                        showDetailsButton
                        detailsHref={`/festivals/${festival.slug}`}
                        showPlanControls
                        festivalId={festival.id}
                        scheduleItemId={primaryScheduleByFestival[String(festival.id)] ?? null}
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
    </PlanStateProvider>
  );
}
