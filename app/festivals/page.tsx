import StickySearchBar from "@/components/StickySearchBar";
import FiltersSidebar from "@/components/FiltersSidebar";
import MobileFiltersSheet from "@/components/MobileFiltersSheet";
import FestivalGrid from "@/components/FestivalGrid";
import Pagination from "@/components/Pagination";
import ViewToggle from "@/components/ViewToggle";
import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import Stack from "@/components/ui/Stack";
import Heading from "@/components/ui/Heading";
import Text from "@/components/ui/Text";
import ApplePill from "@/components/apple/ApplePill";
import AppleDivider from "@/components/apple/AppleDivider";
import { parseFilters, serializeFilters, withDefaultFilters } from "@/lib/filters";
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
  const categoryActive = Boolean(filters.cat?.length);
  const cityActive = Boolean(filters.city?.length);
  const freeActive = filters.free === true;
  const categoryLabel = categoryActive ? `Category: ${filters.cat?.join(", ")}` : "Category";
  const cityLabel = cityActive ? `City: ${filters.city?.join(", ")}` : "City";
  const categoryHref = `/festivals${serializeFilters({ ...filters, cat: categoryActive ? undefined : filters.cat })}`;
  const cityHref = `/festivals${serializeFilters({ ...filters, city: cityActive ? undefined : filters.city })}`;
  const freeHref = `/festivals${serializeFilters({ ...filters, free: freeActive ? false : true })}`;

  return (
    <Container>
      <Section>
        <Stack size="lg">
          <Stack size="sm">
            <Heading as="h1" size="h1">
              Фестивали
            </Heading>
            <Text variant="muted" size="sm">
              Подбрани събития с филтри по град, дата и категория.
            </Text>
          </Stack>

          {showBanner ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Supabase env vars are missing. Set them in Vercel or your local environment to load festivals.
            </div>
          ) : null}

          <Stack size="sm">
            <StickySearchBar initialFilters={filters} />
            <div className="flex flex-wrap items-center gap-3">
              <ApplePill href={categoryHref} active={categoryActive}>
                {categoryLabel}
              </ApplePill>
              <ApplePill href={cityHref} active={cityActive}>
                {cityLabel}
              </ApplePill>
              <ApplePill href={freeHref} active={freeActive}>
                Free
              </ApplePill>
              <div className="ml-auto flex items-center gap-3">
                <MobileFiltersSheet initialFilters={filters} />
                <ViewToggle active="/festivals" filters={filters} />
              </div>
            </div>
          </Stack>

          <AppleDivider />

          <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
            <FiltersSidebar initialFilters={filters} className="hidden lg:block" />
            <Stack size="lg">
              <FestivalGrid festivals={data.data} />
              <Pagination page={data.page} totalPages={data.totalPages} basePath="/festivals" filters={filters} />
            </Stack>
          </div>
        </Stack>
      </Section>
    </Container>
  );
}
