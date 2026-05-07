/**
 * Fetches lat/lng for a Google `place_id` from the admin geocode API (used when
 * a record has place_id but no coordinates, so map embed can be filled in).
 */
export async function resolveCoordsFromPlaceId(placeId: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(`/api/admin/geocode?place_id=${encodeURIComponent(placeId)}`);
    if (!res.ok) return null;

    const data = (await res.json()) as { lat?: unknown; lng?: unknown; ok?: boolean } | null;
    if (data == null) return null;
    if (data.lat == null || data.lng == null) return null;

    const lat = Number(data.lat);
    const lng = Number(data.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return { lat, lng };
  } catch {
    return null;
  }
}
