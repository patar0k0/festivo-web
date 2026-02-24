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

  const todayLink = serializeFilters({ ...filters, from: format(today, "yyyy-MM-dd"), to: format(today, "yyyy-MM-dd") });
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
    <div className="bg-white text-neutral-900">
      <Section className="py-10">
        <Container>
          <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-neutral-400">Events</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Festivals</h1>
                <p className="mt-2 text-sm text-neutral-600">
                  Browse festivals, filter by location, and save your favorites.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <MobileFiltersSheet initialFilters={filters} />
                <ViewToggle active="/festivals" filters={filters} />
              </div>
            </div>

            <div className="sticky top-4 z-30 space-y-4">
              <StickySearchBar initialFilters={filters} />
              <div className="flex flex-wrap items-center gap-3">
                <CategoryChips filters={filters} />
                <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  <a href={`/festivals${todayLink}`} className="rounded-full border border-ink/10 px-3 py-2">
                    Today
                  </a>
                  <a href={`/festivals${weekendLink}`} className="rounded-full border border-ink/10 px-3 py-2">
                    Weekend
                  </a>
                  <a href={`/festivals${monthLink}`} className="rounded-full border border-ink/10 px-3 py-2">
                    This month
                  </a>
                </div>
              </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
              <div className="hidden lg:block">
                <FiltersSidebar initialFilters={filters} className="sticky top-28" />
              </div>
              <div className="space-y-6">
                <div className="grid gap-8 md:grid-cols-2">
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
                <Pagination page={data.page} totalPages={data.totalPages} basePath="/festivals" filters={filters} />
              </div>
            </div>
          </div>
        </Container>
      </Section>
    </div>
  );
}

