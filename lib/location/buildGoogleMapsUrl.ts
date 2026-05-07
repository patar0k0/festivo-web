/** TEMPORARY: log when user opens a Google Maps link. Remove when behaviour is confirmed. */
export function logGoogleMapsOpenDebug(mapHref: string): void {
  console.log("[maps-final-url]", mapHref);
}

export function buildGoogleMapsUrl({
  placeId,
  latitude,
  longitude,
}: {
  placeId?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
}): string | null {
  const pid = (placeId ?? "").trim();

  const lat = typeof latitude === "string" ? parseFloat(latitude) : latitude;
  const lng = typeof longitude === "string" ? parseFloat(longitude) : longitude;

  const validLat = typeof lat === "number" && Number.isFinite(lat);
  const validLng = typeof lng === "number" && Number.isFinite(lng);

  if (validLat && validLng) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }

  if (pid) {
    return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(pid)}`;
  }

  return null;
}

/** Embeds use coordinates only. place_id is not used (reliable embed URLs need a Maps API key). */
export function buildGoogleMapsEmbedSrc({
  lat,
  lng,
}: {
  lat?: number | string | null;
  lng?: number | string | null;
}): string {
  const nLat =
    lat == null || (typeof lat === "string" && lat.trim() === "") ? Number.NaN : Number(lat);
  const nLng =
    lng == null || (typeof lng === "string" && lng.trim() === "") ? Number.NaN : Number(lng);
  const validLat = Number.isFinite(nLat) ? nLat : null;
  const validLng = Number.isFinite(nLng) ? nLng : null;

  if (validLat != null && validLng != null) {
    return `https://www.google.com/maps?q=${validLat},${validLng}&z=15&output=embed`;
  }

  return "";
}
