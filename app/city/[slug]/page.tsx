import Link from "next/link";
import { format, nextSaturday, nextSunday } from "date-fns";
import CityIntro from "@/components/CityIntro";
import FestivalGrid from "@/components/FestivalGrid";
import { listFestivals, listFestivalsByCity } from "@/lib/festivals";
import { cityMeta, getBaseUrl } from "@/lib/seo";
import { toTitleCase } from "@/lib/utils";

export const revalidate = 21600;

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const cityName = toTitleCase(decodeURIComponent(params.slug).replace(/-/g, " "));
  const meta = cityMeta(cityName);
  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: `${getBaseUrl()}/city/${params.slug}`,
    },
  };
}

export default async function CityPage({ params }: { params: { slug: string } }) {
  const cityName = decodeURIComponent(params.slug).replace(/-/g, " ");
  const cityTitle = toTitleCase(cityName);
  const cityQuery = cityTitle;
  const today = new Date();
  const weekendStart = nextSaturday(today);
  const weekendEnd = nextSunday(today);

  const [cityFestivals, weekend] = await Promise.all([
    listFestivalsByCity(cityQuery, { city: [cityQuery], free: true }, 1, 12),
    listFestivals(
      {
        city: [cityQuery],
        from: format(weekendStart, "yyyy-MM-dd"),
        to: format(weekendEnd, "yyyy-MM-dd"),
        free: true,
      },
      1,
      6
    ),
  ]);

  return (
    <div className="container-page space-y-10 py-10">
      <CityIntro city={cityTitle} />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Този уикенд в {cityTitle}</h2>
          <Link href={`/festivals?city=${encodeURIComponent(cityName)}`} className="text-sm font-semibold text-ink">
            View all →
          </Link>
        </div>
        <FestivalGrid festivals={weekend.data} />
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Фестивали в {cityTitle}</h2>
        <FestivalGrid festivals={cityFestivals.data} />
      </section>

      <section className="rounded-2xl border border-ink/10 bg-white/80 p-6">
        <h3 className="text-lg font-semibold">Планирай месеца</h3>
        <p className="mt-2 text-sm text-muted">
          Виж календара за {format(today, "MMMM yyyy")} и филтрирай по град.
        </p>
        <Link
          href={`/calendar/${format(today, "yyyy-MM")}?city=${encodeURIComponent(cityName)}`}
          className="mt-4 inline-flex rounded-full border border-ink/10 px-5 py-2 text-xs font-semibold uppercase tracking-widest"
        >
          Open calendar
        </Link>
      </section>
    </div>
  );
}
