import StickySearchBar from "@/components/StickySearchBar";
import FiltersSidebar from "@/components/FiltersSidebar";
import MobileFiltersSheet from "@/components/MobileFiltersSheet";
import FestivalGrid from "@/components/FestivalGrid";
import Pagination from "@/components/Pagination";
import ViewToggle from "@/components/ViewToggle";
import CategoryChips from "@/components/CategoryChips";
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
    <div className="container-page space-y-8 py-10">
      <div className="space-y-4">
        <StickySearchBar initialFilters={filters} />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CategoryChips filters={filters} />
          <div className="flex items-center gap-3">
            <MobileFiltersSheet initialFilters={filters} />
            <ViewToggle active="/festivals" filters={filters} />
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <FiltersSidebar initialFilters={filters} className="hidden lg:block" />
        <div className="space-y-8">
          <FestivalGrid festivals={data.data} />
          <Pagination page={data.page} totalPages={data.totalPages} basePath="/festivals" filters={filters} />
        </div>
      </div>
    </div>
  );
}
