import EventCard from "@/components/ui/EventCard";
import { getFestivalHeroImage } from "@/lib/festival/getFestivalHeroImage";
import { formatFestivalDateLineShort } from "@/lib/festival/listingDates";
import { getFestivalLocationDisplay } from "@/lib/location/getFestivalLocationDisplay";
import { Festival } from "@/lib/types";
import { hasActivePromotion, hasActiveVip } from "@/lib/monetization";

/** Same festival card as homepage / listings / map — single visual system. */
export default function FestivalCard({ festival }: { festival: Festival }) {
  const loc = getFestivalLocationDisplay(festival);
  return (
    <EventCard
      title={festival.title}
      city={loc.city ?? ""}
      category={festival.category}
      imageUrl={getFestivalHeroImage(festival)}
      startDate={festival.start_date}
      endDate={festival.end_date}
      dateLine={formatFestivalDateLineShort(festival)}
      occurrenceDates={festival.occurrence_dates}
      startTime={festival.start_time}
      endTime={festival.end_time}
      isPromoted={hasActivePromotion(festival)}
      isVipOrganizer={hasActiveVip(festival.organizer)}
      description={festival.description}
      showDescription
      detailsHref={`/festivals/${festival.slug}`}
      festivalId={festival.id}
    />
  );
}
