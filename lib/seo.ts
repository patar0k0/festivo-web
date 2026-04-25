import { maxIsoDate, minIsoDate, normalizeOccurrenceDatesInput } from "@/lib/festival/occurrenceDates";
import { primaryFestivalDate } from "@/lib/festival/listingDates";
import { festivalCityLabel, festivalSettlementDisplayText } from "@/lib/settlements/formatDisplayName";
import { festivalSettlementSourceText } from "@/lib/settlements/festivalCityText";
import { Festival } from "@/lib/types";
import { getFestivalStartInstant } from "@/lib/notifications/time";

export function getBaseUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://festivo.bg";
}

/** Absolute URL for OG / JSON-LD when the stored value may be relative. */
export function toAbsoluteSiteUrl(href: string | null | undefined): string | undefined {
  const raw = href?.trim();
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = getBaseUrl().replace(/\/$/, "");
  return `${base}/${raw.replace(/^\//, "")}`;
}

export function festivalShareImageUrl(festival: Festival): string | undefined {
  return toAbsoluteSiteUrl(festival.hero_image ?? null) ?? toAbsoluteSiteUrl(festival.image_url ?? null);
}

export function festivalMeta(festival: Festival) {
  const place = festivalCityLabel(festival, "България");
  const title = `${festival.title} · ${place}`;
  const desc = festival.description?.trim();
  const description = desc ? desc.slice(0, 160) : undefined;
  const shareImageUrl = festivalShareImageUrl(festival);
  return { title, description, shareImageUrl };
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

type FestivalOrganizerLinkRow = {
  sort_order?: number | null;
  organizers?: { id?: string | null; name?: string | null; slug?: string | null } | null;
};

function organizerJsonLdBlocks(
  festival: Festival,
  baseUrl: string,
): Array<{ "@type": "Organization"; name: string; url?: string }> {
  const links = (festival as Festival & { festival_organizers?: FestivalOrganizerLinkRow[] | null })
    .festival_organizers;

  const fromLinks = (links ?? [])
    .map((link) => {
      const org = link.organizers;
      const name = org?.name?.trim();
      const slug = org?.slug?.trim();
      if (!name) return null;
      const url = slug ? `${baseUrl}/organizers/${encodeURIComponent(slug)}` : undefined;
      const order = typeof link.sort_order === "number" ? link.sort_order : 9999;
      return {
        order,
        block: { "@type": "Organization" as const, name, url },
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => a.order - b.order)
    .map((row) => row.block);

  if (fromLinks.length) return fromLinks;

  const name = festival.organizer?.name?.trim() || festival.organizer_name?.trim();
  if (!name) return [];
  const slug = festival.organizer?.slug?.trim();
  const url = slug ? `${baseUrl}/organizers/${encodeURIComponent(slug)}` : undefined;
  return [{ "@type": "Organization", name, url }];
}

function addressLocality(festival: Festival): string | undefined {
  const raw = festivalSettlementSourceText({
    cityRelation: festival.cities ?? null,
    city_name_display: festival.city_name_display,
    city_guess: (festival as Festival & { city_guess?: string | null }).city_guess ?? null,
  });
  if (!raw?.trim()) return undefined;
  return (
    festivalSettlementDisplayText(raw, festival.cities?.is_village ?? undefined) ??
    raw.trim()
  );
}

function placeName(festival: Festival): string | undefined {
  const loc = festival.location_name?.trim();
  if (loc) return loc;
  const venue = festival.venue_name?.trim();
  if (venue) return venue;
  return addressLocality(festival);
}

function stripJsonLdEmpty(value: unknown): unknown {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") {
    return value.trim() === "" ? undefined : value;
  }
  if (Array.isArray(value)) {
    const next = value.map(stripJsonLdEmpty).filter((v) => v !== undefined);
    return next.length ? next : undefined;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      const s = stripJsonLdEmpty(v);
      if (s !== undefined) out[k] = s;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return value;
}

export type BuildFestivalJsonLdOptions = {
  /** Gallery / extra image URLs (same as festival detail media). */
  mediaUrls?: string[];
};

export function buildFestivalJsonLd(
  festival: Festival,
  options: BuildFestivalJsonLdOptions = {},
): Record<string, unknown> | null {
  const baseUrl = getBaseUrl().replace(/\/$/, "");
  const pageUrl = `${baseUrl}/festivals/${encodeURIComponent(festival.slug)}`;

  const occ = normalizeOccurrenceDatesInput(festival.occurrence_dates);
  let startDate: string | undefined;
  let endDate: string | undefined;

  if (occ?.length) {
    const lo = minIsoDate(occ);
    const hi = maxIsoDate(occ);
    if (lo) startDate = lo;
    if (hi) endDate = hi;
    if (startDate && !endDate) endDate = startDate;
  } else {
    const startDay = festival.start_date?.trim() || primaryFestivalDate(festival);
    const endDay = festival.end_date?.trim() || startDay;
    const startInst = startDay ? getFestivalStartInstant(startDay, festival.start_time ?? null) : null;
    const endInst =
      endDay && festival.end_time ? getFestivalStartInstant(endDay, festival.end_time) : null;

    if (startInst && !Number.isNaN(startInst.getTime())) {
      startDate = startInst.toISOString();
    } else if (startDay && /^\d{4}-\d{2}-\d{2}$/.test(startDay)) {
      startDate = startDay;
    }

    if (endInst && !Number.isNaN(endInst.getTime())) {
      endDate = endInst.toISOString();
    } else if (endDay && /^\d{4}-\d{2}-\d{2}$/.test(endDay)) {
      endDate = endDay;
    } else if (startDate && !endDate) {
      endDate = startDate;
    }
  }

  const statusLower = festival.status?.toLowerCase() ?? "";
  const eventStatus =
    statusLower === "cancelled"
      ? "https://schema.org/EventCancelled"
      : "https://schema.org/EventScheduled";

  const imageUrls: string[] = [];
  const pushImg = (u: string | null | undefined) => {
    const abs = toAbsoluteSiteUrl(u);
    if (abs && !imageUrls.includes(abs)) imageUrls.push(abs);
  };
  pushImg(festival.hero_image);
  pushImg(festival.image_url);
  for (const u of options.mediaUrls ?? []) {
    pushImg(u);
  }

  const locality = addressLocality(festival);
  const pName = placeName(festival);
  const street = festival.address?.trim();

  const address: Record<string, unknown> = { "@type": "PostalAddress" };
  if (locality) address.addressLocality = locality;
  if (street) address.streetAddress = street;
  address.addressCountry = "BG";

  const location: Record<string, unknown> = { "@type": "Place" };
  if (pName) location.name = pName;
  const addrStripped = stripJsonLdEmpty(address) as Record<string, unknown> | undefined;
  if (addrStripped && Object.keys(addrStripped).length > 1) {
    location.address = addrStripped;
  }

  const orgBlocks = organizerJsonLdBlocks(festival, baseUrl);

  const core: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: festival.title.trim(),
    url: pageUrl,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus,
  };

  const desc = festival.description?.trim();
  if (desc) core.description = desc.length > 8000 ? desc.slice(0, 8000) : desc;
  if (startDate) core.startDate = startDate;
  if (endDate) core.endDate = endDate;
  if (festival.is_free === true) core.isAccessibleForFree = true;
  if (imageUrls.length === 1) core.image = imageUrls[0];
  else if (imageUrls.length > 1) core.image = imageUrls;

  if (orgBlocks.length === 1) core.organizer = orgBlocks[0];
  else if (orgBlocks.length > 1) core.organizer = orgBlocks;

  const locStripped = stripJsonLdEmpty(location) as Record<string, unknown> | undefined;
  if (locStripped && Object.keys(locStripped).length > 1) {
    core.location = locStripped;
  }

  const cleaned = stripJsonLdEmpty(core) as Record<string, unknown> | null;
  return cleaned && Object.keys(cleaned).length ? cleaned : null;
}
