import { getFestivals } from "@/lib/queries";
import { withDefaultFilters } from "@/lib/filters";
import { format, parseISO } from "date-fns";
import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import Trails from "@/components/landing/Trails";
import AppCta from "@/components/landing/AppCta";
import Footer from "@/components/landing/Footer";
import LandingClient from "@/components/landing/LandingClient";
import type { Trail } from "@/components/landing/Trails";
import "./landing.css";

// Trails остават редакторски — hard-coded е ок
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
    description: "Фотогенично, спокойно, идеално «после работа».",
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

/** Map category → vibe label за RadarStrip */
function categoryToVibe(category?: string | null): string {
  const map: Record<string, string> = {
    music: "Party",
    party: "Party",
    folk: "Family",
    family: "Family",
    food: "✨ Chill",
    chill: "✨ Chill",
    art: "Culture",
    culture: "Culture",
    theatre: "Culture",
    film: "Culture",
    sport: "Family",
    outdoor: "✨ Chill",
  };
  return map[category?.toLowerCase() ?? ""] ?? "✨ Chill";
}

/** Map category → quick-filter tags */
function categoryToTags(
  category?: string | null,
  startDate?: string | null
): string[] {
  const tags: string[] = [];
  const vibe = categoryToVibe(category);
  if (vibe === "Party") tags.push("party");
  if (vibe === "Family") tags.push("family");
  if (vibe === "✨ Chill") tags.push("chill");
  if (vibe === "Culture") tags.push("culture");

  // date-based tags
  if (startDate) {
    try {
      const d = parseISO(startDate);
      const day = d.getDay(); // 0=Sun, 6=Sat
      if (day === 0 || day === 6) tags.push("weekend");
      const hour = d.getHours();
      if (hour >= 17) tags.push("evening");
    } catch {
      // ignore
    }
  }

  tags.push("outdoor"); // reasonable default for festivals
  return tags;
}

/** Format start_date → human readable BG time string */
function formatTime(startDate?: string | null): string {
  if (!startDate) return "";
  try {
    const d = parseISO(startDate);
    const dayNames = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Съб"];
    const day = dayNames[d.getDay()];
    return `${day} • ${format(d, "HH:mm")}`;
  } catch {
    return "";
  }
}

export default async function HomePage() {
  // Зареждаме до 12 предстоящи безплатни фестивала
  const today = format(new Date(), "yyyy-MM-dd");
  const { data: festivals } = await getFestivals(
    withDefaultFilters({ from: today, free: true }),
    1,
    12,
    { applyDefaults: false }
  ).catch(() => ({ data: [] }));

  // Трансформираме Festival[] → RadarEvent[]
  const radarEvents = festivals.map((f) => ({
    title: f.title,
    city: f.city ?? "България",
    time: formatTime(f.start_date),
    place: f.address ?? f.city ?? "",
    vibe: categoryToVibe(f.category),
    tags: categoryToTags(f.category, f.start_date),
    desc: f.description?.slice(0, 120) ?? "Безплатен фестивал.",
    slug: f.slug,
  }));

  return (
    <div className="landing-bg min-h-screen text-[#0c0e14]">
      <Header />
      <main>
        <Hero />
        <LandingClient initialEvents={radarEvents} trails={trails} />
        <AppCta />
      </main>
      <Footer />
    </div>
  );
}
