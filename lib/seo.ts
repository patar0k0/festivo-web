import { festivalCityLabel } from "@/lib/settlements/formatDisplayName";
import { Festival } from "@/lib/types";
import { getFestivalStartInstant } from "@/lib/notifications/time";

export function getBaseUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://festivo.bg";
}

export function festivalMeta(festival: Festival) {
  const place = festivalCityLabel(festival, "България");
  const title = `${festival.title} · ${place}`;
  const description = festival.description
    ? festival.description.slice(0, 160)
    : "Discover festival dates, program highlights, and city details.";

  return { title, description };
}

export function cityMeta(city: string) {
  return {
    title: `Festivals in ${city}`,
    description: `Browse published festivals happening in ${city}. Filter by date, category, and free entry.`,
  };
}

export function listMeta() {
  return {
    title: "Festivals",
    description: "Browse published festivals, filter by city and date, and plan your next weekend.",
  };
}

export function calendarMeta(month: string) {
  return {
    title: `Festival calendar · ${month}`,
    description: `Plan your month with festivals in ${month}.`,
  };
}

export function buildFestivalJsonLd(festival: Festival) {
  const locality = festivalCityLabel(festival, "България");
  const startInst = getFestivalStartInstant(festival.start_date ?? null, festival.start_time ?? null);
  const endDay = festival.end_date ?? festival.start_date;
  const endInst =
    festival.end_time && endDay ? getFestivalStartInstant(endDay, festival.end_time) : null;
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: festival.title,
    startDate: startInst ? startInst.toISOString() : festival.start_date,
    endDate: endInst ? endInst.toISOString() : (festival.end_date ?? festival.start_date),
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    image: festival.image_url,
    url: `${getBaseUrl()}/festivals/${festival.slug}`,
    location: {
      "@type": "Place",
      name: locality,
      address: {
        "@type": "PostalAddress",
        addressLocality: locality || undefined,
        streetAddress: festival.address ?? undefined,
        addressCountry: "BG",
      },
    },
  };
}

