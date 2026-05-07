export function normalizeLocationKey(locationName?: string | null, cityName?: string | null) {
  const raw = `${locationName ?? ""} ${cityName ?? ""}`.toLowerCase();

  return raw
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
