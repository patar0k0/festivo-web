"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import EventCard from "@/components/ui/EventCard";
import { Festival } from "@/lib/types";

type MapResultsListProps = {
  festivals: Festival[];
  selectedFestivalId?: string | number | null;
  onSelectFestival?: (festival: Festival) => void;
};

export default function MapResultsList({ festivals, selectedFestivalId, onSelectFestival }: MapResultsListProps) {
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
            className={`cursor-pointer rounded-2xl transition ${selected ? "ring-2 ring-[#ff4c1f]/35" : ""}`}
          >
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
            <Link
              href={`/festival/${festival.slug}`}
              className="mt-2 inline-flex rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold text-[#0c0e14] transition hover:bg-[#f7f6f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
            >
              Детайли
            </Link>
          </div>
        );
      })}
    </div>
  );
}
