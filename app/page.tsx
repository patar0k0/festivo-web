import Image from "next/image";
import Link from "next/link";
import { addDays, format, nextSaturday, nextSunday } from "date-fns";
import StickySearchBar from "@/components/StickySearchBar";
import FestivalGrid from "@/components/FestivalGrid";
import CityTiles from "@/components/CityTiles";
import { getCities, getFestivals } from "@/lib/queries";
import { getBaseUrl } from "@/lib/seo";

export const revalidate = 21600;

export async function generateMetadata() {
  return {
    title: "Festivo — Discover festivals in Bulgaria",
    description: "Browse verified festivals, find dates, and plan weekends across Bulgaria.",
    alternates: {
      canonical: `${getBaseUrl()}/`,
    },
  };
}

export default async function HomePage() {
  const today = new Date();
  const weekendStart = nextSaturday(today);
  const weekendEnd = nextSunday(today);
  const nextMonth = addDays(today, 30);

  const [weekend, nextThirty, cities] = await Promise.all([
    getFestivals(
      {
        from: format(weekendStart, "yyyy-MM-dd"),
        to: format(weekendEnd, "yyyy-MM-dd"),
        free: true,
        sort: "soonest",
      },
      1,
      8
    ),
    getFestivals(
      {
        from: format(today, "yyyy-MM-dd"),
        to: format(nextMonth, "yyyy-MM-dd"),
        free: true,
        sort: "soonest",
      },
      1,
      9
    ),
    getCities(),
  ]);

  return (
    <div className="space-y-20 pb-16">
      <section className="relative overflow-hidden">
        <div className="relative h-[70vh] min-h-[520px] w-full">
          <Image src="/hero.svg" alt="Festivo" fill className="object-cover" priority />
          <div className="absolute inset-0 bg-gradient-to-r from-ink/80 via-ink/40 to-transparent" />
        </div>
        <div className="container-page relative -mt-40 space-y-6">
          <div className="max-w-2xl text-white">
            <p className="text-xs uppercase tracking-[0.3em] text-white/60">Festivo Web</p>
            <h1 className="mt-4 text-4xl font-semibold md:text-6xl">
              Discover the next festival you will love.
            </h1>
            <p className="mt-4 text-sm text-white/80">
              Browse verified events, see dates instantly, and open in the app to save to plan.
            </p>
          </div>
          <StickySearchBar />
        </div>
      </section>

      <section className="container-page space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Featured this weekend</h2>
          <Link href="/festivals" className="text-sm font-semibold text-ink">
            View all →
          </Link>
        </div>
        <FestivalGrid festivals={weekend.data} />
      </section>

      <section className="container-page space-y-6">
        <h2 className="text-2xl font-semibold">Next 30 days</h2>
        <FestivalGrid festivals={nextThirty.data} />
      </section>

      <section className="container-page space-y-6">
        <h2 className="text-2xl font-semibold">Browse by city</h2>
        <CityTiles cities={cities} />
      </section>

      <section className="container-page grid gap-6 md:grid-cols-2">
        <Link
          href="/calendar"
          className="rounded-3xl border border-ink/10 bg-white/80 p-8 shadow-soft"
        >
          <h3 className="text-xl font-semibold">Calendar view</h3>
          <p className="mt-3 text-sm text-muted">Plan your month with the festival calendar.</p>
        </Link>
        <Link
          href="/map"
          className="rounded-3xl border border-ink/10 bg-ink p-8 text-white shadow-card"
        >
          <h3 className="text-xl font-semibold">Map explorer</h3>
          <p className="mt-3 text-sm text-white/70">See festivals on the map and explore nearby.</p>
        </Link>
      </section>
    </div>
  );
}
