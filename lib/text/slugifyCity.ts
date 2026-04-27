/**
 * Normalizes the legacy `festivals.city` string into a URL-safe slug for `festivals.city_slug`.
 */
export function slugifyCity(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
