import { geocodeByPlaceId, geocodeLocation, type GeocodeLocationResult } from "@/lib/location/geocodeLocation";
import { scoreGeocodeResult, type GeocodeMeta } from "@/lib/location/scoreGeocodeResult";
import { shouldAcceptCoordinates } from "@/lib/location/shouldAcceptCoordinates";

export type EventCoordsSource = "place_id" | "venue+city" | "venue_only";

export type ResolvedEventCoordinates = GeocodeLocationResult & { source: EventCoordsSource };

async function geocodeByQuery(query: string | null | undefined): Promise<GeocodeLocationResult | null> {
  return geocodeLocation(query);
}

function geocodeMeta(
  source: EventCoordsSource,
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

function gateGeocode(
  source: EventCoordsSource,
  query: string,
  geocodeResult: GeocodeLocationResult | null,
): ResolvedEventCoordinates | null {
  if (!geocodeResult) return null;

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
    return null;
  }

  return { ...geocodeResult, source };
}

/**
 * Resolves map coordinates for an event from venue/place data only.
 * Never falls back to geocoding the city alone (no city-center pins).
 */
export async function resolveEventCoordinates(params: {
  locationName: string | null | undefined;
  cityName: string | null | undefined;
  placeId: string | null | undefined;
}): Promise<ResolvedEventCoordinates | null> {
  const { locationName, cityName, placeId } = params;

  const venue = typeof locationName === "string" ? locationName.trim() : "";
  const city = typeof cityName === "string" ? cityName.trim() : "";

  if (placeId && String(placeId).trim()) {
    const trimmedPlaceId = String(placeId).trim();
    const coords = await geocodeByPlaceId(trimmedPlaceId);
    if (coords) {
      const queryForScore = [venue, city].filter(Boolean).join(", ") || trimmedPlaceId;
      return gateGeocode("place_id", queryForScore, coords);
    }
  }

  if (venue && city) {
    const query = `${venue}, ${city}, България`;
    const coords = await geocodeByQuery(query);
    const resolved = gateGeocode("venue+city", query, coords);
    if (resolved) return resolved;
  }

  if (venue) {
    const coords = await geocodeByQuery(venue);
    const resolved = gateGeocode("venue_only", venue, coords);
    if (resolved) return resolved;
  }

  return null;
}
