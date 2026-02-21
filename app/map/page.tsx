import FestivalList from "@/components/FestivalList";
import ViewToggle from "@/components/ViewToggle";
import { parseFilters, withDefaultFilters } from "@/lib/filters";
import { getFestivals } from "@/lib/queries";
import MapView from "@/components/MapView";
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
  const data = await getFestivals(filters, 1, 50);

  return (
    <div className="container-page space-y-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Map</h1>
        <ViewToggle active="/map" filters={filters} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-4">
          <FestivalList festivals={data.data} />
        </div>
        <MapView festivals={data.data} />
      </div>
    </div>
  );
}
