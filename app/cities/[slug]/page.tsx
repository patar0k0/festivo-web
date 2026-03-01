import Link from "next/link";
import { format, endOfMonth, parseISO, startOfMonth } from "date-fns";
import Container from "@/components/ui/Container";
import EventCard from "@/components/ui/EventCard";
import Pagination from "@/components/Pagination";
import Section from "@/components/ui/Section";
import { parseFilters, serializeFilters, withDefaultFilters } from "@/lib/filters";
import { listFestivals } from "@/lib/festivals";
import { resolveCityNameFromSlug } from "@/lib/cities";
import { getBaseUrl } from "@/lib/seo";
import "../../landing.css";

export const revalidate = 21600;

const categoryLabels: Record<string, string> = {
  music: "Музика",
  folk: "Фолклор",
  arts: "Изкуство",
  food: "Храна",
  cultural: "Култура",
  sports: "Спорт",
  film: "Кино",
  theater: "Театър",
};

function mapCategoryLabel(category: string) {
  return categoryLabels[category] ?? category;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cityName = await resolveCityNameFromSlug(slug);
  const title = `Фестивали в ${cityName} | Festivo`;
  const description = `Открий предстоящи фестивали и събития в ${cityName}. Запази в план и получавай напомняния.`;

  return {
    title,
    description,
    alternates: {
      canonical: `${getBaseUrl()}/cities/${slug}`,
    },
  };
}

export default async function CityLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const cityName = await resolveCityNameFromSlug(slug);

  const parsedFilters = parseFilters(resolvedSearchParams);
  const filters = withDefaultFilters({ ...parsedFilters, city: [cityName], sort: "soonest" });
  const page = Number(resolvedSearchParams.page ?? 1);
  const safePage = Number.isNaN(page) ? 1 : page;

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [cityFestivals, cityStats] = await Promise.all([
    listFestivals(filters, safePage, 12),
    listFestivals(
      { city: [cityName], sort: "soonest" },
      1,
      120,
      { applyDefaults: false },
    ),
  ]);

  const categoryCounts = new Map<string, number>();
  cityStats.data.forEach((festival) => {
    const category = festival.category?.toLowerCase();
    if (!category) return;
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  });
  const popularCategories = Array.from(categoryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const upcomingMonthCounts = new Map<string, number>();
  cityStats.data.forEach((festival) => {
    if (!festival.start_date) return;
    if (festival.start_date < format(now, "yyyy-MM-dd")) return;
    const month = festival.start_date.slice(0, 7);
    upcomingMonthCounts.set(month, (upcomingMonthCounts.get(month) ?? 0) + 1);
  });
  const upcomingMonths = Array.from(upcomingMonthCounts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(0, 4);

  const freeLink = serializeFilters({ ...filters, city: [cityName], free: true });
  const monthLink = serializeFilters({
    ...filters,
    city: [cityName],
    from: format(monthStart, "yyyy-MM-dd"),
    to: format(monthEnd, "yyyy-MM-dd"),
  });
  const categoryQuick = popularCategories.slice(0, 4);

  return (
    <div className="landing-bg text-[#0c0e14]">
      <Section className="overflow-x-clip bg-transparent py-8 md:py-10">
        <Container>
          <div className="space-y-8">
            <section className="rounded-[24px] border border-black/[0.08] bg-white/80 p-6 shadow-[0_2px_0_rgba(12,14,20,0.06),0_12px_32px_rgba(12,14,20,0.07)] md:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/45">Градска страница</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Фестивали в {cityName}</h1>
              <p className="mt-3 max-w-2xl text-sm text-black/60 md:text-[15px]">
                Безплатни събития, дати и програма. Открий предстоящи фестивали и събития в {cityName}. Запази в план и получавай напомняния.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href={`/cities/${slug}${freeLink}`}
                  className="rounded-full border border-black/[0.1] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition hover:border-black/20 hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                >
                  Само безплатни
                </Link>
                <Link
                  href={`/cities/${slug}${monthLink}`}
                  className="rounded-full border border-black/[0.1] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition hover:border-black/20 hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                >
                  Този месец
                </Link>
                {categoryQuick.map(([category]) => {
                  const categoryLink = serializeFilters({ ...filters, city: [cityName], cat: [category] });
                  return (
                    <Link
                      key={category}
                      href={`/cities/${slug}${categoryLink}`}
                      className="rounded-full border border-black/[0.1] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition hover:border-black/20 hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                    >
                      {mapCategoryLabel(category)}
                    </Link>
                  );
                })}
              </div>
            </section>

            <section className="space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 className="text-2xl font-semibold tracking-tight">Предстоящи фестивали</h2>
                <Link
                  href={`/festivals?city=${encodeURIComponent(cityName)}`}
                  className="text-sm font-semibold text-[#0c0e14] transition hover:text-black/65"
                >
                  Виж всички във Фестивали
                </Link>
              </div>

              {cityFestivals.data.length ? (
                <>
                  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {cityFestivals.data.map((festival) => (
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
                        showDescription
                        showDetailsButton
                        detailsHref={`/festival/${festival.slug}`}
                      />
                    ))}
                  </div>
                  <Pagination page={cityFestivals.page} totalPages={cityFestivals.totalPages} basePath={`/cities/${slug}`} filters={filters} />
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-black/[0.15] bg-white/70 px-5 py-10 text-center">
                  <p className="text-sm text-black/55">Още няма публикувани фестивали за този град.</p>
                  <Link
                    href="/festivals"
                    className="mt-4 inline-flex rounded-full border border-black/[0.1] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition hover:border-black/20 hover:bg-black/[0.03]"
                  >
                    Разгледай всички фестивали
                  </Link>
                </div>
              )}
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-2xl border border-black/[0.08] bg-white/80 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_8px_22px_rgba(12,14,20,0.07)]">
                <h3 className="text-lg font-semibold">Популярни категории в {cityName}</h3>
                {popularCategories.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {popularCategories.map(([category, count]) => (
                      <span
                        key={category}
                        className="rounded-full border border-black/[0.1] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14]"
                      >
                        {mapCategoryLabel(category)} · {count}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-black/55">Все още няма достатъчно данни за категории.</p>
                )}
              </div>

              <div className="rounded-2xl border border-black/[0.08] bg-white/80 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_8px_22px_rgba(12,14,20,0.07)]">
                <h3 className="text-lg font-semibold">Предстоящи дати</h3>
                {upcomingMonths.length ? (
                  <ul className="mt-4 space-y-2 text-sm text-black/65">
                    {upcomingMonths.map(([month, count]) => (
                      <li key={month} className="flex items-center justify-between rounded-xl border border-black/[0.08] bg-white px-3 py-2">
                        <span>{format(parseISO(`${month}-01`), "MMMM yyyy")}</span>
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">{count} събития</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-black/55">Няма публикувани предстоящи дати.</p>
                )}
              </div>
            </section>
          </div>
        </Container>
      </Section>
    </div>
  );
}
