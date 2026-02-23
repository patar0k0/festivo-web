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
      <Section>
        <Container>
          <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Events</p>
                <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Events</h1>
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

            <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
              <FilterSidebar />
              <div className="grid gap-6 md:grid-cols-2">
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
