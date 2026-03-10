import { CANONICAL_FESTIVAL_FIELDS, type CanonicalFestivalPayload } from "@/lib/festival/schema";

export type ValidationResult =
  | { ok: true; data: CanonicalFestivalPayload }
  | { ok: false; error: string };

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeCityId(value: unknown): number | null {
  const parsed = normalizeNumber(value);
  if (parsed === null) return null;
  return Number.isInteger(parsed) ? parsed : null;
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

function sourceValue(body: Record<string, unknown>, key: string, aliases: string[] = []) {
  if (key in body) return body[key];
  for (const alias of aliases) {
    if (alias in body) return body[alias];
  }
  return undefined;
}

export function canonicalFromUnknown(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Invalid festival payload." };
  }

  const body = raw as Record<string, unknown>;
  const title = normalizeText(sourceValue(body, "title"));
  if (!title) {
    return { ok: false, error: "title is required" };
  }

  const latitude = normalizeNumber(sourceValue(body, "latitude", ["lat"]));
  const longitude = normalizeNumber(sourceValue(body, "longitude", ["lng"]));

  if (latitude !== null && (latitude < -90 || latitude > 90)) {
    return { ok: false, error: "Invalid latitude" };
  }

  if (longitude !== null && (longitude < -180 || longitude > 180)) {
    return { ok: false, error: "Invalid longitude" };
  }

  const canonical: CanonicalFestivalPayload = {
    title,
    slug: normalizeText(sourceValue(body, "slug")),
    description: normalizeText(sourceValue(body, "description")),
    category: normalizeText(sourceValue(body, "category")),
    tags: normalizeTags(sourceValue(body, "tags")),
    city_id: normalizeCityId(sourceValue(body, "city_id")),
    city_name_display: normalizeText(sourceValue(body, "city_name_display", ["city"])),
    region: normalizeText(sourceValue(body, "region")),
    venue_name: normalizeText(sourceValue(body, "venue_name", ["location_name"])),
    address: normalizeText(sourceValue(body, "address")),
    latitude,
    longitude,
    start_date: normalizeText(sourceValue(body, "start_date")),
    end_date: normalizeText(sourceValue(body, "end_date")),
    organizer_name: normalizeText(sourceValue(body, "organizer_name")),
    hero_image: normalizeText(sourceValue(body, "hero_image", ["image_url"])),
    website_url: normalizeText(sourceValue(body, "website_url")),
    ticket_url: normalizeText(sourceValue(body, "ticket_url")),
    price_range: normalizeText(sourceValue(body, "price_range")),
    source_url: normalizeText(sourceValue(body, "source_url")),
    source_type: normalizeText(sourceValue(body, "source_type")),
    status: normalizeText(sourceValue(body, "status")),
  };

  return { ok: true, data: canonical };
}

export function pickCanonicalFields(payload: CanonicalFestivalPayload): CanonicalFestivalPayload {
  const entries = CANONICAL_FESTIVAL_FIELDS.map((field) => [field, payload[field]] as const);
  return Object.fromEntries(entries) as CanonicalFestivalPayload;
}
