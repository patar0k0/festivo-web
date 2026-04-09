"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import EventCard from "@/components/ui/EventCard";
import { pub } from "@/lib/public-ui/styles";
import { cn } from "@/lib/utils";
import { getFestivalHeroImage } from "@/lib/festival/getFestivalHeroImage";
import { festivalCityLabel } from "@/lib/settlements/formatDisplayName";
import { Festival } from "@/lib/types";
import { hasActivePromotion, hasActiveVip } from "@/lib/monetization";

type MapResultsListProps = {
  festivals: Festival[];
  selectedFestivalId?: string | number | null;
  onSelectFestival?: (festival: Festival) => void;
};

export default function MapResultsList({
  festivals,
  selectedFestivalId,
  onSelectFestival,
}: MapResultsListProps) {
  const itemsRef = useRef<Record<string, HTMLDivElement | null>>({});

  const selectedKey = useMemo(() => (selectedFestivalId == null ? null : String(selectedFestivalId)), [selectedFestivalId]);

  useEffect(() => {
    if (!selectedKey) return;
    const node = itemsRef.current[selectedKey];
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedKey]);

  if (!festivals.length) {
    return (
      <div className="rounded-xl border border-black/[0.08] bg-white/85 px-4 py-6 text-center text-sm text-black/60">
        Няма фестивали по тези филтри.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {festivals.map((festival) => {
        const key = String(festival.id);
        const selected = selectedKey === key;
        return (
          <div
            key={festival.slug}
            ref={(node) => {
              itemsRef.current[key] = node;
            }}
            onClick={() => onSelectFestival?.(festival)}
            className={cn("cursor-pointer rounded-2xl transition", selected && pub.selectionRing)}
          >
            <EventCard
              title={festival.title}
              city={festivalCityLabel(festival)}
              category={festival.category}
              imageUrl={getFestivalHeroImage(festival)}
              startDate={festival.start_date}
              endDate={festival.end_date}
              occurrenceDates={festival.occurrence_dates}
              startTime={festival.start_time}
              endTime={festival.end_time}
              isFree={festival.is_free}
              isPromoted={hasActivePromotion(festival)}
              isVipOrganizer={hasActiveVip(festival.organizer)}
              description={festival.description}
              showDescription
              detailsHref={`/festivals/${festival.slug}`}
              showPlanControls
              festivalId={festival.id}
            />
            <Link
              href={`/festivals/${festival.slug}`}
              className={cn(
                "mt-2 inline-flex rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold text-[#0c0e14] transition hover:bg-[#f7f6f3]",
                pub.focusRing,
              )}
            >
              Детайли
            </Link>
          </div>
        );
      })}
    </div>
  );
}

