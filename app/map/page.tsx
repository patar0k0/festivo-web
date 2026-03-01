import Link from "next/link";
import { endOfMonth, format, nextSaturday, nextSunday, startOfMonth } from "date-fns";
import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import MapSearchBar from "@/components/MapSearchBar";
import ViewToggle from "@/components/ViewToggle";
import { festivalCategories, festivalCategoryLabels } from "@/components/CategoryChips";
import MapFiltersSidebar from "@/components/MapFiltersSidebar";
import MapViewClient from "@/components/MapViewClient";
import MapResultsList from "@/components/MapResultsList";
import MapFiltersSheet from "@/components/MapFiltersSheet";
import MapMobileResultsSheet from "@/components/MapMobileResultsSheet";
import { parseFilters, serializeFilters, withDefaultFilters } from "@/lib/filters";
import { listFestivals } from "@/lib/festivals";
import { getBaseUrl, listMeta } from "@/lib/seo";
import "../landing.css";

export const revalidate = 3600;

const COPY = {
  title: "\u041a\u0430\u0440\u0442\u0430 \u043d\u0430 \u0444\u0435\u0441\u0442\u0438\u0432\u0430\u043b\u0438\u0442\u0435",
  subtitle:
    "\u0412\u0438\u0436 \u043a\u0430\u043a\u0432\u043e \u0438\u043c\u0430 \u043e\u043a\u043e\u043b\u043e \u0442\u0435\u0431 \u0438 \u0444\u0438\u043b\u0442\u0440\u0438\u0440\u0430\u0439 \u043f\u043e \u0433\u0440\u0430\u0434, \u0434\u0430\u0442\u0430 \u0438 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f.",
  free: "\u0421\u0430\u043c\u043e \u0431\u0435\u0437\u043f\u043b\u0430\u0442\u043d\u0438",
  weekend: "\u0422\u043e\u0437\u0438 \u0443\u0438\u043a\u0435\u043d\u0434",
  month: "\u0422\u043e\u0437\u0438 \u043c\u0435\u0441\u0435\u0446",
  results: "\u0420\u0435\u0437\u0443\u043b\u0442\u0430\u0442\u0438",
  empty: "\u041d\u044f\u043c\u0430 \u0444\u0435\u0441\u0442\u0438\u0432\u0430\u043b\u0438 \u043f\u043e \u0442\u0435\u0437\u0438 \u0444\u0438\u043b\u0442\u0440\u0438.",
  clear: "\u0418\u0437\u0447\u0438\u0441\u0442\u0438",
};

export async function generateMetadata() {
  const meta = listMeta();
  return {
    ...meta,
    title: `${COPY.title} | Festivo`,
    description: COPY.subtitle,
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
  const mapPoints = data.data.filter((festival) => festival.lat != null && festival.lng != null);

  const today = new Date();
  const weekendStart = nextSaturday(today);
  const weekendEnd = nextSunday(today);
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  const freeLink = serializeFilters({ ...filters, free: true });
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
  const popularCategoryChips = Array.from(new Set(festivalCategories)).slice(0, 5);
  const clearHref = `/map${serializeFilters(withDefaultFilters({}))}`;

  return (
    <div className="landing-bg overflow-x-hidden text-[#0c0e14]">
      <Section className="overflow-x-clip bg-transparent pb-8 pt-8 md:pb-10 md:pt-10">
        <Container>
          <div className="space-y-6 lg:space-y-7">
            <div className="rounded-[28px] border border-black/[0.08] bg-white/75 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_12px_30px_rgba(12,14,20,0.08)] backdrop-blur md:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4 md:gap-6">
                <div className="max-w-3xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">Festivo Explorer</p>
                  <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">{COPY.title}</h1>
                  <p className="mt-3 text-sm text-black/65 md:text-[15px]">{COPY.subtitle}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden lg:block xl:hidden">
                    <MapFiltersSheet initialFilters={filters} />
                  </div>
                  <ViewToggle active="/map" filters={filters} />
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2 md:mt-6">
                <Link
                  href={`/map${freeLink}`}
                  scroll={false}
                  className="rounded-full border border-black/[0.1] bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] transition hover:border-black/20 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                >
                  {COPY.free}
                </Link>
                <Link
                  href={`/map${weekendLink}`}
                  scroll={false}
                  className="rounded-full border border-black/[0.1] bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] transition hover:border-black/20 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                >
                  {COPY.weekend}
                </Link>
                <Link
                  href={`/map${monthLink}`}
                  scroll={false}
                  className="rounded-full border border-black/[0.1] bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] transition hover:border-black/20 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                >
                  {COPY.month}
                </Link>
                {popularCategoryChips.map((category) => {
                  const categoryLink = serializeFilters({ ...filters, cat: [category] });
                  const active = filters.cat?.includes(category);

                  return (
                    <Link
                      key={category}
                      href={`/map${categoryLink}`}
                      scroll={false}
                      className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25 ${
                        active
                          ? "border-[#0c0e14] bg-[#0c0e14] text-white"
                          : "border-black/[0.1] bg-white/90 text-[#0c0e14] hover:border-black/20 hover:bg-white"
                      }`}
                    >
                      {festivalCategoryLabels[category] ?? category}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4 xl:hidden">
              <MapSearchBar initialFilters={filters} />
            </div>

            <div className="grid items-start gap-6 xl:grid-cols-[23rem_minmax(0,1fr)]">
              <div className="hidden xl:block">
                <div className="sticky top-[84px] space-y-4">
                  <MapFiltersSidebar initialFilters={filters} className="max-w-none" />
                  <div className="max-h-[calc(100vh-23rem)] overflow-y-auto rounded-2xl border border-black/[0.08] bg-white/80 p-3 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.07)] backdrop-blur">
                    <MapResultsList festivals={data.data} />
                  </div>
                </div>
              </div>

              <div className="min-w-0 space-y-4">
                <div className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white/80 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.07)] backdrop-blur xl:sticky xl:top-[84px]">
                  <div className="h-[58vh] min-h-[360px] md:h-[62vh] xl:h-[calc(100vh-7.5rem)]">
                    <MapViewClient festivals={mapPoints} />
                  </div>
                </div>

                <div className="hidden lg:block xl:hidden rounded-2xl border border-black/[0.08] bg-white/80 p-3 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.07)] backdrop-blur">
                  <details>
                    <summary className="cursor-pointer list-none rounded-xl border border-black/[0.1] bg-white px-4 py-2 text-sm font-semibold text-[#0c0e14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25">
                      {COPY.results} ({data.data.length})
                    </summary>
                    <div className="mt-3 max-h-[50vh] overflow-y-auto">
                      <MapResultsList festivals={data.data} />
                    </div>
                  </details>
                </div>
              </div>
            </div>

            <div className="lg:hidden">
              <MapMobileResultsSheet count={data.data.length}>
                <MapResultsList festivals={data.data} />
              </MapMobileResultsSheet>
              <div className="fixed bottom-5 right-4 z-30">
                <MapFiltersSheet initialFilters={filters} floating />
              </div>
            </div>

            {data.data.length === 0 ? (
              <div className="rounded-2xl border border-black/[0.08] bg-white/80 px-6 py-10 text-center shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.07)]">
                <p className="text-base font-semibold text-[#0c0e14]">{COPY.empty}</p>
                <Link
                  href={clearHref}
                  scroll={false}
                  className="mt-4 inline-flex rounded-xl bg-[#0c0e14] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-white transition hover:bg-[#1d202b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                >
                  {COPY.clear}
                </Link>
              </div>
            ) : null}
          </div>
        </Container>
      </Section>
    </div>
  );
}
