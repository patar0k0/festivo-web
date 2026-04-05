/**
 * Normalizes user/admin-entered settlement text for city resolution (slug, name, or numeric id).
 * Shared between API routes and client-safe city helpers — keep in sync with city DB lookups.
 */
export function normalizeSettlementInput(value: string) {
  const trimmed = value.trim().replace(/\s+/g, " ");

  if (!trimmed) {
    return "";
  }

  // Strip common Bulgarian locality prefixes at the beginning (e.g. "с. ", "гр. ").
  // Require „с.“ with a dot so we do not strip the first letter of names like „Стара Загора“.
  return trimmed.replace(/^(?:гр\.\s*|град\s+|с\.\s*|село\s+)/iu, "");
}
