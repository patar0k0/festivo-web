function toFinite(n: number | string | null | undefined): number | undefined {
  if (n == null) return undefined;
  if (typeof n === "string" && n.trim() === "") return undefined;
  const v = Number(n);
  return Number.isFinite(v) ? v : undefined;
}

/** A = place_id link, B = lat/lng search, C = no href (neither available). */
export type GoogleMapsUrlBranch = "A" | "B" | "C";

/** TEMPORARY: log when user opens "Отвори в Google Maps". Remove when behaviour is confirmed. */
export function logGoogleMapsOpenDebug(mapHref: string | null, branch: GoogleMapsUrlBranch): void {
  console.log("[maps-debug-url]", mapHref);
  console.log("[maps-debug-branch]", branch);
}

/** Same routing as `buildGoogleMapsUrl`, plus which branch was taken (for temporary debug). */
export function buildGoogleMapsUrlMeta({
  lat,
  lng,
  placeId,
}: {
  lat?: number | string | null;
  lng?: number | string | null;
  placeId?: string | null;
}): { url: string | null; branch: GoogleMapsUrlBranch } {
  const pid = (placeId ?? "").trim();
  if (pid) {
    return {
      url: `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(pid)}`,
      branch: "A",
    };
  }

  const la = toFinite(lat);
  const lo = toFinite(lng);
  if (la != null && lo != null) {
    return {
      url: `https://www.google.com/maps/search/?api=1&query=${la},${lo}`,
      branch: "B",
    };
  }

  return { url: null, branch: "C" };
}

/** Strict open-in-maps link: place_id, then coordinates, else no outbound URL (no text search). */
export function buildGoogleMapsUrl(params: {
  lat?: number | string | null;
  lng?: number | string | null;
  placeId?: string | null;
}): string | null {
  return buildGoogleMapsUrlMeta(params).url;
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
