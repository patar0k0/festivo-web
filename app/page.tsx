"use client";

import { useMemo, useState } from "react";
import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import SearchCard from "@/components/landing/SearchCard";
import RadarStrip, { type RadarEvent } from "@/components/landing/RadarStrip";
import Trails, { type Trail } from "@/components/landing/Trails";
import Planner, { type PlanItem } from "@/components/landing/Planner";
import AppCta from "@/components/landing/AppCta";
import Footer from "@/components/landing/Footer";
import "./landing.css";

const radarEvents: RadarEvent[] = [
  {
    title: "Sofia Summer Beats",
    city: "София",
    time: "Съб • 18:30",
    place: "НДК парк",
    vibe: "Party",
    tags: ["weekend", "evening", "party"],
    desc: "Открита сцена + локални артисти. Идеално за “после работа”.",
  },
  {
    title: "Plovdiv Folk Weekend",
    city: "Пловдив",
    time: "Нд • 12:00",
    place: "Стария град",
    vibe: "Family",
    tags: ["weekend", "family", "outdoor", "chill"],
    desc: "Фолклор + занаяти. Дневно, спокойно, супер за деца.",
  },
  {
    title: "Varna Street Food Days",
    city: "Варна",
    time: "Дн • 11:00",
    place: "Морска градина",
    vibe: "? Chill",
    tags: ["today", "weekend", "outdoor", "chill"],
    desc: "Вход свободен. Добър маршрут “храна + разходка” навън.",
  },
  {
    title: "Burgas Art & Light Walk",
    city: "Бургас",
    time: "Пт • 20:00",
    place: "Център",
    vibe: "Culture",
    tags: ["evening", "outdoor", "culture"],
    desc: "Светлинни инсталации + маршрут. Културно и фотогенично.",
  },
];

const trails: Trail[] = [
  {
    title: "София • 3 безплатни неща в събота",
    description: "Дневно + пауза + вечерно. Лесно придвижване.",
    steps: [
      { time: "12:00", label: "Семейно навън" },
      { time: "16:00", label: "Арт/Маркет" },
      { time: "19:30", label: "Концерт FREE" },
    ],
  },
  {
    title: "Културна вечер пеша (център)",
    description: "Фотогенично, спокойно, идеално “после работа”.",
    steps: [
      { time: "18:00", label: "Изложба" },
      { time: "19:30", label: "Светлинна разходка" },
      { time: "21:00", label: "Кино на открито" },
    ],
  },
  {
    title: "Семейно + навън (неделя)",
    description: "Дневни събития, без напрежение. Подходящо за деца.",
    steps: [
      { time: "11:00", label: "Работилница" },
      { time: "14:00", label: "Шоу/Сцена" },
      { time: "17:00", label: "Парк & музика" },
    ],
  },
];

function normalize(value: string) {
  return value.toLowerCase().trim();
}

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState("");
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);

  const filteredEvents = useMemo(() => {
    const needle = normalize(query);
    return radarEvents.filter((event) => {
      const matchesQuery =
        !needle ||
        normalize(event.title).includes(needle) ||
        normalize(event.city).includes(needle) ||
        normalize(event.place).includes(needle) ||
        normalize(event.vibe).includes(needle);
      const matchesTag = !activeTag || event.tags.includes(activeTag);
      return matchesQuery && matchesTag;
    });
  }, [query, activeTag]);

  const addPlanItem = (item: PlanItem) => {
    setPlanItems((prev) => {
      if (prev.some((entry) => entry.title === item.title)) {
        return prev;
      }
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

  const handleRemovePlan = (title: string) => {
    setPlanItems((prev) => prev.filter((item) => item.title !== title));
  };

  const handleReset = () => {
    setQuery("");
    setActiveTag("");
  };

  return (
    <div className="landing-bg min-h-screen text-[#0b1220]">
      <Header />
      <main>
        <Hero />
        <div className="mx-auto w-full max-w-[1180px] px-[18px]">
          <SearchCard
            query={query}
            setQuery={setQuery}
            activeTag={activeTag}
            setActiveTag={setActiveTag}
            shownCount={filteredEvents.length}
            onReset={handleReset}
          />
        </div>
        <RadarStrip
          events={filteredEvents}
          activeTag={activeTag}
          shownCount={filteredEvents.length}
          onAdd={handleAddRadar}
        />
        <Trails trails={trails} onAdd={handleAddTrail} />
        <Planner items={planItems} onRemove={handleRemovePlan} onClear={() => setPlanItems([])} />
        <AppCta />
      </main>
      <Footer />
    </div>
  );
}
