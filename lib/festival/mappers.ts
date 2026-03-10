import type { Festival } from "@/lib/types";
import type { CanonicalFestivalPayload } from "@/lib/festival/schema";

type PendingFestivalRowLike = {
  title: string;
  slug?: string | null;
  description?: string | null;
  category?: string | null;
  tags?: unknown;
  city_id?: number | null;
  city?: string | null;
  region?: string | null;
  location_name?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  organizer_name?: string | null;
  hero_image?: string | null;
  website_url?: string | null;
  ticket_url?: string | null;
  price_range?: string | null;
  source_url?: string | null;
  source_type?: string | null;
  status?: string | null;
  city_name_display?: string | null;
  city_name?: string | null;
  city_guess?: string | null;
  cityRelation?: {
    name_bg?: string | null;
    slug?: string | null;
  } | null;
};

type FestivalRowLike = Festival & {
  city_name_display?: string | null;
  city_name?: string | null;
};

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((tag) => (typeof tag === "string" ? tag.trim() : "")).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
}

function cityDisplayFallback(row: PendingFestivalRowLike | FestivalRowLike): string | null {
  const cityRelation = (row as PendingFestivalRowLike).cityRelation;
  return (
    normalizeText(row.city_name_display) ??
    normalizeText(row.city_name) ??
    normalizeText(cityRelation?.name_bg) ??
    normalizeText(cityRelation?.slug) ??
    normalizeText(row.city) ??
    normalizeText((row as PendingFestivalRowLike).city_guess)
  );
}

export function canonicalFromPending(row: PendingFestivalRowLike): CanonicalFestivalPayload {
  return {
    title: row.title,
    slug: normalizeText(row.slug),
    description: normalizeText(row.description),
    category: normalizeText(row.category),
    tags: normalizeTags(row.tags),
    city_id: row.city_id ?? null,
    city_name_display: cityDisplayFallback(row),
    region: normalizeText(row.region),
    venue_name: normalizeText(row.location_name),
    address: normalizeText(row.address),
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    start_date: row.start_date ?? null,
    end_date: row.end_date ?? null,
    organizer_name: normalizeText(row.organizer_name),
    hero_image: normalizeText(row.hero_image),
    website_url: normalizeText(row.website_url),
    ticket_url: normalizeText(row.ticket_url),
    price_range: normalizeText(row.price_range),
    source_url: normalizeText(row.source_url),
    source_type: normalizeText(row.source_type),
    status: normalizeText(row.status),
  };
}

export function canonicalFromFestival(row: FestivalRowLike): CanonicalFestivalPayload {
  return {
    title: row.title,
    slug: normalizeText(row.slug),
    description: normalizeText(row.description),
    category: normalizeText(row.category),
    tags: normalizeTags(row.tags),
    city_id: row.city_id ?? null,
    city_name_display: cityDisplayFallback(row),
    region: normalizeText(row.region),
    venue_name: normalizeText(row.location_name),
    address: normalizeText(row.address),
    latitude: row.lat ?? null,
    longitude: row.lng ?? null,
    start_date: row.start_date ?? null,
    end_date: row.end_date ?? null,
    organizer_name: normalizeText(row.organizer_name),
    hero_image: normalizeText(row.hero_image) ?? normalizeText(row.image_url),
    website_url: normalizeText(row.website_url),
    ticket_url: normalizeText(row.ticket_url),
    price_range: normalizeText(row.price_range),
    source_url: normalizeText(row.source_url),
    source_type: normalizeText(row.source_type),
    status: normalizeText(row.status),
  };
}

export function pendingPatchFromCanonical(fields: CanonicalFestivalPayload): Record<string, unknown> {
  return {
    title: fields.title,
    slug: fields.slug,
    description: fields.description,
    category: fields.category,
    region: fields.region,
    location_name: fields.venue_name,
    address: fields.address,
    latitude: fields.latitude,
    longitude: fields.longitude,
    start_date: fields.start_date,
    end_date: fields.end_date,
    organizer_name: fields.organizer_name,
    source_url: fields.source_url,
    source_type: fields.source_type,
    website_url: fields.website_url,
    ticket_url: fields.ticket_url,
    price_range: fields.price_range,
    hero_image: fields.hero_image,
    tags: fields.tags,
    status: fields.status,
  };
}

export function festivalPatchFromCanonical(fields: CanonicalFestivalPayload): Record<string, unknown> {
  return {
    title: fields.title,
    slug: fields.slug,
    description: fields.description,
    category: fields.category,
    region: fields.region,
    location_name: fields.venue_name,
    address: fields.address,
    start_date: fields.start_date,
    end_date: fields.end_date,
    organizer_name: fields.organizer_name,
    hero_image: fields.hero_image,
    image_url: fields.hero_image,
    website_url: fields.website_url,
    ticket_url: fields.ticket_url,
    price_range: fields.price_range,
    source_url: fields.source_url,
    source_type: fields.source_type,
    tags: fields.tags,
    lat: fields.latitude,
    lng: fields.longitude,
    status: fields.status,
  };
}
