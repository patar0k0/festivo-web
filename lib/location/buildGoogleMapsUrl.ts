function toFinite(n: number | string | null | undefined): number | undefined {
  if (n == null) return undefined;
  if (typeof n === "string" && n.trim() === "") return undefined;
  const v = Number(n);
  return Number.isFinite(v) ? v : undefined;
}

/** Strict open-in-maps link: place_id, then coordinates, else no outbound URL (no text search). */
export function buildGoogleMapsUrl({
  lat,
  lng,
  placeId,
}: {
  lat?: number | string | null;
  lng?: number | string | null;
  placeId?: string | null;
}): string | null {
  const pid = (placeId ?? "").trim();
  if (pid) {
    return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(pid)}`;
  }

  const la = toFinite(lat);
  const lo = toFinite(lng);
  if (la != null && lo != null) {
    return `https://www.google.com/maps/search/?api=1&query=${la},${lo}`;
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
