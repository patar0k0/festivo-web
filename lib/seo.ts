import { Festival } from "@/lib/types";

export function getBaseUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://festivo.bg";
}

export function festivalMeta(festival: Festival) {
  const title = `${festival.title} in ${festival.city ?? "Bulgaria"}`;
  const description = festival.description
    ? festival.description.slice(0, 160)
    : "Discover festival dates, program highlights, and city details.";

  return { title, description };
}

export function cityMeta(city: string) {
  return {
    title: `Festivals in ${city}`,
    description: `Browse verified festivals happening in ${city}. Filter by date, category, and free entry.`,
  };
}

export function listMeta() {
  return {
    title: "Festivals",
    description: "Browse verified festivals, filter by city and date, and plan your next weekend.",
  };
}

export function calendarMeta(month: string) {
  return {
    title: `Festival calendar · ${month}`,
    description: `Plan your month with festivals in ${month}.`,
  };
}

export function buildFestivalJsonLd(festival: Festival) {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: festival.title,
    startDate: festival.start_date,
    endDate: festival.end_date ?? festival.start_date,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    image: festival.hero_image ?? festival.cover_image,
    url: `${getBaseUrl()}/festival/${festival.slug}`,
    location: {
      "@type": "Place",
      name: festival.city ?? "Bulgaria",
      address: {
        "@type": "PostalAddress",
        addressLocality: festival.city ?? undefined,
        addressRegion: festival.region ?? undefined,
        streetAddress: festival.address ?? undefined,
        addressCountry: "BG",
      },
    },
  };
}
