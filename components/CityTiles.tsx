import Link from "next/link";
import { slugify } from "@/lib/utils";

export default function CityTiles({ cities }: { cities: string[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cities.slice(0, 6).map((city) => (
        <Link
          key={city}
          href={`/cities/${encodeURIComponent(slugify(city))}`}
          className="rounded-2xl border border-ink/10 bg-white/80 p-6 text-sm font-semibold uppercase tracking-widest text-ink shadow-soft"
        >
          {city}
        </Link>
      ))}
    </div>
  );
}
