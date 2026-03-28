import Link from "next/link";
import Container from "@/components/ui/Container";
import EventCard from "@/components/ui/EventCard";
import Section from "@/components/ui/Section";
import { cityHref } from "@/lib/cities";
import { festivalCityLabel } from "@/lib/settlements/formatDisplayName";
import { getFestivalHeroImage } from "@/lib/festival/getFestivalHeroImage";
import { Festival } from "@/lib/types";
import CitySelectClient from "./CitySelectClient";
import NearMeCtaClient from "./NearMeCtaClient";
import QuickChipsClient from "./QuickChipsClient";

type CityItem = {
  name: string;
  slug: string | null;
  filterValue: string;
};

type QuickChipHrefs = {
  free: string;
  weekend: string;
  month: string;
  categoryChips: { label: string; href: string }[];
};

type RealHomePageProps = {
  nearestFestivals: Festival[];
  weekendFestivals: Festival[];
  /** Градове от фестивалите в базата (име + стойност за филтър). */
  homeCityOptions: CityItem[];
  selectedCityName?: string | null;
  quickChipHrefs: QuickChipHrefs;
};

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
        <h2 className="text-2xl font-black tracking-tight text-[#0c0e14]">
          {title}
        </h2>
        <Link
          href="/festivals"
          className="rounded-xl border border-black/[0.1] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] transition hover:bg-[#f7f6f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
        >
          Виж всички
        </Link>
      </div>

      {festivals.length === 0 ? (
        <div className="rounded-2xl border border-black/[0.08] bg-white/80 px-6 py-10 text-center text-sm text-black/60">
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
              isFree={festival.is_free}
              description={festival.description}
              showDescription
              showDetailsButton
              detailsHref={`/festivals/${festival.slug}`}
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
}: RealHomePageProps) {
  const footerCities = homeCityOptions.slice(0, 8);
  const chips = [
    { label: "Само безплатни", href: quickChipHrefs.free },
    { label: "Този уикенд", href: quickChipHrefs.weekend },
    { label: "Този месец", href: quickChipHrefs.month },
    ...quickChipHrefs.categoryChips,
  ];

  return (
    <div className="landing-bg overflow-x-hidden pb-24 text-[#0c0e14] md:pb-0">
      <Section className="overflow-x-clip bg-transparent pb-10 pt-24 md:pb-12 md:pt-28">
        <Container>
          <div className="space-y-7 lg:space-y-10">
            <section className="rounded-[28px] border border-black/[0.08] bg-white/75 p-4 shadow-[0_2px_0_rgba(12,14,20,0.05),0_12px_30px_rgba(12,14,20,0.08)] backdrop-blur md:p-7">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">
                  Festivo Preview
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">
                  Открий безплатни фестивали в България
                </h1>
                <p className="mt-2 text-sm text-black/65 md:text-[15px]">
                  Бързо намери събития по град, дата и интерес.
                </p>
                <p className="mt-2 text-xs text-black/45 md:text-sm">
                  Събития от организатори и проверени публични източници
                </p>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                <NearMeCtaClient className="w-full rounded-2xl border border-[#ff4c1f]/30 bg-[#ff4c1f] px-5 py-3 text-center text-sm font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#f24318] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25" />
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
                    className="rounded-2xl border border-black/[0.09] bg-white/90 px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] transition hover:border-black/[0.18] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                  >
                    Избери град
                  </Link>
                )}
                <Link
                  href="/calendar"
                  className="rounded-2xl border border-black/[0.09] bg-white/90 px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] transition hover:border-black/[0.18] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                >
                  Избери дата
                </Link>
              </div>

              <QuickChipsClient chips={chips} />
            </section>

            {selectedCityName ? (
              <section className="rounded-2xl border border-[#ff4c1f]/25 bg-[#fff4ef] px-5 py-3 text-sm font-semibold text-[#7b2d1a] md:px-6">
                Показваме фестивали в {selectedCityName}
              </section>
            ) : null}

            <EventsSection id="nearest-festivals" title="Предстоящи" festivals={nearestFestivals} />
            <EventsSection title="Този уикенд" festivals={weekendFestivals} />

            <section id="home-cities" className="rounded-2xl border border-black/[0.08] bg-white/80 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.07)] backdrop-blur md:p-6">
              <h2 className="text-2xl font-black tracking-tight text-[#0c0e14]">
                Градове
              </h2>
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
                      className="rounded-full border border-black/[0.1] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.13em] text-[#0c0e14] transition hover:bg-[#f7f6f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
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
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/[0.08] bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(12,14,20,0.12)] backdrop-blur md:hidden">
        <NearMeCtaClient className="block w-full rounded-2xl border border-[#ff4c1f]/30 bg-[#ff4c1f] px-5 py-3 text-center text-sm font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#f24318] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25" />
      </div>
    </div>
  );
}
