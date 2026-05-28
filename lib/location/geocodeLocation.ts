export type GeocodeProvider = "google" | "osm" | "cache" | "manual";

export type GeocodeLocationResult = {
  lat: number;
  lng: number;
  placeId: string | null;
  provider: GeocodeProvider;
  /** Short label when the provider returns one (e.g. OSM `name`). */
  name?: string | null;
  formattedAddress?: string | null;
};

/** One entry per provider attempted during a geocode-with-steps call. */
export type GeoDebugStep = {
  provider: "places-new" | "google-geocoding" | "places-old" | "osm";
  label: string;
  /** The query string passed to this provider. */
  query: string;
  /** true = provider returned a usable result. */
  ok: boolean;
  /** true = provider was not called (e.g. no API key, or earlier step already found a result). */
  skipped: boolean;
  /** Human-readable result label when ok = true. */
  resultName?: string | null;
};

export type GeoLocationWithSteps = {
  result: GeocodeLocationResult | null;
  steps: GeoDebugStep[];
  googleKeyConfigured: boolean;
};

const GOOGLE_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const GOOGLE_PLACES_TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json";
const GOOGLE_PLACES_NEW_URL = "https://places.googleapis.com/v1/places:searchText";
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

/**
 * Google Places Text Search — better than Geocoding API for venue/event names
 * (e.g. "Стадион Христо Ботев, Враца, България" or "Фестивал X, Ветринци").
 * Falls back silently when the key is absent or Places API is not enabled.
 */
async function geocodeWithGooglePlacesTextSearch(query: string): Promise<GeocodeLocationResult | null> {
  const apiKey = getGoogleApiKey();
  if (!apiKey) return null;

  const params = new URLSearchParams({
    query,
    language: "bg",
    region: "bg",
    key: apiKey,
  });

  try {
    const response = await fetch(`${GOOGLE_PLACES_TEXT_SEARCH_URL}?${params.toString()}`);
    if (!response.ok) return null;

    const payload = (await response.json().catch(() => null)) as
      | {
          status?: string;
          results?: Array<{
            place_id?: string;
            formatted_address?: string;
            name?: string;
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

    return {
      lat,
      lng,
      placeId: typeof first.place_id === "string" && first.place_id.trim() ? first.place_id.trim() : null,
      provider: "google",
      name: typeof first.name === "string" && first.name.trim() ? first.name.trim() : null,
      formattedAddress: typeof first.formatted_address === "string" && first.formatted_address.trim()
        ? first.formatted_address.trim()
        : null,
    };
  } catch {
    return null;
  }
}

/**
 * Google Places API (New) — Text Search.
 * POST https://places.googleapis.com/v1/places:searchText
 * Better semantic understanding of place names than the legacy APIs.
 * Same API key as Geocoding; requires "Places API (New)" enabled in GCP console.
 */
async function geocodeWithGooglePlacesNew(query: string): Promise<GeocodeLocationResult | null> {
  const apiKey = getGoogleApiKey();
  if (!apiKey) return null;

  try {
    const response = await fetch(GOOGLE_PLACES_NEW_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.location,places.displayName,places.formattedAddress,places.id",
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: "bg",
        regionCode: "BG",
        maxResultCount: 1,
      }),
    });
    if (!response.ok) return null;

    const payload = (await response.json().catch(() => null)) as {
      places?: Array<{
        id?: string;
        location?: { latitude?: unknown; longitude?: unknown };
        displayName?: { text?: string };
        formattedAddress?: string;
      }>;
    } | null;

    if (!payload?.places?.length) return null;

    const first = payload.places[0];
    const lat = asFiniteNumber(first.location?.latitude);
    const lng = asFiniteNumber(first.location?.longitude);
    if (lat === null || lng === null) return null;

    return {
      lat,
      lng,
      placeId: typeof first.id === "string" && first.id.trim() ? first.id.trim() : null,
      provider: "google",
      name: first.displayName?.text ?? null,
      formattedAddress: typeof first.formattedAddress === "string" && first.formattedAddress.trim()
        ? first.formattedAddress.trim()
        : null,
    };
  } catch {
    return null;
  }
}

export async function geocodeLocation(query: string | null | undefined): Promise<GeocodeLocationResult | null> {
  if (typeof query !== "string") return null;

  const trimmed = query.trim();
  if (!trimmed) return null;

  // Places API (New) — best semantic understanding of named places/venues
  const fromPlacesNew = await geocodeWithGooglePlacesNew(trimmed);
  if (fromPlacesNew) return fromPlacesNew;

  const fromGoogle = await geocodeWithGoogle(trimmed);
  if (fromGoogle) return fromGoogle;

  // Places Text Search (legacy) handles venue/event names better than the Geocoding API
  const fromPlaces = await geocodeWithGooglePlacesTextSearch(trimmed);
  if (fromPlaces) return fromPlaces;

  return geocodeWithOsm(trimmed);
}

/**
 * Tries each geocoding provider in order and returns the first successful result
 * together with a per-step debug log. Use this for admin tools where visibility
 * into which provider resolved (or failed) is important.
 *
 * Does NOT apply the shouldAcceptCoordinates score gate — the caller is trusted.
 */
export async function geocodeLocationWithSteps(
  query: string | null | undefined,
): Promise<GeoLocationWithSteps> {
  const steps: GeoDebugStep[] = [];
  const trimmed = typeof query === "string" ? query.trim() : "";
  const googleKeyConfigured = !!getGoogleApiKey();

  if (!trimmed) {
    return { result: null, steps, googleKeyConfigured };
  }

  let found: GeocodeLocationResult | null = null;

  // 1. Places API (New)
  if (!googleKeyConfigured) {
    steps.push({ provider: "places-new", label: "Places API (New)", query: trimmed, ok: false, skipped: true, resultName: "немa API ключ" });
  } else {
    const r = await geocodeWithGooglePlacesNew(trimmed);
    steps.push({
      provider: "places-new",
      label: "Places API (New)",
      query: trimmed,
      ok: !!r,
      skipped: false,
      resultName: r?.name ?? r?.formattedAddress ?? null,
    });
    if (r) { found = r; }
  }

  // 2. Google Geocoding API
  if (found) {
    steps.push({ provider: "google-geocoding", label: "Google Geocoding API", query: trimmed, ok: false, skipped: true });
  } else if (!googleKeyConfigured) {
    steps.push({ provider: "google-geocoding", label: "Google Geocoding API", query: trimmed, ok: false, skipped: true, resultName: "няма API ключ" });
  } else {
    const r = await geocodeWithGoogle(trimmed);
    steps.push({
      provider: "google-geocoding",
      label: "Google Geocoding API",
      query: trimmed,
      ok: !!r,
      skipped: false,
      resultName: r?.formattedAddress ?? null,
    });
    if (r) { found = r; }
  }

  // 3. Places Text Search (legacy)
  if (found) {
    steps.push({ provider: "places-old", label: "Places Text Search (стар)", query: trimmed, ok: false, skipped: true });
  } else if (!googleKeyConfigured) {
    steps.push({ provider: "places-old", label: "Places Text Search (стар)", query: trimmed, ok: false, skipped: true, resultName: "няма API ключ" });
  } else {
    const r = await geocodeWithGooglePlacesTextSearch(trimmed);
    steps.push({
      provider: "places-old",
      label: "Places Text Search (стар)",
      query: trimmed,
      ok: !!r,
      skipped: false,
      resultName: r?.name ?? r?.formattedAddress ?? null,
    });
    if (r) { found = r; }
  }

  // 4. OSM Nominatim
  if (found) {
    steps.push({ provider: "osm", label: "OSM Nominatim", query: trimmed, ok: false, skipped: true });
  } else {
    const r = await geocodeWithOsm(trimmed);
    steps.push({
      provider: "osm",
      label: "OSM Nominatim",
      query: trimmed,
      ok: !!r,
      skipped: false,
      resultName: r?.name ?? r?.formattedAddress ?? null,
    });
    if (r) { found = r; }
  }

  return { result: found, steps, googleKeyConfigured };
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
