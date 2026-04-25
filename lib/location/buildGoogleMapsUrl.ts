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
    // #region agent log
    void fetch("http://127.0.0.1:7623/ingest/bc8b4488-04a6-48d3-8da7-51e0d37fa3c8", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a187c0" },
      body: JSON.stringify({
        sessionId: "a187c0",
        location: "lib/location/buildGoogleMapsUrl.ts:placeId",
        message: "maps branch",
        data: { hypothesisId: "A", branch: "placeId", pidLen: pid.length },
        timestamp: Date.now(),
        runId: "post-fix",
      }),
    }).catch(() => {});
    // #endregion
    return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(pid)}`;
  }

  const la = toFinite(lat);
  const lo = toFinite(lng);
  if (la != null && lo != null) {
    // #region agent log
    void fetch("http://127.0.0.1:7623/ingest/bc8b4488-04a6-48d3-8da7-51e0d37fa3c8", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a187c0" },
      body: JSON.stringify({
        sessionId: "a187c0",
        location: "lib/location/buildGoogleMapsUrl.ts:coords",
        message: "maps branch",
        data: { hypothesisId: "B", branch: "lat_lng", la, lo, latType: typeof lat, lngType: typeof lng },
        timestamp: Date.now(),
        runId: "post-fix",
      }),
    }).catch(() => {});
    // #endregion
    return `https://www.google.com/maps/search/?api=1&query=${la},${lo}`;
  }

  // #region agent log
  void fetch("http://127.0.0.1:7623/ingest/bc8b4488-04a6-48d3-8da7-51e0d37fa3c8", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a187c0" },
    body: JSON.stringify({
      sessionId: "a187c0",
      location: "lib/location/buildGoogleMapsUrl.ts:noLink",
      message: "maps branch",
      data: { hypothesisId: "C", branch: "no_link", rawLat: lat, rawLng: lng },
      timestamp: Date.now(),
      runId: "post-fix",
    }),
  }).catch(() => {});
  // #endregion
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
