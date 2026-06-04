import Link from "next/link";
import { cn } from "@/components/ui/cn";
import { pub } from "@/lib/public-ui/styles";
import { cityHref } from "@/lib/cities";
import type { HomeCityOption } from "@/lib/home/loadHomePageData";

export default function CitiesSection({ cities }: { cities: HomeCityOption[] }) {
  // Секцията „Места" показва най-популярните градове (по брой фестивали),
  // независимо от азбучната подредба, която ползва търсачката.
  const top = [...cities]
    .sort((a, b) => b.publishedFestivalCount - a.publishedFestivalCount)
    .slice(0, 10);

  return (
    <section id="home-cities" className={cn(pub.panelMuted, "p-5 md:p-6")}>
      <h2 className={cn(pub.pageTitle, "text-2xl")}>Места</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {top.length ? (
          top.map((city) => (
            <Link
              key={city.filterValue}
              href={
                city.slug ? cityHref(city.slug) : `/festivals?city=${encodeURIComponent(city.filterValue)}`
              }
              className={cn(pub.chip, pub.focusRing, "hover:bg-[#f7f6f3]")}
            >
              <span>{city.name}</span>
            </Link>
          ))
        ) : (
          <p className="text-sm text-black/60">Все още няма налични места.</p>
        )}
      </div>
    </section>
  );
}
