import Link from "next/link";
import Container from "@/components/ui/Container";
import { cn } from "@/components/ui/cn";
import EventCard from "@/components/ui/EventCard";
import Section from "@/components/ui/Section";
import { pub } from "@/lib/public-ui/styles";
import { cityHref } from "@/lib/cities";
import { festivalCityLabel } from "@/lib/settlements/formatDisplayName";
import { getFestivalHeroImage } from "@/lib/festival/getFestivalHeroImage";
import type { HomePageViewProps } from "@/lib/home/loadHomePageData";
import { Festival } from "@/lib/types";
import { hasActivePromotion, hasActiveVip } from "@/lib/monetization";
import CitySelectClient from "./CitySelectClient";
import HomeDiscoverySearchClient from "./HomeDiscoverySearchClient";
import QuickChipsClient from "./QuickChipsClient";

function EventsSection({
  id,
  title,
  festivals,
}: {
  id?: string;
  title: string;
  festivals: Festival[];
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className={cn(pub.pageTitle, "text-2xl")}>{title}</h2>
        <Link
          href="/festivals"
          className={cn(pub.chip, pub.focusRing, "hover:bg-[#f7f6f3]")}
        >
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
  weekendFestivals,
  homeCityOptions,
  selectedCityName,
  quickChipHrefs,
}: HomePageViewProps) {
  const footerCities = homeCityOptions.slice(0, 8);
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
            <section className={cn(pub.panelHero, "p-4 md:p-5")}>
              <div className="max-w-3xl">
                <p className={pub.eyebrowMuted}>Festivo Preview</p>
                <h1 className={cn(pub.displayH1, "mt-1.5")}>Открий безплатни фестивали в България</h1>
                <p className={cn(pub.body, "mt-1.5")}>Бързо намери събития по град, дата и интерес.</p>
                <p className="mt-1.5 text-xs text-black/45 md:text-sm">
                  Събития от организатори и проверени публични източници
                </p>
              </div>

              <div className="mt-4">
                <HomeDiscoverySearchClient secondaryActions={secondaryDiscoveryActions} />
              </div>

              <QuickChipsClient chips={chips} />
            </section>

            {selectedCityName ? (
              <section className={pub.noticeWarm}>Показваме фестивали в {selectedCityName}</section>
            ) : null}

            <EventsSection id="nearest-festivals" title="Предстоящи" festivals={nearestFestivals} />
            <EventsSection title="Този уикенд" festivals={weekendFestivals} />

            <section id="home-cities" className={cn(pub.panelMuted, "p-5 md:p-6")}>
              <h2 className={cn(pub.pageTitle, "text-2xl")}>Градове</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {footerCities.length ? (
                  footerCities.map((city) => (
                    <Link
                      key={city.filterValue}
                      href={
                        city.slug
                          ? cityHref(city.slug)
                          : `/festivals?city=${encodeURIComponent(city.filterValue)}`
                      }
                      className={cn(pub.chip, pub.focusRing, "hover:bg-[#f7f6f3]")}
                    >
                      {city.name}
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-black/60">
                    Все още няма налични градове.
                  </p>
                )}
              </div>
            </section>
          </div>
        </Container>
      </Section>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-amber-200/35 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(12,14,20,0.1)] backdrop-blur md:hidden">
        <HomeDiscoverySearchClient compact secondaryActions={secondaryDiscoveryActions} />
      </div>
    </div>
  );
}
