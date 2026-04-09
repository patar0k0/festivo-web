import Link from "next/link";
import { format, endOfMonth, parseISO, startOfMonth } from "date-fns";
import { notFound, permanentRedirect } from "next/navigation";
import Container from "@/components/ui/Container";
import EventCard from "@/components/ui/EventCard";
import Pagination from "@/components/Pagination";
import Section from "@/components/ui/Section";
import { cityHref } from "@/lib/cities";
import { getFestivalHeroImage } from "@/lib/festival/getFestivalHeroImage";
import { parseFilters, serializeFilters, withDefaultFilters } from "@/lib/filters";
import { listFestivals } from "@/lib/festivals";
import { festivalCityLabel, formatSettlementDisplayName } from "@/lib/settlements/formatDisplayName";
import { labelForPublicCategory } from "@/lib/festivals/publicCategories";
import { getBaseUrl } from "@/lib/seo";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { pub } from "@/lib/public-ui/styles";
import { hasActivePromotion, hasActiveVip } from "@/lib/monetization";
import type { FestivalWhenFilter } from "@/lib/types";

export const revalidate = 21600;

type CityRecord = {
  slug: string;
  name_bg: string;
  is_village: boolean | null;
};

function hasNonAscii(value: string) {
  return /[^\x00-\x7F]/.test(value);
}

async function resolveCityByParam(slugParam: string): Promise<{ city: CityRecord | null; rawTrimmed: string }> {
  const rawTrimmed = decodeURIComponent(slugParam).trim();
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("cities").select("slug,name_bg,is_village");

  if (hasNonAscii(rawTrimmed)) {
    const rawSpaced = rawTrimmed.replace(/-/g, " ");
    const orFilter =
      rawSpaced === rawTrimmed
        ? `name_bg.ilike.${rawTrimmed}`
        : `name_bg.ilike.${rawTrimmed},name_bg.ilike.${rawSpaced}`;
    query = query.or(orFilter);
  } else {
    query = query.ilike("slug", rawTrimmed);
  }

  const { data, error } = await query.limit(1).maybeSingle<CityRecord>();
  if (error) {
    console.error("[cities] resolveCityByParam failed", error.message);
    throw new Error(`City lookup failed: ${error.message}`);
  }
  return { city: data ?? null, rawTrimmed };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { city, rawTrimmed } = await resolveCityByParam(slug);
  const cityName =
    city != null
      ? formatSettlementDisplayName(city.name_bg, city.is_village) ?? city.name_bg
      : rawTrimmed;
  const canonicalSlug = city?.slug ?? rawTrimmed;
  const title = `Фестивали в ${cityName} | Festivo`;
  const description = `Открий предстоящи фестивали и събития в ${cityName}. Запази в план и получавай напомняния.`;

  return {
    title,
    description,
    alternates: {
      canonical: `${getBaseUrl()}/cities/${canonicalSlug}`,
    },
  };
}

export default async function CityLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug: slugParam }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const { city, rawTrimmed } = await resolveCityByParam(slugParam);

  if (!city) {
    notFound();
  }

  if (hasNonAscii(rawTrimmed) || rawTrimmed !== city.slug) {
    permanentRedirect(cityHref(city.slug));
  }

  const cityName = formatSettlementDisplayName(city.name_bg, city.is_village) ?? city.name_bg;
  const citySlug = city.slug;

  const parsedFilters = parseFilters(resolvedSearchParams);
  const filters = withDefaultFilters({ ...parsedFilters, city: [citySlug], sort: "soonest" });
  const page = Number(resolvedSearchParams.page ?? 1);
  const safePage = Number.isNaN(page) ? 1 : page;

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [cityFestivals, cityStats] = await Promise.all([
    listFestivals(filters, safePage, 12),
    listFestivals(
      { city: [citySlug], sort: "soonest" },
      1,
      120,
      { applyDefaults: false },
    ),
  ]);

  const categoryCounts = new Map<string, number>();
  cityStats.data.forEach((festival) => {
    const category = festival.category?.toLowerCase();
    if (!category) return;
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  });
  const popularCategories = Array.from(categoryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const upcomingMonthCounts = new Map<string, number>();
  cityStats.data.forEach((festival) => {
    if (!festival.start_date) return;
    if (festival.start_date < format(now, "yyyy-MM-dd")) return;
    const month = festival.start_date.slice(0, 7);
    upcomingMonthCounts.set(month, (upcomingMonthCounts.get(month) ?? 0) + 1);
  });
  const upcomingMonths = Array.from(upcomingMonthCounts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(0, 4);

  const freeLink = serializeFilters({ ...filters, city: [citySlug], free: true });
  const monthLink = serializeFilters({
    ...filters,
    city: [citySlug],
    from: format(monthStart, "yyyy-MM-dd"),
    to: format(monthEnd, "yyyy-MM-dd"),
  });
  const categoryQuick = popularCategories.slice(0, 4);

  const whenChips: { key: FestivalWhenFilter; label: string }[] = [
    { key: "all", label: "Всички" },
    { key: "ongoing", label: "Текущи" },
    { key: "upcoming", label: "Предстоящи" },
    { key: "past", label: "Отминали" },
  ];
  const activeWhen = filters.when ?? "all";

  return (
    <div className={pub.page}>
      <Section className={pub.section}>
        <Container>
          <div className="space-y-8">
            <section className={cn(pub.panelHero, "p-6 md:p-8")}>
              <p className={pub.eyebrowMuted}>Градска страница</p>
              <h1 className={cn(pub.pageTitle, "mt-2")}>Фестивали в {cityName}</h1>
              <p className={cn(pub.body, "mt-3 max-w-2xl text-black/60")}>
                Безплатни събития, дати и програма. Открий предстоящи фестивали и събития в {cityName}. Запази в план и получавай напомняния.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href={`${cityHref(citySlug)}${freeLink}`}
                  className={cn(pub.chip, pub.focusRing, "hover:bg-black/[0.03]")}
                >
                  Само безплатни
                </Link>
                <Link
                  href={`${cityHref(citySlug)}${monthLink}`}
                  className={cn(pub.chip, pub.focusRing, "hover:bg-black/[0.03]")}
                >
                  Този месец
                </Link>
                {categoryQuick.map(([category]) => {
                  const categoryLink = serializeFilters({ ...filters, city: [citySlug], cat: [category] });
                  return (
                    <Link
                      key={category}
                      href={`${cityHref(citySlug)}${categoryLink}`}
                      className={cn(pub.chip, pub.focusRing, "hover:bg-black/[0.03]")}
                    >
                      {labelForPublicCategory(category)}
                    </Link>
                  );
                })}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-black/40">Време</span>
                {whenChips.map(({ key, label }) => {
                  const href = `${cityHref(citySlug)}${serializeFilters({ ...filters, city: [citySlug], when: key })}`;
                  return (
                    <Link
                      key={key}
                      href={href}
                      className={cn(pub.chipSm, pub.focusRing, activeWhen === key ? pub.chipActive : "hover:bg-black/[0.03]")}
                    >
                      {label}
                    </Link>
                  );
                })}
              </div>
            </section>

            <section className="space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 className={cn(pub.pageTitle, "text-2xl")}>Предстоящи фестивали</h2>
                <Link
                  href={`/festivals?city=${encodeURIComponent(citySlug)}`}
                  className="text-sm font-semibold text-[#0c0e14] transition hover:text-black/65"
                >
                  Виж всички във Фестивали
                </Link>
              </div>

              {cityFestivals.data.length ? (
                <>
                  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {cityFestivals.data.map((festival) => (
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
                        festivalId={festival.id}
                      />
                    ))}
                  </div>
                  <Pagination page={cityFestivals.page} totalPages={cityFestivals.totalPages} basePath={cityHref(citySlug)} filters={filters} />
                </>
              ) : (
                <div className={cn(pub.sectionCardSoft, "border-dashed px-5 py-10 text-center")}>
                  <p className="text-sm text-black/55">Още няма публикувани фестивали за този град.</p>
                  <Link
                    href="/festivals"
                    className={cn("mt-4 inline-flex", pub.chip, pub.focusRing)}
                  >
                    Разгледай всички фестивали
                  </Link>
                </div>
              )}
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
              <div className={cn(pub.sectionCardSoft, "p-5")}>
                <h3 className={pub.sectionTitleMd}>Популярни категории в {cityName}</h3>
                {popularCategories.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {popularCategories.map(([category, count]) => (
                      <span
                        key={category}
                        className="rounded-full border border-black/[0.1] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14]"
                      >
                        {labelForPublicCategory(category)} · {count}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-black/55">Все още няма достатъчно данни за категории.</p>
                )}
              </div>

              <div className={cn(pub.sectionCardSoft, "p-5")}>
                <h3 className={pub.sectionTitleMd}>Предстоящи дати</h3>
                {upcomingMonths.length ? (
                  <ul className="mt-4 space-y-2 text-sm text-black/65">
                    {upcomingMonths.map(([month, count]) => (
                      <li
                        key={month}
                        className="flex items-center justify-between rounded-xl border border-amber-200/30 bg-white px-3 py-2 ring-1 ring-amber-100/15"
                      >
                        <span>{format(parseISO(`${month}-01`), "MMMM yyyy")}</span>
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">{count} събития</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-black/55">Няма публикувани предстоящи дати.</p>
                )}
              </div>
            </section>
          </div>
        </Container>
      </Section>
    </div>
  );
}
