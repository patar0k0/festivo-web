export type GeocodeProvider = "google" | "osm";

export type GeocodeLocationResult = {
  lat: number;
  lng: number;
  placeId: string | null;
  provider: GeocodeProvider;
  /** Short label when the provider returns one (e.g. OSM `name`). */
  name?: string | null;
  formattedAddress?: string | null;
};

const GOOGLE_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const OSM_GEOCODE_URL = "https://nominatim.openstreetmap.org/search";

function getGoogleApiKey(): string | null {
  const key = process.env.GOOGLE_GEOCODING_API_KEY?.trim() || process.env.GOOGLE_MAPS_API_KEY?.trim();
  return key || null;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function geocodeWithGoogle(query: string): Promise<GeocodeLocationResult | null> {
  const apiKey = getGoogleApiKey();
  if (!apiKey) return null;

  const params = new URLSearchParams({
    address: query,
    language: "bg",
    region: "bg",
    components: "country:BG",
    key: apiKey,
  });

  try {
    const response = await fetch(`${GOOGLE_GEOCODE_URL}?${params.toString()}`);
    if (!response.ok) return null;

    const payload = (await response.json().catch(() => null)) as
      | {
          status?: string;
          results?: Array<{
            place_id?: string;
            formatted_address?: string;
            geometry?: { location?: { lat?: unknown; lng?: unknown } };
          }>;
        }
      | null;

    if (!payload || payload.status !== "OK" || !Array.isArray(payload.results) || payload.results.length === 0) {
      return null;
    }

    const first = payload.results[0];
    const lat = asFiniteNumber(first?.geometry?.location?.lat);
    const lng = asFiniteNumber(first?.geometry?.location?.lng);
    if (lat === null || lng === null) return null;

    const formattedAddress =
      typeof first.formatted_address === "string" && first.formatted_address.trim()
        ? first.formatted_address.trim()
        : null;

    return {
      lat,
      lng,
      placeId: typeof first.place_id === "string" && first.place_id.trim() ? first.place_id.trim() : null,
      provider: "google",
      formattedAddress,
    };
  } catch {
    return null;
  }
}

async function geocodeWithOsm(query: string): Promise<GeocodeLocationResult | null> {
  const params = new URLSearchParams({
    format: "jsonv2",
    limit: "1",
    countrycodes: "bg",
    "accept-language": "bg",
    q: query,
  });

  try {
    const response = await fetch(`${OSM_GEOCODE_URL}?${params.toString()}`, {
      headers: {
        "User-Agent": "festivo-web geocoder",
      },
    });
    if (!response.ok) return null;

    const payload = (await response.json().catch(() => null)) as
      | Array<{ lat?: unknown; lon?: unknown; osm_id?: unknown; display_name?: string; name?: string }>
      | null;

    if (!Array.isArray(payload) || payload.length === 0) return null;

    const first = payload[0];
    const lat = asFiniteNumber(first.lat);
    const lng = asFiniteNumber(first.lon);
    if (lat === null || lng === null) return null;

    const osmId = first.osm_id;
    const displayName =
      typeof first.display_name === "string" && first.display_name.trim() ? first.display_name.trim() : null;
    const shortName =
      typeof first.name === "string" && first.name.trim() ? first.name.trim() : null;

    return {
      lat,
      lng,
      placeId: typeof osmId === "string" ? osmId : typeof osmId === "number" ? String(osmId) : null,
      provider: "osm",
      name: shortName,
      formattedAddress: displayName,
    };
  } catch {
    return null;
  }
}

export async function geocodeLocation(query: string | null | undefined): Promise<GeocodeLocationResult | null> {
  if (typeof query !== "string") return null;

  const trimmed = query.trim();
  if (!trimmed) return null;

  const fromGoogle = await geocodeWithGoogle(trimmed);
  if (fromGoogle) return fromGoogle;

  return geocodeWithOsm(trimmed);
}

/** Resolves a Google `place_id` to coordinates. Requires `GOOGLE_GEOCODING_API_KEY` (or `GOOGLE_MAPS_API_KEY`). */
export async function geocodeByPlaceId(placeId: string | null | undefined): Promise<GeocodeLocationResult | null> {
  if (typeof placeId !== "string") return null;
  const trimmed = placeId.trim();
  if (!trimmed) return null;

  const apiKey = getGoogleApiKey();
  if (!apiKey) return null;

  const params = new URLSearchParams({
    place_id: trimmed,
    language: "bg",
    key: apiKey,
  });

  try {
    const response = await fetch(`${GOOGLE_GEOCODE_URL}?${params.toString()}`);
    if (!response.ok) return null;

    const payload = (await response.json().catch(() => null)) as
      | {
          status?: string;
          results?: Array<{
            place_id?: string;
            formatted_address?: string;
            geometry?: { location?: { lat?: unknown; lng?: unknown } };
          }>;
        }
      | null;

    if (!payload || payload.status !== "OK" || !Array.isArray(payload.results) || payload.results.length === 0) {
      return null;
    }

    const first = payload.results[0];
    const lat = asFiniteNumber(first?.geometry?.location?.lat);
    const lng = asFiniteNumber(first?.geometry?.location?.lng);
    if (lat === null || lng === null) return null;

    const formattedAddress =
      typeof first.formatted_address === "string" && first.formatted_address.trim()
        ? first.formatted_address.trim()
        : null;

    return {
      lat,
      lng,
      placeId: typeof first.place_id === "string" && first.place_id.trim() ? first.place_id.trim() : trimmed,
      provider: "google",
      formattedAddress,
    };
  } catch {
    return null;
  }
}
