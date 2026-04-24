export function buildGoogleMapsUrl(f: {
  place_id?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
}) {
  const placeId = typeof f.place_id === "string" ? f.place_id.trim() : "";
  if (placeId) {
    return `https://www.google.com/maps/place/?q=place_id:${placeId}`;
  }

  if (f.lat && f.lng) {
    return `https://www.google.com/maps?q=${f.lat},${f.lng}`;
  }

  return null;
}

/** Embed iframe `src` — prefers `place_id` when present so the preview matches the POI. */
export function buildGoogleMapsEmbedSrc(f: {
  place_id?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
}): string | null {
  const pid = typeof f.place_id === "string" ? f.place_id.trim() : "";
  if (pid) {
    return `https://maps.google.com/maps?q=place_id:${encodeURIComponent(pid)}&z=15&output=embed`;
  }

  if (f.lat != null && f.lng != null && String(f.lat).trim() !== "" && String(f.lng).trim() !== "") {
    const q = `${f.lat},${f.lng}`;
    return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=15&output=embed`;
  }

  return null;
}
