/**
 * Canonical public-facing festival place/address text.
 * Deduplicates location_name vs venue_name and omits address when it repeats the place line.
 */

export type PublicFestivalLocationInput = {
  location_name?: string | null;
  venue_name?: string | null;
  address?: string | null;
};

export function normalizeFestivalLocationText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLocaleLowerCase("bg");
}

function trimmed(value?: string | null): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Place/venue line: prefers location_name, merges venue_name only when different; never includes address. */
export function getPublicFestivalPlaceLine(f: PublicFestivalLocationInput): string {
  const loc = trimmed(f.location_name);
  const ven = trimmed(f.venue_name);
  if (loc && ven) {
    if (normalizeFestivalLocationText(loc) === normalizeFestivalLocationText(ven)) {
      return loc;
    }
    return `${loc} · ${ven}`;
  }
  return loc || ven;
}

/** Address suitable for display alongside placeLine, or null when missing or redundant. */
export function getPublicFestivalAddressLine(f: PublicFestivalLocationInput, placeLine: string): string | null {
  const addr = trimmed(f.address);
  if (!addr) return null;
  if (!placeLine) return addr;
  if (normalizeFestivalLocationText(addr) === normalizeFestivalLocationText(placeLine)) {
    return null;
  }
  return addr;
}

/** Single summary for chips, quick facts, and detail blocks (place · address when both apply). */
export function formatPublicFestivalLocationSummary(f: PublicFestivalLocationInput): string {
  const place = getPublicFestivalPlaceLine(f);
  const addr = getPublicFestivalAddressLine(f, place);
  if (place && addr) return `${place} · ${addr}`;
  return place || addr || "";
}

/**
 * Venue/location line for compact hero/quick-fact rows: primary place name without trailing
 * street address when a place/venue line exists. Falls back to address only when there is no place.
 */
export function getCompactMetaLocationBeyondCity(
  f: PublicFestivalLocationInput,
  cityDisplayName: string,
): string {
  const cityNorm = cityDisplayName ? normalizeFestivalLocationText(cityDisplayName) : "";
  const beyondCity = (line: string): string => {
    const t = trimmed(line);
    if (!t) return "";
    if (!cityNorm) return t;
    return normalizeFestivalLocationText(t) !== cityNorm ? t : "";
  };
  const place = getPublicFestivalPlaceLine(f);
  if (place) return beyondCity(place);
  const addr = getPublicFestivalAddressLine(f, "");
  return addr ? beyondCity(addr) : "";
}
