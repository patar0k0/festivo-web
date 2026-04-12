import Link from "next/link";
import { cn } from "@/components/ui/cn";
import { pub } from "@/lib/public-ui/styles";
import { cityHref } from "@/lib/cities";
import type { HomeCityOption } from "@/lib/home/loadHomePageData";

export default function CitiesSection({ cities }: { cities: HomeCityOption[] }) {
  const top = cities.slice(0, 8);

  return (
    <section id="home-cities" className={cn(pub.panelMuted, "p-5 md:p-6")}>
      <h2 className={cn(pub.pageTitle, "text-2xl")}>Градове</h2>
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
              <span className="text-amber-900/50"> ({city.publishedFestivalCount})</span>
            </Link>
          ))
        ) : (
          <p className="text-sm text-black/60">Все още няма налични градове.</p>
        )}
      </div>
    </section>
  );
}
