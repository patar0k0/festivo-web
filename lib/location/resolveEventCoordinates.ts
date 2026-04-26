import { geocodeByPlaceId, geocodeLocation, type GeocodeLocationResult } from "@/lib/location/geocodeLocation";
import { getCachedLocation, saveLocationCache } from "@/lib/location/locationCache";
import { normalizeLocationKey } from "@/lib/location/normalizeLocationKey";
import { scoreGeocodeResult, type GeocodeMeta } from "@/lib/location/scoreGeocodeResult";
import { shouldAcceptCoordinates } from "@/lib/location/shouldAcceptCoordinates";

export type EventCoordsSource = "place_id" | "venue+city" | "venue_only" | "cache" | "manual";

export type ResolvedEventCoordinates = GeocodeLocationResult & { source: EventCoordsSource };

async function geocodeByQuery(query: string | null | undefined): Promise<GeocodeLocationResult | null> {
  return geocodeLocation(query);
}

function geocodeMeta(
  source: GeocodeMeta["source"],
  query: string,
  geocodeResult: GeocodeLocationResult,
): GeocodeMeta {
  const nameTrim = typeof geocodeResult.name === "string" ? geocodeResult.name.trim() : "";
  const formattedTrim =
    typeof geocodeResult.formattedAddress === "string" ? geocodeResult.formattedAddress.trim() : "";
  const label = nameTrim || formattedTrim || undefined;
  return {
    source,
    query,
    resultName: label,
    resultAddress: formattedTrim || undefined,
  };
}

function evaluateAndGateGeocode(
  source: GeocodeMeta["source"],
  query: string,
  geocodeResult: GeocodeLocationResult | null,
): { resolved: ResolvedEventCoordinates | null; score: number } {
  if (!geocodeResult) return { resolved: null, score: 0 };

  const meta = geocodeMeta(source, query, geocodeResult);
  const score = scoreGeocodeResult(meta);

  console.info("[coords] score", {
    score,
    source,
    query,
    result: geocodeResult.name ?? geocodeResult.formattedAddress,
  });

  if (!shouldAcceptCoordinates(meta)) {
    console.warn("[coords] rejected_low_confidence", meta);
    return { resolved: null, score };
  }

  return { resolved: { ...geocodeResult, source }, score };
}

async function persistLearnedCoords(params: {
  key: string;
  locationName: string | null | undefined;
  cityName: string | null | undefined;
  resolved: ResolvedEventCoordinates;
  score: number;
}): Promise<void> {
  const { key, locationName, cityName, resolved, score } = params;
  if (resolved.source === "cache" || resolved.source === "manual" || score < 60 || !key) return;

  const saved = await saveLocationCache({
    key,
    locationName,
    cityName,
    lat: resolved.lat,
    lng: resolved.lng,
    score,
  });
  if (saved) {
    console.info("[coords] cache_saved", key);
  }
}

/**
 * Resolves map coordinates for an event from venue/place data only.
 * Never falls back to geocoding the city alone (no city-center pins).
 */
function asFiniteCoord(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function resolveEventCoordinates(params: {
  locationName: string | null | undefined;
  cityName: string | null | undefined;
  placeId: string | null | undefined;
  /** When true and existing lat/lng are valid, skip cache and geocoding (admin manual pin). */
  coordsOverride?: boolean | null | undefined;
  existingLat?: number | string | null | undefined;
  existingLng?: number | string | null | undefined;
}): Promise<ResolvedEventCoordinates | null> {
  const { locationName, cityName, placeId } = params;

  if (params.coordsOverride === true) {
    const lat = asFiniteCoord(params.existingLat);
    const lng = asFiniteCoord(params.existingLng);
    if (
      lat !== null &&
      lng !== null &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    ) {
      console.info("[coords] manual_override_skip_resolve");
      return {
        lat,
        lng,
        placeId: null,
        provider: "manual",
        source: "manual",
      };
    }
  }

  const venue = typeof locationName === "string" ? locationName.trim() : "";
  const city = typeof cityName === "string" ? cityName.trim() : "";

  const key = normalizeLocationKey(locationName, cityName);
  if (key) {
    const cached = await getCachedLocation(key);
    if (cached) {
      console.info("[coords] cache_hit", key);
      return {
        lat: cached.latitude,
        lng: cached.longitude,
        placeId: null,
        provider: "cache",
        source: "cache",
      };
    }
  }

  if (placeId && String(placeId).trim()) {
    const trimmedPlaceId = String(placeId).trim();
    const coords = await geocodeByPlaceId(trimmedPlaceId);
    if (coords) {
      const queryForScore = [venue, city].filter(Boolean).join(", ") || trimmedPlaceId;
      const { resolved, score } = evaluateAndGateGeocode("place_id", queryForScore, coords);
      if (resolved) {
        await persistLearnedCoords({ key, locationName, cityName, resolved, score });
        return resolved;
      }
    }
  }

  if (venue && city) {
    const query = `${venue}, ${city}, България`;
    const coords = await geocodeByQuery(query);
    const { resolved, score } = evaluateAndGateGeocode("venue+city", query, coords);
    if (resolved) {
      await persistLearnedCoords({ key, locationName, cityName, resolved, score });
      return resolved;
    }
  }

  if (venue) {
    const coords = await geocodeByQuery(venue);
    const { resolved, score } = evaluateAndGateGeocode("venue_only", venue, coords);
    if (resolved) {
      await persistLearnedCoords({ key, locationName, cityName, resolved, score });
      return resolved;
    }
  }

  return null;
}
