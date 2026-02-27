"use client";

import { useMemo, useState } from "react";
import SearchCard from "@/components/landing/SearchCard";
import RadarStrip from "@/components/landing/RadarStrip";
import type { RadarEvent } from "@/components/landing/RadarStrip";
import Trails from "@/components/landing/Trails";
import type { Trail } from "@/components/landing/Trails";
import Planner from "@/components/landing/Planner";
import type { PlanItem } from "@/components/landing/Planner";

type Props = {
  initialEvents: (RadarEvent & { slug?: string })[];
  trails: Trail[];
};

function normalize(value: string) {
  return value.toLowerCase().trim();
}

export default function LandingClient({ initialEvents, trails }: Props) {
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState("");
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);

  const filteredEvents = useMemo(() => {
    const needle = normalize(query);
    return initialEvents.filter((event) => {
      const matchesQuery =
        !needle ||
        normalize(event.title).includes(needle) ||
        normalize(event.city).includes(needle) ||
        normalize(event.place).includes(needle) ||
        normalize(event.vibe).includes(needle) ||
        normalize(event.desc).includes(needle);
      const matchesTag = !activeTag || event.tags.includes(activeTag);
      return matchesQuery && matchesTag;
    });
  }, [query, activeTag, initialEvents]);

  const addPlanItem = (item: PlanItem) => {
    setPlanItems((prev) => {
      if (prev.some((e) => e.title === item.title)) return prev;
      return [...prev, item].sort((a, b) => a.time.localeCompare(b.time));
    });
  };

  const handleAddRadar = (event: RadarEvent) => {
    addPlanItem({
      title: event.title,
      time: event.time,
      city: event.city,
      place: event.place,
      vibe: event.vibe,
    });
  };

  const handleAddTrail = (trail: Trail) => {
    const firstStep = trail.steps[0];
    const city = trail.title.includes("•") ? trail.title.split("•")[0].trim() : "";
    addPlanItem({
      title: trail.title,
      time: firstStep?.time ?? "12:00",
      city: city || "-",
      place: firstStep?.label ?? "Маршрут",
      vibe: "Trail",
    });
  };

  return (
    <>
      {/* Search + filter bar */}
      <div className="mx-auto w-full max-w-[1180px] px-[18px]">
        <SearchCard
          query={query}
          setQuery={setQuery}
          activeTag={activeTag}
          setActiveTag={setActiveTag}
          shownCount={filteredEvents.length}
          onReset={() => { setQuery(""); setActiveTag(""); }}
        />
      </div>

      {/* Radar with real data */}
      <RadarStrip
        events={filteredEvents}
        activeTag={activeTag}
        shownCount={filteredEvents.length}
        onAdd={handleAddRadar}
      />

      {/* Curated trails */}
      <Trails trails={trails} onAdd={handleAddTrail} />

      {/* Planner */}
      <Planner
        items={planItems}
        onRemove={(title) => setPlanItems((prev) => prev.filter((i) => i.title !== title))}
        onClear={() => setPlanItems([])}
      />
    </>
  );
}
