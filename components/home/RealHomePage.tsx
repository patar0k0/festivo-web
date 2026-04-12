import Link from "next/link";
import Container from "@/components/ui/Container";
import { cn } from "@/components/ui/cn";
import EventCard from "@/components/ui/EventCard";
import Section from "@/components/ui/Section";
import { pub } from "@/lib/public-ui/styles";
import { festivalCityLabel } from "@/lib/settlements/formatDisplayName";
import { getFestivalHeroImage } from "@/lib/festival/getFestivalHeroImage";
import type { HomePageViewProps } from "@/lib/home/loadHomePageData";
import { Festival } from "@/lib/types";
import { hasActivePromotion, hasActiveVip } from "@/lib/monetization";
import CitySelectClient from "./CitySelectClient";
import HomeDiscoverySearchClient from "./HomeDiscoverySearchClient";
import QuickChipsClient from "./QuickChipsClient";
import HomeHeroFolkPattern from "./HomeHeroFolkPattern";
import CurrentFestivalsSection from "./CurrentFestivalsSection";
import CitiesSection from "./CitiesSection";

function publishedFestivalsBulgariaLabel(count: number): string {
  const n = count;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) {
    return `${n} фестивала в България`;
  }
  const mod10 = n % 10;
  if (mod10 === 1) {
    return `${n} фестивал в България`;
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return `${n} фестивала в България`;
  }
  return `${n} фестивала в България`;
}

function EventsSection({
  id,
  title,
  festivals,
  seeAllHref,
}: {
  id?: string;
  title: string;
  festivals: Festival[];
  seeAllHref: string;
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
          {festivals.map((festival) => (
            <EventCard
              key={festival.slug}
              title={festival.title}
              city={festivalCityLabel(festival)}
              category={festival.category}
              imageUrl={getFestivalHeroImage(festival)}
              startDate={festival.start_date}
              endDate={festival.end_date}
              occurrenceDates={festival.occurrence_dates}
              startTime={festival.start_time}
              endTime={festival.end_time}
              isFree={festival.is_free}
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

  const secondaryDiscoveryActions = (
    <>
      {homeCityOptions.length ? (
        <CitySelectClient
          cities={homeCityOptions.map((city) => ({
            name: city.name,
            slug: city.slug,
            filterValue: city.filterValue,
          }))}
        />
      ) : (
        <Link
          href="/festivals"
          className={cn(
            "rounded-2xl border border-amber-200/40 bg-white/92 px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] shadow-sm ring-1 ring-amber-100/30 transition hover:border-amber-300/55 hover:bg-white",
            pub.focusRing,
          )}
        >
          Избери град
        </Link>
      )}
      <Link
        href="/calendar"
        className={cn(
          "rounded-2xl border border-amber-200/40 bg-white/92 px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] shadow-sm ring-1 ring-amber-100/30 transition hover:border-amber-300/55 hover:bg-white",
          pub.focusRing,
        )}
      >
        Избери дата
      </Link>
    </>
  );

  return (
    <div className={cn(pub.pageOverflow, "pb-24 md:pb-0")}>
      <Section className="overflow-x-clip bg-transparent pb-8 pt-12 md:pb-10 md:pt-16">
        <Container>
          <div className="space-y-6 lg:space-y-8">
            <section className={cn(pub.panelHero, "relative overflow-hidden p-4 md:p-5")}>
              <HomeHeroFolkPattern />
              <div className="relative z-[1]">
                <div className="max-w-3xl">
                  <h1 className={cn(pub.displayH1, "font-[var(--font-hero-warm-serif)]")}>
                    Открий безплатни фестивали в България
                  </h1>
                  <p className={cn(pub.body, "mt-1.5")}>Бързо намери събития по град, дата и интерес.</p>
                  <p className="mt-1.5 text-xs text-amber-900/50 md:text-sm">
                    {publishedFestivalsBulgariaLabel(totalFestivalsCount)}
                  </p>
                  <p className="mt-1.5 text-xs text-black/45 md:text-sm">
                    Събития от организатори и проверени публични източници
                  </p>
                </div>

                <div className="mt-4">
                  <HomeDiscoverySearchClient secondaryActions={secondaryDiscoveryActions} />
                </div>

                <div className="mt-3">
                  <hr className="border-amber-900/20 my-1" />
                  <QuickChipsClient chips={chips} />
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
        <HomeDiscoverySearchClient compact secondaryActions={secondaryDiscoveryActions} />
      </div>
    </div>
  );
}
