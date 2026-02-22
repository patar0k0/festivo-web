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
import { getSupabaseEnv } from "@/lib/supabaseServer";

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
  const { configured } = getSupabaseEnv();
  const showBanner = !configured && process.env.NODE_ENV !== "production";

  return (
    <div className="container-page space-y-8 py-10">
      <div className="space-y-4">
        {showBanner ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Supabase env vars are missing. Set them in Vercel or your local environment to load festivals.
          </div>
        ) : null}
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
