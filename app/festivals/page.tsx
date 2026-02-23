import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";
import EventCard from "@/components/ui/EventCard";
import FilterSidebar from "@/components/ui/FilterSidebar";
import Section from "@/components/ui/Section";
import { parseFilters, withDefaultFilters } from "@/lib/filters";
import { getFestivals } from "@/lib/queries";
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
  const data = await getFestivals(filters, Number.isNaN(page) ? 1 : page, 12);

  return (
    <div className="bg-white text-neutral-900">\n
      <Section className="py-20">
        <Container>
          <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-neutral-400">Events</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Events</h1>
                <p className="mt-2 text-sm text-neutral-600">
                  Browse festivals, filter by location, and save your favorites.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-500">{data.total} results</span>
                <Button variant="secondary" size="sm">
                  Grid view
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4">
              <input
                placeholder="Keyword"
                className="h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm text-ink placeholder:text-neutral-500 sm:w-56"
              />
              <input
                placeholder="City"
                className="h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm text-ink placeholder:text-neutral-500 sm:w-44"
              />
              <select className="h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm text-ink sm:w-44">
                <option>Month</option>
                <option>January</option>
                <option>February</option>
                <option>March</option>
              </select>
              <label className="flex items-center gap-2 text-sm text-neutral-600">
                <input type="checkbox" className="h-4 w-4 rounded border-neutral-300" />
                Free only
              </label>
            </div>

            <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
              <FilterSidebar />
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
                    showDetailsButton
                    detailsHref={`/festival/${festival.slug}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </Container>
      </Section>
    </div>
  );
}
