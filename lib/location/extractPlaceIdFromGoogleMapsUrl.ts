export function extractPlaceIdFromGoogleMapsUrl(url: string): string | null {
  const trimmed = url.trim();

  try {
    const u = new URL(trimmed);
    const str = u.toString();

    // pattern: ...!1s0x14ac5f5d7f5d12e3:0x2cc73757ed28a493!...
    const match = str.match(/!1s([^!]+)/);

    if (!match) return null;

    return match[1];
  } catch {
    return null;
  }
}
