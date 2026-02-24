import Link from "next/link";
import {
  addDays,
  endOfDay,
  format,
  isSaturday,
  isSunday,
  nextSaturday,
  nextSunday,
  startOfDay,
} from "date-fns";
import CityTiles from "@/components/CityTiles";
import Container from "@/components/ui/Container";
import HeroSearch from "@/components/ui/HeroSearch";
import EventCard from "@/components/ui/EventCard";
import Section from "@/components/ui/Section";
import { listCities, listFestivals } from "@/lib/festivals";
import { getBaseUrl } from "@/lib/seo";
import { Filters } from "@/lib/types";
import { getSupabaseEnv } from "@/lib/supabaseServer";

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

function getSofiaNow() {
  const sofiaString = new Date().toLocaleString("en-US", { timeZone: "Europe/Sofia" });
  return new Date(sofiaString);
}

function getWeekendRange(now: Date) {
  const saturdayStart = isSaturday(now)
    ? startOfDay(now)
    : isSunday(now)
      ? startOfDay(addDays(now, -1))
      : startOfDay(nextSaturday(now));
  const sundayEnd = isSunday(now)
    ? endOfDay(now)
    : endOfDay(nextSunday(now));
  return { saturdayStart, sundayEnd };
}

export default async function HomePage() {
  const { configured } = getSupabaseEnv();
  const now = getSofiaNow();
  const todayStart = startOfDay(now);
  const next30End = endOfDay(addDays(todayStart, 30));
  const { saturdayStart, sundayEnd } = getWeekendRange(now);

  const rangeFilters: Filters = {};
  const noDefaultFilters = { applyDefaults: false };

  let weekendItems: Awaited<ReturnType<typeof listFestivals>>["data"] = [];
  let nextItems: Awaited<ReturnType<typeof listFestivals>>["data"] = [];
  let fallbackItems: Awaited<ReturnType<typeof listFestivals>>["data"] = [];
  let cities: Awaited<ReturnType<typeof listCities>> = [];
  let fetchFailed = false;

  try {
    const [weekendFestivals, nextFestivals, cityList] = await Promise.all([
      listFestivals(
        {
          ...rangeFilters,
          from: format(saturdayStart, "yyyy-MM-dd"),
          to: format(sundayEnd, "yyyy-MM-dd"),
        },
        1,
        8,
        noDefaultFilters
      ),
      listFestivals(
        {
          ...rangeFilters,
          from: format(todayStart, "yyyy-MM-dd"),
          to: format(next30End, "yyyy-MM-dd"),
        },
        1,
        8,
        noDefaultFilters
      ),
      listCities(),
    ]);

    weekendItems = weekendFestivals.data;
    nextItems = nextFestivals.data;
    cities = cityList;

    if (!weekendItems.length && nextItems.length) {
      weekendItems = nextItems.slice(0, 8);
    }

    if (!nextItems.length) {
      const upcoming = await listFestivals(
        { from: format(todayStart, "yyyy-MM-dd") },
        1,
        12,
        noDefaultFilters
      );
      fallbackItems = upcoming.data;
      if (!weekendItems.length) {
        weekendItems = upcoming.data.slice(0, 8);
      }
      if (!nextItems.length) {
        nextItems = upcoming.data.slice(0, 8);
      }
    }
  } catch (error) {
    fetchFailed = true;
    console.error("[HomePage] Failed to fetch festivals", error);
  }

  const hasAnyFestivals = weekendItems.length > 0 || nextItems.length > 0 || fallbackItems.length > 0;
  const showEnvWarning = !configured;
  const showEmptyState = configured && !hasAnyFestivals;

  return (
    <div className="bg-white text-neutral-900">
      <Section className="py-20">
        <Container>
          <HeroSearch />
        </Container>
      </Section>

      {showEnvWarning ? (
        <Section className="py-6">
          <Container>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Data source not configured.
            </div>
          </Container>
        </Section>
      ) : null}

      {showEmptyState ? (
        <Section className="py-12">
          <Container>
            <div className="rounded-2xl border border-neutral-200 bg-white/80 px-4 py-3 text-sm text-neutral-600">
              No festivals yet.
              {fetchFailed ? " Please try again shortly." : ""}
            </div>
          </Container>
        </Section>
      ) : null}

      {weekendItems.length > 0 ? (
        <Section className="py-20">
          <Container>
            <div>
              <p className="text-xs uppercase tracking-widest text-neutral-400">CURATED</p>
              <h2 className="mt-2 text-3xl font-semibold">Избрано този уикенд</h2>
              <div className="mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {weekendItems.map((festival) => (
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
      ) : null}

      {nextItems.length > 0 ? (
        <Section className="py-20">
          <Container>
            <div>
              <p className="text-xs uppercase tracking-widest text-neutral-400">NEXT 30 DAYS</p>
              <h2 className="mt-2 text-3xl font-semibold">Следващи 30 дни</h2>
              <div className="mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {nextItems.map((festival) => (
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
      ) : null}

      {cities.length > 0 ? (
        <Section className="py-20">
          <Container>
            <div>
              <p className="text-xs uppercase tracking-widest text-neutral-400">CITIES</p>
              <h2 className="mt-2 text-3xl font-semibold">Открий по град</h2>
              <div className="mt-10">
                <CityTiles cities={cities.map((city) => city.name)} />
              </div>
            </div>
          </Container>
        </Section>
      ) : null}

      <Section className="py-20">
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
