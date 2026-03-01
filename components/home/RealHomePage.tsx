import Link from "next/link";
import { festivalCategoryLabels } from "@/components/CategoryChips";
import Container from "@/components/ui/Container";
import EventCard from "@/components/ui/EventCard";
import Section from "@/components/ui/Section";
import { Festival } from "@/lib/types";

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

function EventsSection({ title, festivals }: { title: string; festivals: Festival[] }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-black tracking-tight text-[#0c0e14]">{title}</h2>
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
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 xl:gap-6">
          {festivals.map((festival) => (
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
      )}
    </section>
  );
}

export default function RealHomePage({ nearestFestivals, weekendFestivals, topCities, quickChipHrefs }: RealHomePageProps) {
  return (
    <div className="landing-bg overflow-x-hidden text-[#0c0e14]">
      <Section className="overflow-x-clip bg-transparent pb-10 pt-8 md:pb-12 md:pt-10">
        <Container>
          <div className="space-y-8 lg:space-y-10">
            <section className="rounded-[28px] border border-black/[0.08] bg-white/75 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_12px_30px_rgba(12,14,20,0.08)] backdrop-blur md:p-7">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">Festivo Preview</p>
                <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Открий фестивалите в България</h1>
                <p className="mt-3 text-sm text-black/65 md:text-[15px]">Избери град, дата и категория и планирай следващото си събитие.</p>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <Link
                  href="/festivals"
                  className="rounded-2xl border border-black/[0.09] bg-white/90 px-5 py-4 text-center text-sm font-semibold uppercase tracking-[0.14em] text-[#0c0e14] transition hover:border-black/[0.18] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                >
                  Фестивали
                </Link>
                <Link
                  href="/map"
                  className="rounded-2xl border border-black/[0.09] bg-white/90 px-5 py-4 text-center text-sm font-semibold uppercase tracking-[0.14em] text-[#0c0e14] transition hover:border-black/[0.18] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                >
                  Карта
                </Link>
                <Link
                  href="/calendar"
                  className="rounded-2xl border border-black/[0.09] bg-white/90 px-5 py-4 text-center text-sm font-semibold uppercase tracking-[0.14em] text-[#0c0e14] transition hover:border-black/[0.18] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                >
                  Календар
                </Link>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href={quickChipHrefs.free}
                  className="rounded-full border border-black/[0.1] bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] transition hover:border-black/20 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                >
                  Само безплатни
                </Link>
                <Link
                  href={quickChipHrefs.weekend}
                  className="rounded-full border border-black/[0.1] bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] transition hover:border-black/20 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                >
                  Този уикенд
                </Link>
                <Link
                  href={quickChipHrefs.month}
                  className="rounded-full border border-black/[0.1] bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] transition hover:border-black/20 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                >
                  Този месец
                </Link>
                {quickChipHrefs.categories.map((href, index) => {
                  const key = CATEGORY_KEYS[index];
                  return (
                    <Link
                      key={key}
                      href={href}
                      className="rounded-full border border-black/[0.1] bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] transition hover:border-black/20 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                    >
                      {festivalCategoryLabels[key] ?? key}
                    </Link>
                  );
                })}
              </div>
            </section>

            <EventsSection title="Най-близки" festivals={nearestFestivals} />
            <EventsSection title="Този уикенд" festivals={weekendFestivals} />

            <section className="rounded-2xl border border-black/[0.08] bg-white/80 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.07)] backdrop-blur md:p-6">
              <h2 className="text-2xl font-black tracking-tight text-[#0c0e14]">Градове</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {topCities.length ? (
                  topCities.map((city) => (
                    <Link
                      key={city.slug}
                      href={`/cities/${city.slug}`}
                      className="rounded-full border border-black/[0.1] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.13em] text-[#0c0e14] transition hover:bg-[#f7f6f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                    >
                      {city.name}
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-black/60">Все още няма налични градове.</p>
                )}
              </div>
            </section>
          </div>
        </Container>
      </Section>
    </div>
  );
}
