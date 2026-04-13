import Link from "next/link";
import { Suspense } from "react";
import ScrollRestoration from "@/components/ScrollRestoration";
import FestivalsListingDiscovery from "@/components/festivals/FestivalsListingDiscovery";
import Pagination from "@/components/Pagination";
import Container from "@/components/ui/Container";
import EventCard from "@/components/ui/EventCard";
import Section from "@/components/ui/Section";
import { getFestivalHeroImage } from "@/lib/festival/getFestivalHeroImage";
import { buildFestivalsQuickChipLinks } from "@/lib/home/loadHomePageData";
import { listPublicFestivalCategorySlugs } from "@/lib/festivals/publicCategories.server";
import { listFestivals, listHomeCitySelectOptions } from "@/lib/festivals";
import { parseFilters, withDefaultFilters } from "@/lib/filters";
import { getBaseUrl, listMeta } from "@/lib/seo";
import { festivalCityLabel } from "@/lib/settlements/formatDisplayName";
import { Festival } from "@/lib/types";
import { cn } from "@/lib/utils";
import { pub } from "@/lib/public-ui/styles";
import { hasActivePromotion, hasActiveVip } from "@/lib/monetization";

export const revalidate = 3600;

const PAGE_SIZE = 12;

/** Hero + listing share width with `Container` (max-w-6xl). */
const festivalsPageMainStackClass = "mx-auto w-full max-w-6xl min-w-0 space-y-5";

type PageSearchParams = Record<string, string | string[] | undefined>;

function getParam(searchParams: PageSearchParams, key: string): string | undefined {
  const value = searchParams[key];
  if (Array.isArray(value)) {
    return value[0];
  }
  return typeof value === "string" ? value : undefined;
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

export default async function FestivalsPage({ searchParams }: { searchParams: PageSearchParams }) {
  const pageRaw = Number(getParam(searchParams, "page") ?? "1");
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;

  const parsed = parseFilters(searchParams);
  const filters = withDefaultFilters(parsed);
  const q = filters.q?.trim() ?? "";

  let festivals: Festival[] = [];
  let total = 0;
  let totalPages = 1;
  let queryError: string | null = null;

  const [categorySlugs, cityOptions] = await Promise.all([
    listPublicFestivalCategorySlugs().catch(() => [] as string[]),
    listHomeCitySelectOptions().catch(() => [] as Array<{ name: string; slug: string | null; filterValue: string }>),
  ]);

  const chips = buildFestivalsQuickChipLinks(categorySlugs);

  try {
    const data = await listFestivals(filters, page, PAGE_SIZE);
    festivals = data.data;
    total = data.total;
    totalPages = data.totalPages;
  } catch (error) {
    console.error("[festivals/page] listFestivals failed", error);
    queryError = error instanceof Error ? error.message : "Unknown error";
  }

  const activeFiltersCount =
    Number(Boolean(filters.q?.trim())) +
    Number(Boolean(filters.city?.length)) +
    Number(Boolean(filters.from || filters.to)) +
    Number(Boolean(filters.cat?.length)) +
    Number(Boolean(filters.when && filters.when !== "all")) +
    Number(filters.free === false);

  const clearHref = "/festivals";

  return (
    <div className={pub.pageOverflow}>
      <ScrollRestoration />
      <Section className={pub.sectionLoose}>
        <Container>
          <div className={pub.stackLg}>
            <div className={festivalsPageMainStackClass}>
              <div>
                <p className={pub.eyebrowMuted}>Festivo Explorer</p>
                <h1 className={cn(pub.pageTitle, "mt-2")}>Фестивали в България</h1>
                <p className={cn(pub.body, "mt-3")}>
                  Открий безплатни фестивали и събития в България по град, категория и дата.
                </p>
              </div>

              <Suspense
                fallback={
                  <div className={cn(pub.panelHero, "min-h-[8rem] animate-pulse p-4 md:p-5")} aria-hidden />
                }
              >
                <FestivalsListingDiscovery chips={chips} cityOptions={cityOptions} initialQuery={q} />
              </Suspense>
            </div>

            <div className={festivalsPageMainStackClass}>
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
                  <Link href={clearHref} scroll={false} className={cn(pub.chipSm, pub.focusRing)}>
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
                    <Link href={clearHref} scroll={false} className={cn(pub.btnPrimarySm, pub.focusRing)}>
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
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:gap-6">
                  {festivals.map((festival) => (
                    <EventCard
                      key={festival.slug}
                      title={festival.title}
                      city={festivalCityLabel(festival, "")}
                      category={festival.category}
                      imageUrl={getFestivalHeroImage(festival)}
                      startDate={festival.start_date}
                      endDate={festival.end_date}
                      occurrenceDates={festival.occurrence_dates}
                      startTime={festival.start_time}
                      endTime={festival.end_time}
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
              )}

              {!queryError ? (
                <Pagination page={page} totalPages={totalPages} basePath="/festivals" filters={filters} />
              ) : null}
            </div>
          </div>
        </Container>
      </Section>
    </div>
  );
}
