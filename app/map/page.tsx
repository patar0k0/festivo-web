import MapPageClient from "@/components/MapPageClient";
import { parseFilters, withDefaultFilters } from "@/lib/filters";
import { listFestivals } from "@/lib/festivals";
import { listPublicFestivalCategorySlugs } from "@/lib/festivals/publicCategories.server";
import { getBaseUrl, listMeta } from "@/lib/seo";
import "../landing.css";

export const revalidate = 3600;

export async function generateMetadata() {
  const meta = listMeta();
  return {
    ...meta,
    title: "Карта на фестивалите | Festivo",
    description: "Виж какво има около теб и филтрирай по град, дата и категория.",
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
  const [data, categoryOptions] = await Promise.all([
    listFestivals(filters, 1, 30),
    listPublicFestivalCategorySlugs(),
  ]);

  return (
    <MapPageClient
      filters={filters}
      festivals={data.data}
      total={data.total}
      categoryOptions={categoryOptions}
    />
  );
}
