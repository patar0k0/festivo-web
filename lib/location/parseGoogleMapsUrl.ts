/**
 * Extracts latitude/longitude from a pasted Google Maps URL (no network).
 * Short links (maps.app.goo.gl) throw Error with message "short-link".
 * Malformed URLs throw Error with message "invalid-maps-url".
 *
 * Priority: first `!3d…!4d…` (place pin) if present; otherwise first `@lat,lng`, then `?q=lat,lng`.
 * If a `!3d…!4d…` segment exists but coordinates are invalid, does not fall back to `@` (avoids wrong overrides).
 */

const PIN_PATTERN = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/;
const AT_PATTERN = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
const Q_PATTERN = /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/;

function isValidCoordPair(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

function pairFromMatch(m: RegExpMatchArray): { lat: number; lng: number } | null {
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!isValidCoordPair(lat, lng)) return null;
  return { lat, lng };
}

export function parseGoogleMapsUrl(url: string): { lat: number; lng: number } | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  let full: string;
  try {
    const u = new URL(trimmed);

    if (u.hostname.includes("maps.app.goo.gl")) {
      throw new Error("short-link");
    }

    full = u.toString();
  } catch (e) {
    if (e instanceof Error && e.message === "short-link") {
      throw e;
    }
    throw new Error("invalid-maps-url");
  }

  const pinMatch = full.match(PIN_PATTERN);
  if (pinMatch) {
    return pairFromMatch(pinMatch);
  }

  const atMatch = full.match(AT_PATTERN);
  if (atMatch) {
    return pairFromMatch(atMatch);
  }

  const qMatch = full.match(Q_PATTERN);
  if (qMatch) {
    return pairFromMatch(qMatch);
  }

  return null;
}
