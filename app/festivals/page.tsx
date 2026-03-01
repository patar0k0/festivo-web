import Link from "next/link";
import { endOfMonth, format, nextSaturday, nextSunday, startOfMonth } from "date-fns";
import StickySearchBar from "@/components/StickySearchBar";
import { festivalCategories, festivalCategoryLabels } from "@/components/CategoryChips";
import ViewToggle from "@/components/ViewToggle";
import FiltersSidebar from "@/components/FiltersSidebar";
import MobileFiltersSheet from "@/components/MobileFiltersSheet";
import Pagination from "@/components/Pagination";
import FestivalsResultsToolbar from "@/components/FestivalsResultsToolbar";
import ActiveFiltersChips from "@/components/ActiveFiltersChips";
import ScrollRestoration from "@/components/ScrollRestoration";
import Container from "@/components/ui/Container";
import EventCard from "@/components/ui/EventCard";
import Section from "@/components/ui/Section";
import { parseFilters, serializeFilters, withDefaultFilters } from "@/lib/filters";
import { listFestivals } from "@/lib/festivals";
import { Filters } from "@/lib/types";
import { getBaseUrl, listMeta } from "@/lib/seo";
import "../landing.css";

export const revalidate = 3600;

export async function generateMetadata() {
  const meta = listMeta();
  return {
    ...meta,
    title: "Фестивали в България | Festivo",
    description: "Открий безплатни фестивали и събития в България по град, дата и категория.",
    alternates: {
      canonical: `${getBaseUrl()}/festivals`,
    },
  };
}

function countActiveFilters(filters: Filters) {
  let count = 0;
  if (filters.city?.length) count += 1;
  if (filters.region?.length) count += 1;
  if (filters.from) count += 1;
  if (filters.to) count += 1;
  if (filters.cat?.length) count += 1;
  if (filters.month) count += 1;
  if (filters.free === false) count += 1;
  if (filters.sort && filters.sort !== "soonest") count += 1;
  return count;
}

export default async function FestivalsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const parsedFilters = parseFilters(searchParams);
  const filters = withDefaultFilters(parsedFilters);
  const page = Number(searchParams.page ?? 1);
  const data = await listFestivals(filters, Number.isNaN(page) ? 1 : page, 12);

  const activeFiltersCount = countActiveFilters(parsedFilters);
  const clearHref = `/festivals${serializeFilters(withDefaultFilters({}))}`;

  const today = new Date();
  const weekendStart = nextSaturday(today);
  const weekendEnd = nextSunday(today);
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  const freeLink = serializeFilters({ ...filters, free: true });
  const weekendLink = serializeFilters({
    ...filters,
    from: format(weekendStart, "yyyy-MM-dd"),
    to: format(weekendEnd, "yyyy-MM-dd"),
  });
  const monthLink = serializeFilters({
    ...filters,
    from: format(monthStart, "yyyy-MM-dd"),
    to: format(monthEnd, "yyyy-MM-dd"),
  });
  const popularCategoryChips = Array.from(new Set(festivalCategories)).slice(0, 5);

  return (
    <div className="landing-bg overflow-x-hidden text-[#0c0e14]">
      <ScrollRestoration />
      <Section className="overflow-x-clip bg-transparent pb-8 pt-8 md:pb-10 md:pt-10">
        <Container>
          <div className="space-y-7 lg:space-y-8">
            <div className="rounded-[28px] border border-black/[0.08] bg-white/75 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_12px_30px_rgba(12,14,20,0.08)] backdrop-blur md:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4 md:gap-6">
                <div className="max-w-3xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">Festivo Explorer</p>
                  <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Фестивали в България</h1>
                  <p className="mt-3 text-sm text-black/65 md:text-[15px]">
                    Открий безплатни фестивали и събития по град, категория и дата.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <MobileFiltersSheet initialFilters={filters} />
                  <ViewToggle active="/festivals" filters={filters} />
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2 md:mt-6">
                <Link
                  href={`/festivals${freeLink}`}
                  scroll={false}
                  className="rounded-full border border-black/[0.1] bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] transition hover:border-black/20 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                >
                  Само безплатни
                </Link>
                <Link
                  href={`/festivals${weekendLink}`}
                  scroll={false}
                  className="rounded-full border border-black/[0.1] bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] transition hover:border-black/20 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                >
                  Този уикенд
                </Link>
                <Link
                  href={`/festivals${monthLink}`}
                  scroll={false}
                  className="rounded-full border border-black/[0.1] bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] transition hover:border-black/20 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                >
                  Този месец
                </Link>
                {popularCategoryChips.map((category) => {
                  const categoryLink = serializeFilters({ ...filters, cat: [category] });
                  const active = filters.cat?.includes(category);

                  return (
                    <Link
                      key={category}
                      href={`/festivals${categoryLink}`}
                      scroll={false}
                      className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25 ${
                        active
                          ? "border-[#0c0e14] bg-[#0c0e14] text-white"
                          : "border-black/[0.1] bg-white/90 text-[#0c0e14] hover:border-black/20 hover:bg-white"
                      }`}
                    >
                      {festivalCategoryLabels[category] ?? category}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4 lg:hidden">
              <StickySearchBar initialFilters={filters} />
            </div>

            <div className="grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] xl:gap-8">
              <div className="hidden lg:block">
                <FiltersSidebar initialFilters={filters} className="sticky top-[172px]" />
              </div>

              <div className="min-w-0 space-y-5">
                <FestivalsResultsToolbar
                  filters={filters}
                  total={data.total}
                  activeFiltersCount={activeFiltersCount}
                  clearHref={clearHref}
                />
                <ActiveFiltersChips />

                {data.data.length === 0 ? (
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
                    {data.data.map((festival) => (
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
                        detailsHref={`/festival/${festival.slug}`}
                      />
                    ))}
                  </div>
                )}

                <Pagination page={data.page} totalPages={data.totalPages} basePath="/festivals" filters={filters} />
              </div>
            </div>
          </div>
        </Container>
      </Section>
    </div>
  );
}
