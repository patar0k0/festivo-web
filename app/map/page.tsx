import Link from "next/link";
import StickySearchBar from "@/components/StickySearchBar";
import ViewToggle from "@/components/ViewToggle";
import Container from "@/components/ui/Container";
import EventCard from "@/components/ui/EventCard";
import Section from "@/components/ui/Section";
import { parseFilters, withDefaultFilters } from "@/lib/filters";
import { listFestivals } from "@/lib/festivals";
import { getBaseUrl } from "@/lib/seo";

export const revalidate = 3600;

export async function generateMetadata() {
  return {
    title: "Festival map",
    description: "Explore festivals on the map and search by city, date, and category.",
    alternates: {
      canonical: `${getBaseUrl()}/map`,
    },
  };
}

export default async function MapPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = withDefaultFilters(parseFilters(searchParams));
  const data = await listFestivals(filters, 1, 30);

  return (
    <div className="bg-white text-neutral-900">
      <Section className="py-10">
        <Container>
          <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-neutral-400">Map</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Map view</h1>
              </div>
              <ViewToggle active="/map" filters={filters} />
            </div>

            <div className="sticky top-4 z-30">
              <StickySearchBar initialFilters={filters} />
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
              <div className="space-y-4">
                {data.data.map((festival) => (
                  <Link key={festival.slug} href={`/festival/${festival.slug}`} className="group">
                    <EventCard
                      title={festival.title}
                      city={festival.city}
                      category={festival.category}
                      imageUrl={festival.image_url}
                      startDate={festival.start_date}
                      endDate={festival.end_date}
                      isFree={festival.is_free}
                    />
                  </Link>
                ))}
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white/80 p-6">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-lg font-semibold">Map</h2>
                  <button
                    type="button"
                    disabled
                    title="Map not enabled yet"
                    className="rounded-full border border-neutral-200 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-neutral-400"
                  >
                    Search this area
                  </button>
                </div>
                <div className="mt-4 flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-neutral-200 text-sm text-neutral-500">
                  Map placeholder
                </div>
              </div>
            </div>
          </div>
        </Container>
      </Section>
    </div>
  );
}
