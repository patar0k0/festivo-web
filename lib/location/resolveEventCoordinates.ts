import { geocodeByPlaceId, geocodeLocation, type GeocodeLocationResult } from "@/lib/location/geocodeLocation";

export type EventCoordsSource = "place_id" | "venue+city" | "venue_only";

export type ResolvedEventCoordinates = GeocodeLocationResult & { source: EventCoordsSource };

async function geocodeByQuery(query: string | null | undefined): Promise<GeocodeLocationResult | null> {
  return geocodeLocation(query);
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

  if (placeId && String(placeId).trim()) {
    const coords = await geocodeByPlaceId(placeId);
    if (coords) return { ...coords, source: "place_id" };
  }

  const venue = typeof locationName === "string" ? locationName.trim() : "";
  const city = typeof cityName === "string" ? cityName.trim() : "";

  if (venue && city) {
    const query = `${venue}, ${city}, България`;
    const coords = await geocodeByQuery(query);
    if (coords) return { ...coords, source: "venue+city" };
  }

  if (venue) {
    const coords = await geocodeByQuery(venue);
    if (coords) return { ...coords, source: "venue_only" };
  }

  return null;
}
