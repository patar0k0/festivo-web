import EventCard from "@/components/ui/EventCard";
import { getFestivalHeroImage } from "@/lib/festival/getFestivalHeroImage";
import { formatFestivalDateLineShort } from "@/lib/festival/listingDates";
import { festivalCityLabel } from "@/lib/settlements/formatDisplayName";
import { Festival } from "@/lib/types";
import { hasActivePromotion, hasActiveVip } from "@/lib/monetization";

/** Same festival card as homepage / listings / map — single visual system. */
export default function FestivalCard({ festival }: { festival: Festival }) {
  return (
    <EventCard
      title={festival.title}
      city={festivalCityLabel(festival, "Bulgaria")}
      category={festival.category}
      imageUrl={getFestivalHeroImage(festival)}
      startDate={festival.start_date}
      endDate={festival.end_date}
      dateLine={formatFestivalDateLineShort(festival)}
      isFree={festival.is_free}
      isPromoted={hasActivePromotion(festival)}
      isVipOrganizer={hasActiveVip(festival.organizer)}
      description={festival.description}
      showDescription
      detailsHref={`/festivals/${festival.slug}`}
      festivalId={festival.id}
    />
  );
}
