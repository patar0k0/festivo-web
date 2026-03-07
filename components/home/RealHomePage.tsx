import Link from "next/link";
import { festivalCategoryLabels } from "@/components/CategoryChips";
import Container from "@/components/ui/Container";
import EventCard from "@/components/ui/EventCard";
import Section from "@/components/ui/Section";
import { cityHref } from "@/lib/cities";
import { getFestivalHeroImage } from "@/lib/festival/getFestivalHeroImage";
import { Festival } from "@/lib/types";
import CitySelectClient from "./CitySelectClient";
import QuickChipsClient from "./QuickChipsClient";

type CityItem = {
  name: string;
  slug: string;
};

type QuickChipHrefs = {
  free: string;
  weekend: string;
  month: string;
  categories: string[];
};

type RealHomePageProps = {
  nearestFestivals: Festival[];
  weekendFestivals: Festival[];
  topCities: CityItem[];
  quickChipHrefs: QuickChipHrefs;
};

const CATEGORY_KEYS = ["folk", "jazz", "food", "art"] as const;

function EventsSection({
  title,
  festivals,
}: {
  title: string;
  festivals: Festival[];
}) {
  return (
    <section className="space-y-4">
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
          Няма налични фестивали за тази секция.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:gap-6">
          {festivals.map((festival) => (
            <EventCard
              key={festival.slug}
              title={festival.title}
              city={festival.city}
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
  topCities,
  quickChipHrefs,
}: RealHomePageProps) {
  const chips = [
    { label: "Само безплатни", href: quickChipHrefs.free },
    { label: "Този уикенд", href: quickChipHrefs.weekend },
    { label: "Този месец", href: quickChipHrefs.month },
    ...quickChipHrefs.categories.map((href, index) => {
      const key = CATEGORY_KEYS[index];
      return { label: festivalCategoryLabels[key] ?? key, href };
    }),
  ];

  return (
    <div className="landing-bg overflow-x-hidden text-[#0c0e14]">
      <Section className="overflow-x-clip bg-transparent pb-10 pt-24 md:pb-12 md:pt-28">
        <Container>
          <div className="space-y-7 lg:space-y-10">
            <section className="rounded-[28px] border border-black/[0.08] bg-white/75 p-4 shadow-[0_2px_0_rgba(12,14,20,0.05),0_12px_30px_rgba(12,14,20,0.08)] backdrop-blur md:p-7">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">
                  Festivo Preview
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">
                  Намери следващия си фестивал
                </h1>
                <p className="mt-2 text-sm text-black/65 md:text-[15px]">
                  Бързо избери локация и дата, за да видиш най-актуалните
                  събития.
                </p>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                <Link
                  href="/map"
                  className="rounded-2xl border border-[#ff4c1f]/30 bg-[#ff4c1f] px-5 py-3 text-center text-sm font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#f24318] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                >
                  Открий около мен
                </Link>
                {topCities.length ? (
                  <CitySelectClient
                    cities={topCities.map((city) => ({
                      name: city.name,
                      slug: city.slug,
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

            <EventsSection title="Най-близки" festivals={nearestFestivals} />
            <EventsSection title="Този уикенд" festivals={weekendFestivals} />

            <section className="rounded-2xl border border-black/[0.08] bg-white/80 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.07)] backdrop-blur md:p-6">
              <h2 className="text-2xl font-black tracking-tight text-[#0c0e14]">
                Градове
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {topCities.length ? (
                  topCities.map((city) => (
                    <Link
                      key={city.slug}
                      href={cityHref(city.slug)}
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
    </div>
  );
}
