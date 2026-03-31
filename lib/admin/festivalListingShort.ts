/** Admin listing short copy: stored on published festivals under evidence_json.festivo_admin.listing_short (no extra DB column). */

const FESTIVO_ADMIN_KEY = "festivo_admin";
const LISTING_SHORT_KEY = "listing_short";

export const ADMIN_LISTING_SHORT_MAX = 180;
export const GENERATE_SHORT_FROM_FULL_LEN = 150;

export function generateShortFromFullDescription(full: string, maxLen = GENERATE_SHORT_FROM_FULL_LEN): string {
  const t = full.trim().replace(/\s+/g, " ");
  if (!t) return "";
  if (t.length <= maxLen) return t;
  const slice = t.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > maxLen * 0.5) return slice.slice(0, lastSpace).trim();
  return slice.trim();
}

export function getListingShortFromEvidenceJson(evidence: unknown): string {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) return "";
  const adminRaw = (evidence as Record<string, unknown>)[FESTIVO_ADMIN_KEY];
  if (!adminRaw || typeof adminRaw !== "object" || Array.isArray(adminRaw)) return "";
  const s = (adminRaw as Record<string, unknown>)[LISTING_SHORT_KEY];
  return typeof s === "string" ? s : "";
}

/**
 * Merges listing short into evidence_json without dropping existing keys.
 * Pass null or empty string to clear listing_short.
 */
export function mergeFestivoAdminListingShort(evidence: unknown, listingShort: string | null): Record<string, unknown> | null {
  const base: Record<string, unknown> =
    evidence && typeof evidence === "object" && !Array.isArray(evidence) ? { ...(evidence as Record<string, unknown>) } : {};

  const adminRaw = base[FESTIVO_ADMIN_KEY];
  const admin: Record<string, unknown> =
    adminRaw && typeof adminRaw === "object" && !Array.isArray(adminRaw) ? { ...(adminRaw as Record<string, unknown>) } : {};

  const trimmed = listingShort?.trim() ?? "";
  if (trimmed) {
    admin[LISTING_SHORT_KEY] = trimmed;
  } else {
    delete admin[LISTING_SHORT_KEY];
  }

  if (Object.keys(admin).length === 0) {
    delete base[FESTIVO_ADMIN_KEY];
  } else {
    base[FESTIVO_ADMIN_KEY] = admin;
  }

  return Object.keys(base).length ? base : null;
}
