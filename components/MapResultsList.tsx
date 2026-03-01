import Link from "next/link";
import EventCard from "@/components/ui/EventCard";
import { Festival } from "@/lib/types";

type MapResultsListProps = {
  festivals: Festival[];
};

const COPY = {
  empty: "\u041d\u044f\u043c\u0430 \u0444\u0435\u0441\u0442\u0438\u0432\u0430\u043b\u0438 \u043f\u043e \u0442\u0435\u0437\u0438 \u0444\u0438\u043b\u0442\u0440\u0438.",
};

export default function MapResultsList({ festivals }: MapResultsListProps) {
  if (!festivals.length) {
    return (
      <div className="rounded-xl border border-black/[0.08] bg-white/85 px-4 py-6 text-center text-sm text-black/60">
        {COPY.empty}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {festivals.map((festival) => (
        <Link key={festival.slug} href={`/festival/${festival.slug}`} className="block">
          <EventCard
            title={festival.title}
            city={festival.city}
            category={festival.category}
            imageUrl={festival.image_url}
            startDate={festival.start_date}
            endDate={festival.end_date}
            isFree={festival.is_free}
            description={festival.description}
            showDescription
          />
        </Link>
      ))}
    </div>
  );
}
