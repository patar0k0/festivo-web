import type { Festival } from "@/lib/types";
import { fixMojibakeBG } from "@/lib/text/fixMojibake";

/** Премахва типични представки в началото (за сравнение / нормализация). */
export function stripBulgarianSettlementPrefix(name: string): string {
  return name.trim().replace(/^(?:гр\.?\s*|град\s+|с\.?\s*|село\s+)/i, "").trim();
}

/**
 * Име за показ: села — „с. “, градове — „гр. “.
 * При `isVillage === undefined` без промяна (напр. само свободен текст `city` без ред в `cities`).
 * Не дублираме вече налични представки.
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

  if (isVillage === false) {
    if (/^(?:гр\.?\s+|град\s+)/i.test(trimmed)) {
      return trimmed;
    }
    const base = stripBulgarianSettlementPrefix(trimmed);
    return base ? `гр. ${base}` : trimmed;
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
