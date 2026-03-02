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
  music: "РњСѓР·РёРєР°",
  folk: "Р¤РѕР»РєР»РѕСЂ",
  arts: "РР·РєСѓСЃС‚РІРѕ",
  food: "РҐСЂР°РЅР°",
  cultural: "РљСѓР»С‚СѓСЂР°",
  sports: "РЎРїРѕСЂС‚",
  film: "РљРёРЅРѕ",
  theater: "РўРµР°С‚СЉСЂ",
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
  const title = `Р¤РµСЃС‚РёРІР°Р»Рё РІ ${cityName} | Festivo`;
  const description = `РћС‚РєСЂРёР№ РїСЂРµРґСЃС‚РѕСЏС‰Рё С„РµСЃС‚РёРІР°Р»Рё Рё СЃСЉР±РёС‚РёСЏ РІ ${cityName}. Р—Р°РїР°Р·Рё РІ РїР»Р°РЅ Рё РїРѕР»СѓС‡Р°РІР°Р№ РЅР°РїРѕРјРЅСЏРЅРёСЏ.`;

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
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/45">Р“СЂР°РґСЃРєР° СЃС‚СЂР°РЅРёС†Р°</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Р¤РµСЃС‚РёРІР°Р»Рё РІ {cityName}</h1>
              <p className="mt-3 max-w-2xl text-sm text-black/60 md:text-[15px]">
                Р‘РµР·РїР»Р°С‚РЅРё СЃСЉР±РёС‚РёСЏ, РґР°С‚Рё Рё РїСЂРѕРіСЂР°РјР°. РћС‚РєСЂРёР№ РїСЂРµРґСЃС‚РѕСЏС‰Рё С„РµСЃС‚РёРІР°Р»Рё Рё СЃСЉР±РёС‚РёСЏ РІ {cityName}. Р—Р°РїР°Р·Рё РІ РїР»Р°РЅ Рё РїРѕР»СѓС‡Р°РІР°Р№ РЅР°РїРѕРјРЅСЏРЅРёСЏ.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href={`/cities/${slug}${freeLink}`}
                  className="rounded-full border border-black/[0.1] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition hover:border-black/20 hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                >
                  РЎР°РјРѕ Р±РµР·РїР»Р°С‚РЅРё
                </Link>
                <Link
                  href={`/cities/${slug}${monthLink}`}
                  className="rounded-full border border-black/[0.1] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition hover:border-black/20 hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                >
                  РўРѕР·Рё РјРµСЃРµС†
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
                <h2 className="text-2xl font-semibold tracking-tight">РџСЂРµРґСЃС‚РѕСЏС‰Рё С„РµСЃС‚РёРІР°Р»Рё</h2>
                <Link
                  href={`/festivals?city=${encodeURIComponent(cityName)}`}
                  className="text-sm font-semibold text-[#0c0e14] transition hover:text-black/65"
                >
                  Р’РёР¶ РІСЃРёС‡РєРё РІСЉРІ Р¤РµСЃС‚РёРІР°Р»Рё
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
                        detailsHref={`/festivals/${festival.slug}`}
                      />
                    ))}
                  </div>
                  <Pagination page={cityFestivals.page} totalPages={cityFestivals.totalPages} basePath={`/cities/${slug}`} filters={filters} />
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-black/[0.15] bg-white/70 px-5 py-10 text-center">
                  <p className="text-sm text-black/55">РћС‰Рµ РЅСЏРјР° РїСѓР±Р»РёРєСѓРІР°РЅРё С„РµСЃС‚РёРІР°Р»Рё Р·Р° С‚РѕР·Рё РіСЂР°Рґ.</p>
                  <Link
                    href="/festivals"
                    className="mt-4 inline-flex rounded-full border border-black/[0.1] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition hover:border-black/20 hover:bg-black/[0.03]"
                  >
                    Р Р°Р·РіР»РµРґР°Р№ РІСЃРёС‡РєРё С„РµСЃС‚РёРІР°Р»Рё
                  </Link>
                </div>
              )}
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-2xl border border-black/[0.08] bg-white/80 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_8px_22px_rgba(12,14,20,0.07)]">
                <h3 className="text-lg font-semibold">РџРѕРїСѓР»СЏСЂРЅРё РєР°С‚РµРіРѕСЂРёРё РІ {cityName}</h3>
                {popularCategories.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {popularCategories.map(([category, count]) => (
                      <span
                        key={category}
                        className="rounded-full border border-black/[0.1] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14]"
                      >
                        {mapCategoryLabel(category)} В· {count}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-black/55">Р’СЃРµ РѕС‰Рµ РЅСЏРјР° РґРѕСЃС‚Р°С‚СЉС‡РЅРѕ РґР°РЅРЅРё Р·Р° РєР°С‚РµРіРѕСЂРёРё.</p>
                )}
              </div>

              <div className="rounded-2xl border border-black/[0.08] bg-white/80 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_8px_22px_rgba(12,14,20,0.07)]">
                <h3 className="text-lg font-semibold">РџСЂРµРґСЃС‚РѕСЏС‰Рё РґР°С‚Рё</h3>
                {upcomingMonths.length ? (
                  <ul className="mt-4 space-y-2 text-sm text-black/65">
                    {upcomingMonths.map(([month, count]) => (
                      <li key={month} className="flex items-center justify-between rounded-xl border border-black/[0.08] bg-white px-3 py-2">
                        <span>{format(parseISO(`${month}-01`), "MMMM yyyy")}</span>
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">{count} СЃСЉР±РёС‚РёСЏ</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-black/55">РќСЏРјР° РїСѓР±Р»РёРєСѓРІР°РЅРё РїСЂРµРґСЃС‚РѕСЏС‰Рё РґР°С‚Рё.</p>
                )}
              </div>
            </section>
          </div>
        </Container>
      </Section>
    </div>
  );
}

