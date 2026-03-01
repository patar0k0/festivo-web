import { endOfMonth, format, nextSaturday, nextSunday, startOfMonth } from "date-fns";
import StickySearchBar from "@/components/StickySearchBar";
import CategoryChips from "@/components/CategoryChips";
import ViewToggle from "@/components/ViewToggle";
import FiltersSidebar from "@/components/FiltersSidebar";
import MobileFiltersSheet from "@/components/MobileFiltersSheet";
import Pagination from "@/components/Pagination";
import Container from "@/components/ui/Container";
import EventCard from "@/components/ui/EventCard";
import Section from "@/components/ui/Section";
import { parseFilters, serializeFilters, withDefaultFilters } from "@/lib/filters";
import { listFestivals } from "@/lib/festivals";
import { getBaseUrl, listMeta } from "@/lib/seo";
import "../landing.css";

export const revalidate = 3600;

export async function generateMetadata() {
  const meta = listMeta();
  return {
    ...meta,
    alternates: {
      canonical: `${getBaseUrl()}/festivals`,
    },
  };
}

export default async function FestivalsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = withDefaultFilters(parseFilters(searchParams));
  const page = Number(searchParams.page ?? 1);
  const data = await listFestivals(filters, Number.isNaN(page) ? 1 : page, 12);
  const today = new Date();
  const weekendStart = nextSaturday(today);
  const weekendEnd = nextSunday(today);
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  const todayLink = serializeFilters({
    ...filters,
    from: format(today, "yyyy-MM-dd"),
    to: format(today, "yyyy-MM-dd"),
  });
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

  return (
    <div className="landing-bg text-[#0c0e14]">
      <Section className="overflow-x-clip bg-transparent py-8 md:py-10">
        <Container>
          <div className="space-y-7">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">Фестивали</p>
                <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Открий събития в България</h1>
                <p className="mt-2 text-sm text-black/60 md:text-[15px]">
                  Филтрирай по град, период и категория, после отвори детайли и планирай уикенда си.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <MobileFiltersSheet initialFilters={filters} />
                <ViewToggle active="/festivals" filters={filters} />
              </div>
            </div>

            <div className="space-y-4 lg:sticky lg:top-[86px] lg:z-20">
              <StickySearchBar initialFilters={filters} />
              <div className="rounded-2xl border border-black/[0.08] bg-white/75 p-3 shadow-[0_2px_0_rgba(12,14,20,0.05),0_8px_22px_rgba(12,14,20,0.07)] backdrop-blur">
                <CategoryChips filters={filters} />
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-black/45">
                  <a
                    href={`/festivals${todayLink}`}
                    className="rounded-full border border-black/[0.1] bg-white/85 px-3 py-2 transition hover:border-black/20 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                  >
                    Днес
                  </a>
                  <a
                    href={`/festivals${weekendLink}`}
                    className="rounded-full border border-black/[0.1] bg-white/85 px-3 py-2 transition hover:border-black/20 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                  >
                    Уикенд
                  </a>
                  <a
                    href={`/festivals${monthLink}`}
                    className="rounded-full border border-black/[0.1] bg-white/85 px-3 py-2 transition hover:border-black/20 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                  >
                    Този месец
                  </a>
                </div>
              </div>
            </div>

            <div className="grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] xl:gap-8">
              <div className="hidden lg:block">
                <FiltersSidebar initialFilters={filters} className="sticky top-[176px]" />
              </div>
              <div className="min-w-0 space-y-6">
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
                {data.data.length === 0 ? (
                  <div className="rounded-2xl border border-black/[0.08] bg-white/80 px-5 py-10 text-center text-sm text-black/55 shadow-[0_2px_0_rgba(12,14,20,0.05),0_8px_22px_rgba(12,14,20,0.06)]">
                    Няма намерени фестивали по текущите филтри.
                  </div>
                ) : null}
                <Pagination page={data.page} totalPages={data.totalPages} basePath="/festivals" filters={filters} />
              </div>
            </div>
          </div>
        </Container>
      </Section>
    </div>
  );
}
