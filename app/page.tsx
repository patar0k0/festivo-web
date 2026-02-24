import Link from "next/link";
import { addDays, format, nextSaturday, nextSunday } from "date-fns";
import StickySearchBar from "@/components/StickySearchBar";
import CategoryChips from "@/components/CategoryChips";
import ViewToggle from "@/components/ViewToggle";
import CityTiles from "@/components/CityTiles";
import Container from "@/components/ui/Container";
import HeroSearch from "@/components/ui/HeroSearch";
import EventCard from "@/components/ui/EventCard";
import Section from "@/components/ui/Section";
import { listCities, listFestivals } from "@/lib/festivals";
import { getBaseUrl } from "@/lib/seo";
import { Filters } from "@/lib/types";

export const revalidate = 21600;

export async function generateMetadata() {
  return {
    title: "Festivo — Discover festivals in Bulgaria",
    description: "Browse published festivals, find dates, and plan weekends across Bulgaria.",
    alternates: {
      canonical: `${getBaseUrl()}/`,
    },
  };
}

export default async function HomePage() {
  const today = new Date();
  const weekendStart = nextSaturday(today);
  const weekendEnd = nextSunday(today);
  const next30Days = addDays(today, 30);

  const baseFilters: Filters = { free: true };

  const [weekendFestivals, nextFestivals, cities] = await Promise.all([
    listFestivals(
      {
        ...baseFilters,
        from: format(weekendStart, "yyyy-MM-dd"),
        to: format(weekendEnd, "yyyy-MM-dd"),
      },
      1,
      8
    ),
    listFestivals(
      {
        ...baseFilters,
        from: format(today, "yyyy-MM-dd"),
        to: format(next30Days, "yyyy-MM-dd"),
      },
      1,
      8
    ),
    listCities(),
  ]);

  return (
    <div className="bg-white text-neutral-900">
      <Section className="py-20">
        <Container>
          <HeroSearch />
        </Container>
      </Section>

      <Section className="py-10">
        <Container>
          <div className="sticky top-4 z-30 space-y-4">
            <StickySearchBar initialFilters={baseFilters} />
            <div className="flex flex-wrap items-center justify-between gap-4">
              <CategoryChips filters={baseFilters} />
              <ViewToggle active="/festivals" filters={baseFilters} />
            </div>
          </div>
        </Container>
      </Section>

      <Section className="py-20">
        <Container>
          <div className="space-y-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-neutral-400">CURATED</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Избрано този уикенд</h2>
            </div>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {weekendFestivals.data.map((festival) => (
                <Link key={festival.slug} href={`/festival/${festival.slug}`} className="group">
                  <EventCard
                    title={festival.title}
                    city={festival.city}
                    category={festival.category}
                    imageUrl={festival.image_url}
                    startDate={festival.start_date}
                    endDate={festival.end_date}
                    isFree={festival.is_free}
                  />
                </Link>
              ))}
            </div>
          </div>
        </Container>
      </Section>

      <Section className="py-20">
        <Container>
          <div className="space-y-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-neutral-400">NEXT 30 DAYS</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Следващи 30 дни</h2>
            </div>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {nextFestivals.data.map((festival) => (
                <Link key={festival.slug} href={`/festival/${festival.slug}`} className="group">
                  <EventCard
                    title={festival.title}
                    city={festival.city}
                    category={festival.category}
                    imageUrl={festival.image_url}
                    startDate={festival.start_date}
                    endDate={festival.end_date}
                    isFree={festival.is_free}
                  />
                </Link>
              ))}
            </div>
          </div>
        </Container>
      </Section>

      <Section className="py-20">
        <Container>
          <div className="space-y-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-neutral-400">CITIES</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Открий по град</h2>
            </div>
            <CityTiles cities={cities.map((city) => city.name)} />
          </div>
        </Container>
      </Section>

      <Section className="py-16">
        <Container>
          <div className="grid gap-6 md:grid-cols-2">
            <Link href="/calendar" className="rounded-2xl border border-neutral-200 bg-white/80 p-6">
              <h3 className="text-lg font-semibold">Календар</h3>
              <p className="mt-2 text-sm text-neutral-600">Разгледай събитията по дни и месец.</p>
            </Link>
            <Link href="/map" className="rounded-2xl border border-neutral-200 bg-white/80 p-6">
              <h3 className="text-lg font-semibold">Карта</h3>
              <p className="mt-2 text-sm text-neutral-600">Виж фестивалите около теб.</p>
            </Link>
          </div>
        </Container>
      </Section>
    </div>
  );
}
