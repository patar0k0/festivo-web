export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_KM * c;
}

const MAX_DISTANCE_KM = 50;

/**
 * Rejects non-finite coordinates and optional outliers vs a known city center.
 */
export function validateCoordinates(
  coords: { lat: unknown; lng: unknown } | null | undefined,
  cityCoords: LatLng | null | undefined
): boolean {
  if (!coords) return false;

  const lat = coords.lat;
  const lng = coords.lng;
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;

  if (cityCoords) {
    if (!Number.isFinite(cityCoords.lat) || !Number.isFinite(cityCoords.lng)) return false;
    const distance = haversineKm({ lat, lng }, cityCoords);
    if (distance > MAX_DISTANCE_KM) return false;
  }

  return true;
}
