import MapPageClient from "@/components/MapPageClient";
import { parseFilters, withDefaultFilters } from "@/lib/filters";
import { listFestivals } from "@/lib/festivals";
import { listPublicFestivalCategorySlugs } from "@/lib/festivals/publicCategories.server";
import { getBaseUrl, listMeta } from "@/lib/seo";

export const revalidate = 3600;

export async function generateMetadata() {
  const meta = listMeta();
  const canonical = `${getBaseUrl()}/map`;
  return {
    ...meta,
    title: "Карта на фестивалите | Festivo",
    description: "Виж какво има около теб и филтрирай по град, дата и категория.",
    alternates: { canonical },
    openGraph: {
      title: "Карта на фестивалите в България | Festivo",
      description: "Виж какво има около теб и филтрирай по град, дата и категория.",
      url: canonical,
      siteName: "Festivo",
      locale: "bg_BG",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: "Карта на фестивалите в България | Festivo",
      description: "Виж какво има около теб и филтрирай по град, дата и категория.",
    },
  };
}

export default async function MapPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = withDefaultFilters(parseFilters(searchParams));
  // Картата трябва да вижда всички фестивали с координати, не само страница 1.
  // Supabase връща всички редове на сървъра (без DB LIMIT), после пагинираме в паметта —
  // затова 500 тук не добавя допълнително натоварване на DB, а само разширява slice-а.
  const [data, categoryOptions] = await Promise.all([
    listFestivals(filters, 1, 500),
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
