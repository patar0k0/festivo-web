import Link from "next/link";
import { notFound } from "next/navigation";
import Container from "@/components/ui/Container";
import EventCard from "@/components/ui/EventCard";
import Pagination from "@/components/Pagination";
import Section from "@/components/ui/Section";
import { getFestivalHeroImage } from "@/lib/festival/getFestivalHeroImage";
import { parseFilters, serializeFilters, withDefaultFilters } from "@/lib/filters";
import { listFestivals } from "@/lib/festivals";
import { getFestivalLocationDisplay } from "@/lib/location/getFestivalLocationDisplay";
import { labelForPublicCategory } from "@/lib/festivals/publicCategories";
import { listPublicFestivalCategorySlugs } from "@/lib/festivals/publicCategories.server";
import { buildBreadcrumbJsonLd, getBaseUrl } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { pub } from "@/lib/public-ui/styles";
import { hasActivePromotion, hasActiveVip } from "@/lib/monetization";
import type { FestivalWhenFilter } from "@/lib/types";
import { cityHref } from "@/lib/cities";

export const revalidate = 21600;

const PAGE_SIZE = 12;

function categoryHref(slug: string) {
  return `/categories/${encodeURIComponent(slug)}`;
}

export async function generateStaticParams() {
  const slugs = await listPublicFestivalCategorySlugs();
  return slugs.map((slug) => ({ slug: encodeURIComponent(slug) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug).trim();
  const label = labelForPublicCategory(decoded);

  const title = `${label} в България | Festivo`;
  const description = `Открий предстоящи ${label.toLowerCase()}и и фестивали в България. Проверени дати, места и програма.`;
  const url = `${getBaseUrl()}/categories/${encodeURIComponent(decoded)}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Festivo",
      locale: "bg_BG",
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function CategoryLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const decoded = decodeURIComponent(slug).trim();

  const allSlugs = await listPublicFestivalCategorySlugs();
  if (!allSlugs.includes(decoded)) {
    notFound();
  }

  const label = labelForPublicCategory(decoded);
  const pageNum = Number(resolvedSearchParams.page ?? 1);
  const safePage = Number.isNaN(pageNum) || pageNum < 1 ? 1 : Math.floor(pageNum);

  const parsedFilters = parseFilters(resolvedSearchParams);
  const filters = withDefaultFilters({ ...parsedFilters, cat: [decoded], sort: "soonest" });

  const data = await listFestivals(filters, safePage, PAGE_SIZE);

  const whenChips: { key: FestivalWhenFilter | "all"; label: string }[] = [
    { key: "all", label: "Всички" },
    { key: "ongoing", label: "Текущи" },
    { key: "upcoming", label: "Предстоящи" },
    { key: "past", label: "Отминали" },
  ];
  const activeWhen = filters.when ?? "all";

  const sectionTitle =
    activeWhen === "past" ? `Минали ${label.toLowerCase()}и` :
    activeWhen === "upcoming" ? `Предстоящи ${label.toLowerCase()}и` :
    activeWhen === "ongoing" ? `Текущи ${label.toLowerCase()}и` :
    `${label} в България`;

  const emptyStateMessage =
    activeWhen === "past" ? `Няма регистрирани минали ${label.toLowerCase()}и.` :
    activeWhen === "upcoming" ? `Няма предстоящи ${label.toLowerCase()}и. Провери в раздел „Всички" за минали издания.` :
    activeWhen === "ongoing" ? `Няма текущи ${label.toLowerCase()}и в момента.` :
    `Все още няма публикувани ${label.toLowerCase()}и.`;

  const basePath = categoryHref(decoded);

  return (
    <div className={pub.page}>
      <Section className={pub.section}>
        <Container>
          <div className="space-y-8">
            <section className={cn(pub.panelHero, "p-6 md:p-8")}>
              <p className={pub.eyebrowMuted}>Категория</p>
              <h1 className={cn(pub.pageTitle, "mt-2")}>{label} в България</h1>
              <p className={cn(pub.body, "mt-3 max-w-2xl text-black/60")}>
                Открий предстоящи {label.toLowerCase()}и по градове, дати и програма. Запази в план и получавай напомняния.
              </p>

              <div className="mt-5 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`${basePath}${serializeFilters({ ...filters, cat: [decoded], free: true })}`}
                    className={cn(pub.chip, pub.focusRing, "hover:bg-black/[0.03]")}
                  >
                    Само безплатни
                  </Link>
                  <Link
                    href="/festivals"
                    className={cn(pub.chip, pub.focusRing, "hover:bg-black/[0.03]")}
                  >
                    Всички фестивали
                  </Link>
                </div>

                <hr className="border-amber-900/10" />

                <div className="flex items-center gap-3">
                  <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.12em] text-black/35">Кога</span>
                  <div className="flex min-w-0 overflow-x-auto rounded-full border border-black/[0.1] bg-white/70 p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {whenChips.map(({ key, label: chipLabel }) => {
                      const href = `${basePath}${serializeFilters({ ...filters, cat: [decoded], when: key as FestivalWhenFilter })}`;
                      return (
                        <Link
                          key={key}
                          href={href}
                          className={cn(
                            pub.focusRing,
                            "shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] transition-all duration-150",
                            activeWhen === key
                              ? "bg-[#7c2d12] text-white shadow-sm"
                              : "text-black/55 hover:text-[#0c0e14]"
                          )}
                        >
                          {chipLabel}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 className={cn(pub.pageTitle, "text-2xl")}>{sectionTitle}</h2>
                <Link
                  href={`/festivals?tag=${encodeURIComponent(decoded)}`}
                  className="text-sm font-semibold text-[#0c0e14] transition hover:text-black/65"
                >
                  Виж всички във Фестивали
                </Link>
              </div>

              {data.data.length ? (
                <>
                  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {data.data.map((festival) => (
                      <EventCard
                        key={festival.slug}
                        title={festival.title}
                        city={getFestivalLocationDisplay(festival).city ?? ""}
                        category={festival.category}
                        imageUrl={getFestivalHeroImage(festival)}
                        startDate={festival.start_date}
                        endDate={festival.end_date}
                        occurrenceDates={festival.occurrence_dates}
                        startTime={festival.start_time}
                        endTime={festival.end_time}
                        isPromoted={hasActivePromotion(festival)}
                        isVipOrganizer={hasActiveVip(festival.organizer)}
                        description={festival.description}
                        showDescription
                        showDetailsButton
                        detailsHref={`/festivals/${festival.slug}`}
                        festivalId={festival.id}
                      />
                    ))}
                  </div>
                  <Pagination
                    page={data.page}
                    totalPages={data.totalPages}
                    basePath={basePath}
                    filters={filters}
                  />
                </>
              ) : (
                <div className={cn(pub.sectionCardSoft, "border-dashed px-5 py-10 text-center")}>
                  <p className="text-sm text-black/55">{emptyStateMessage}</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {activeWhen !== "all" && (
                      <Link
                        href={`${basePath}${serializeFilters({ ...filters, cat: [decoded], when: "all" })}`}
                        className={cn("inline-flex", pub.chip, pub.focusRing)}
                      >
                        Виж всички
                      </Link>
                    )}
                    {activeWhen !== "past" && (
                      <Link
                        href={`${basePath}${serializeFilters({ ...filters, cat: [decoded], when: "past" })}`}
                        className={cn("inline-flex", pub.chip, pub.focusRing)}
                      >
                        Виж минали
                      </Link>
                    )}
                    <Link
                      href="/festivals"
                      className={cn("inline-flex", pub.chip, pub.focusRing)}
                    >
                      Разгледай всички в България
                    </Link>
                  </div>
                </div>
              )}
            </section>

            <section className={cn(pub.sectionCardSoft, "p-5")}>
              <h3 className={pub.sectionTitleMd}>Градове с {label.toLowerCase()}и</h3>
              <p className="mt-3 text-sm text-black/55">
                Разгледай{" "}
                <Link href="/map" className="font-semibold text-[#7c2d12] hover:underline">
                  картата на фестивалите
                </Link>{" "}
                за да намериш {label.toLowerCase()}и близо до теб, или разгледай{" "}
                <Link href="/calendar" className="font-semibold text-[#7c2d12] hover:underline">
                  календара
                </Link>{" "}
                за предстоящи дати.
              </p>
            </section>
          </div>
        </Container>
      </Section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildBreadcrumbJsonLd([
              { name: "Начало", url: `${getBaseUrl().replace(/\/$/, "")}/` },
              { name: "Фестивали", url: `${getBaseUrl().replace(/\/$/, "")}/festivals` },
              { name: label },
            ])
          ),
        }}
      />
    </div>
  );
}
