import Link from "next/link";
import { cityHref } from "@/lib/cities";

export default function CityTiles({ cities }: { cities: Array<{ name: string; slug: string }> }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cities.slice(0, 6).map((city) => (
        <Link
          key={city.slug}
          href={cityHref(city.slug)}
          className="rounded-2xl border border-ink/10 bg-white/80 p-6 text-sm font-semibold uppercase tracking-widest text-ink shadow-soft"
        >
          {city.name}
        </Link>
      ))}
    </div>
  );
}
