import Link from "next/link";
import { cn } from "@/components/ui/cn";
import EventCard from "@/components/ui/EventCard";
import { pub } from "@/lib/public-ui/styles";
import { getFestivalListingCityPrimary } from "@/lib/settlements/getCityLabel";
import { getFestivalHeroImage } from "@/lib/festival/getFestivalHeroImage";
import { Festival } from "@/lib/types";
import { hasActivePromotion, hasActiveVip } from "@/lib/monetization";

type Props = {
  currentFestivals: Festival[];
};

export default function CurrentFestivalsSection({ currentFestivals }: Props) {
  if (currentFestivals.length < 3) {
    return null;
  }

  return (
    <section id="current-festivals" className="scroll-mt-24 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 md:gap-3">
          <h2 className={cn(pub.pageTitle, "text-2xl")}>В момента</h2>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/25 bg-emerald-50/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-800 shadow-sm ring-1 ring-emerald-600/10"
            aria-label="Тече в момента"
          >
            <span
              className="size-1.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.35)] animate-pulse"
              aria-hidden="true"
            />
            LIVE
          </span>
        </div>
        <Link
          href="/festivals?when=now"
          className={cn(pub.chip, pub.focusRing, "hover:bg-[#f7f6f3]")}
        >
          Виж всички
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:gap-6">
        {currentFestivals.slice(0, 3).map((festival) => (
          <EventCard
            key={festival.slug}
            title={festival.title}
            city={getFestivalListingCityPrimary(festival)}
            category={festival.category}
            imageUrl={getFestivalHeroImage(festival)}
            startDate={festival.start_date}
            endDate={festival.end_date}
            occurrenceDates={festival.occurrence_dates}
            startTime={festival.start_time}
            endTime={festival.end_time}
            isPromoted={hasActivePromotion(festival)}
            isVipOrganizer={hasActiveVip(festival.organizer)}
            description={festival.description}
            showDescription
            showDetailsButton
            detailsHref={`/festivals/${festival.slug}`}
            festivalId={festival.id}
          />
        ))}
      </div>
    </section>
  );
}
