import type { Festival } from "@/lib/types";
import { fixMojibakeBG } from "@/lib/text/fixMojibake";

/** Премахва типични представки в началото (за сравнение / нормализация). */
export function stripBulgarianSettlementPrefix(name: string): string {
  return name.trim().replace(/^(?:гр\.?\s*|град\s+|с\.?\s*|село\s+)/i, "").trim();
}

/**
 * Име за показ: села с префикс „с. “, градове без префикс.
 * Ако вече започва с „с.“ / „село“, не дублираме.
 */
export function formatSettlementDisplayName(
  rawName: string | null | undefined,
  isVillage: boolean | null | undefined,
): string | null {
  if (rawName == null || !String(rawName).trim()) {
    return null;
  }

  const trimmed = fixMojibakeBG(String(rawName).trim());

  if (isVillage === true) {
    if (/^(?:с\.?\s+|село\s+)/i.test(trimmed)) {
      return trimmed;
    }
    const base = stripBulgarianSettlementPrefix(trimmed);
    return base ? `с. ${base}` : trimmed;
  }

  return trimmed;
}

/** Етикет за UI: предпочита форматираното име от `fixFestivalText`. */
export function festivalCityLabel(
  festival: Pick<Festival, "city_name_display" | "city">,
  fallback = "България",
): string {
  const v = festival.city_name_display?.trim() || festival.city?.trim();
  return v || fallback;
}
