/**
 * Extracts latitude/longitude from a pasted Google Maps URL (no network).
 * Short links (maps.app.goo.gl) throw Error with message "short-link".
 */
export function parseGoogleMapsUrl(url: string): { lat: number; lng: number } | null {
  try {
    const u = new URL(url.trim());

    if (u.hostname.includes("maps.app.goo.gl")) {
      throw new Error("short-link");
    }

    const full = u.toString();

    const patterns = [
      /@(-?\d+\.\d+),(-?\d+\.\d+)/,
      /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
      /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
    ];

    for (const p of patterns) {
      const m = full.match(p);
      if (m) {
        const lat = Number(m[1]);
        const lng = Number(m[2]);

        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          return { lat, lng };
        }
      }
    }

    return null;
  } catch (e) {
    if (e instanceof Error && e.message === "short-link") {
      throw e;
    }
    return null;
  }
}
