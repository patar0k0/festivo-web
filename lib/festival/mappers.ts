import type { Festival } from "@/lib/types";
import type { CanonicalFestivalPatchPayload, CanonicalFestivalPayload } from "@/lib/festival/schema";

type PendingFestivalRowLike = {
  title: string;
  slug?: string | null;
  description?: string | null;
  category?: string | null;
  tags?: unknown;
  city_id?: number | null;
  city?: string | null;
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

export function pendingPatchFromCanonicalPartial(fields: CanonicalFestivalPatchPayload): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if ("title" in fields) patch.title = fields.title;
  if ("slug" in fields) patch.slug = fields.slug;
  if ("description" in fields) patch.description = fields.description;
  if ("category" in fields) patch.category = fields.category;
  if ("venue_name" in fields) patch.location_name = fields.venue_name;
  if ("address" in fields) patch.address = fields.address;
  if ("latitude" in fields) patch.latitude = fields.latitude;
  if ("longitude" in fields) patch.longitude = fields.longitude;
  if ("start_date" in fields) patch.start_date = fields.start_date;
  if ("end_date" in fields) patch.end_date = fields.end_date;
  if ("organizer_name" in fields) patch.organizer_name = fields.organizer_name;
  if ("source_url" in fields) patch.source_url = fields.source_url;
  if ("source_type" in fields) patch.source_type = fields.source_type;
  if ("website_url" in fields) patch.website_url = fields.website_url;
  if ("ticket_url" in fields) patch.ticket_url = fields.ticket_url;
  if ("price_range" in fields) patch.price_range = fields.price_range;
  if ("hero_image" in fields) patch.hero_image = fields.hero_image;
  if ("tags" in fields) patch.tags = fields.tags;
  if ("status" in fields) patch.status = fields.status;

  return patch;
}

export function festivalPatchFromCanonicalPartial(fields: CanonicalFestivalPatchPayload): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if ("title" in fields) patch.title = fields.title;
  if ("slug" in fields) patch.slug = fields.slug;
  if ("description" in fields) patch.description = fields.description;
  if ("category" in fields) patch.category = fields.category;
  if ("venue_name" in fields) patch.location_name = fields.venue_name;
  if ("address" in fields) patch.address = fields.address;
  if ("start_date" in fields) patch.start_date = fields.start_date;
  if ("end_date" in fields) patch.end_date = fields.end_date;
  if ("organizer_name" in fields) patch.organizer_name = fields.organizer_name;
  if ("hero_image" in fields) {
    patch.hero_image = fields.hero_image;
    patch.image_url = fields.hero_image;
  }
  if ("website_url" in fields) patch.website_url = fields.website_url;
  if ("ticket_url" in fields) patch.ticket_url = fields.ticket_url;
  if ("price_range" in fields) patch.price_range = fields.price_range;
  if ("source_url" in fields) patch.source_url = fields.source_url;
  if ("source_type" in fields) patch.source_type = fields.source_type;
  if ("tags" in fields) patch.tags = fields.tags;
  if ("latitude" in fields) patch.lat = fields.latitude;
  if ("longitude" in fields) patch.lng = fields.longitude;
  if ("status" in fields) patch.status = fields.status;

  return patch;
}
