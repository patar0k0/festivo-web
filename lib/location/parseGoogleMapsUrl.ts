/**
 * Extracts latitude/longitude from a pasted Google Maps URL (no network).
 * Short links (maps.app.goo.gl) are not resolved — returns null.
 */
export function parseGoogleMapsUrl(url: string): { lat: number; lng: number } | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const host = new URL(trimmed).hostname.toLowerCase();
    if (host === "maps.app.goo.gl") {
      return null;
    }
  } catch {
    return null;
  }

  const atMatch = trimmed.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    const lat = Number(atMatch[1]);
    const lng = Number(atMatch[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }

  const dMatch = trimmed.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (dMatch) {
    const lat = Number(dMatch[1]);
    const lng = Number(dMatch[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }

  return null;
}
