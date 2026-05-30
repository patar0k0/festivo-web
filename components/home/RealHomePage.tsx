import Link from "next/link";
import Container from "@/components/ui/Container";
import { cn } from "@/components/ui/cn";
import EventCard from "@/components/ui/EventCard";
import Section from "@/components/ui/Section";
import { pub } from "@/lib/public-ui/styles";
import { getFestivalLocationDisplay } from "@/lib/location/getFestivalLocationDisplay";
import { getFestivalHeroImage } from "@/lib/festival/getFestivalHeroImage";
import type { HomePageViewProps } from "@/lib/home/loadHomePageData";
import { Festival } from "@/lib/types";
import { hasActivePromotion, hasActiveVip } from "@/lib/monetization";
import QuickChipsClient from "./QuickChipsClient";
import FestivalsCompoundSearch from "@/components/festivals/FestivalsCompoundSearch";
import HomeHeroFolkPattern from "./HomeHeroFolkPattern";
import CurrentFestivalsSection from "./CurrentFestivalsSection";
import CitiesSection from "./CitiesSection";

function publishedFestivalsBulgariaLabel(count: number): string {
  const n = count;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) {
    return `${n} предстоящи фестивала в България`;
  }
  const mod10 = n % 10;
  if (mod10 === 1) {
    return `${n} предстоящ фестивал в България`;
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return `${n} предстоящи фестивала в България`;
  }
  return `${n} предстоящи фестивала в България`;
}

function EventsSection({
  id,
  title,
  festivals,
  seeAllHref,
  priorityFirst = false,
}: {
  id?: string;
  title: string;
  festivals: Festival[];
  seeAllHref: string;
  /**
   * When the section above (CurrentFestivalsSection) is hidden because there
   * are < 3 current festivals, this section's first card becomes the LCP
   * candidate. Set `priorityFirst` only on the topmost rendered section.
   */
  priorityFirst?: boolean;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className={cn(pub.pageTitle, "text-2xl")}>{title}</h2>
        <Link href={seeAllHref} className={cn(pub.chip, pub.focusRing, "hover:bg-[#f7f6f3]")}>
          Виж всички
        </Link>
      </div>

      {festivals.length === 0 ? (
        <div className={cn(pub.sectionCardSoft, "px-6 py-10 text-center text-sm text-black/60")}>
          <p>Няма фестивали за тази секция.</p>
          <Link href="/festivals" className="mt-2 inline-block font-semibold text-[#0c0e14] underline underline-offset-4">
            Виж следващите събития →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:gap-6">
          {festivals.map((festival, index) => (
            <EventCard
              key={festival.slug}
              priority={priorityFirst && index === 0}
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
      )}
    </section>
  );
}

export default function RealHomePage({
  nearestFestivals,
  currentFestivals,
  weekendFestivals,
  monthFestivals,
  homeCityOptions,
  totalFestivalsCount,
  selectedCityName,
  quickChipHrefs,
}: HomePageViewProps) {
  const chips = [
    { label: "Само безплатни", href: quickChipHrefs.free },
    { label: "Този уикенд", href: quickChipHrefs.weekend },
    { label: "Този месец", href: quickChipHrefs.month },
    ...quickChipHrefs.categoryChips,
  ];

  return (
    <div className={cn(pub.pageOverflow, "pb-24 md:pb-0")}>
      <Section className="overflow-x-clip bg-transparent pb-8 pt-12 md:pb-10 md:pt-16">
        <Container>
          <div className="space-y-6 lg:space-y-8">
            <section className={cn(pub.panelHero, "relative overflow-hidden p-4 md:p-5")}>
              <HomeHeroFolkPattern />
              <div className="relative z-[1]">
                <div className="max-w-3xl">
                  <h1 className={cn(pub.displayH1, "font-[var(--font-hero-warm-serif)] text-[#7c2d12]")}>
                    Открий. Планирай. Посети.
                  </h1>
                  <p className={cn(pub.body, "mt-1.5")}>Фестивалите на България — на едно място.</p>
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-900/[0.07] px-3 py-1 text-xs font-medium text-amber-900/70">
                    <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-700/60" aria-hidden />
                    {publishedFestivalsBulgariaLabel(totalFestivalsCount)}
                  </div>
                </div>

                {/* На мобилен — само бутон към /festivals; пълното търсене е в долната лента */}
                <div className="mt-4 md:hidden">
                  <Link
                    href="/festivals"
                    className="inline-flex items-center gap-2 rounded-full bg-[#7c2d12] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#6b2510] active:scale-[0.98]"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
                    </svg>
                    Търси фестивали
                  </Link>
                </div>

                {/* На desktop — compound search */}
                <div className="mt-4 hidden md:block space-y-3">
                  <FestivalsCompoundSearch
                    cities={homeCityOptions.map(c => ({
                      name: c.name,
                      slug: c.slug,
                      filterValue: c.filterValue,
                    }))}
                  />
                  <div>
                    <hr className="border-amber-900/20 my-1" />
                    <QuickChipsClient chips={chips} />
                  </div>
                </div>
              </div>
            </section>

            <CurrentFestivalsSection currentFestivals={currentFestivals} />

            {selectedCityName ? (
              <section className={pub.noticeWarm}>Показваме фестивали в {selectedCityName}</section>
            ) : null}

            <EventsSection
              id="nearest-festivals"
              title="Предстоящи"
              festivals={nearestFestivals}
              seeAllHref="/festivals?when=upcoming"
              // Когато CurrentFestivalsSection е скрита (< 3 текущи фестивала),
              // първият card тук става LCP — даваме му priority.
              priorityFirst={currentFestivals.length < 3}
            />
            <EventsSection title="Този уикенд" festivals={weekendFestivals} seeAllHref="/festivals?when=weekend" />
            {monthFestivals.length > 0 ? (
              <EventsSection title="Този месец" festivals={monthFestivals} seeAllHref={quickChipHrefs.month} />
            ) : null}

            <CitiesSection cities={homeCityOptions} />
          </div>
        </Container>
      </Section>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-amber-200/35 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(12,14,20,0.1)] backdrop-blur md:hidden">
        <FestivalsCompoundSearch
          cities={homeCityOptions.map(c => ({
            name: c.name,
            slug: c.slug,
            filterValue: c.filterValue,
          }))}
        />
      </div>
    </div>
  );
}
