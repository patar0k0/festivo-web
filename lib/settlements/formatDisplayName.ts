import type { Festival } from "@/lib/types";
import { fixMojibakeBG } from "@/lib/text/fixMojibake";
import { festivalSettlementDisplayText } from "@/lib/settlements/festivalCityText";

/** Премахва типични представки в началото (за сравнение / нормализация). */
export function stripBulgarianSettlementPrefix(name: string): string {
  // Изискваме „с.“ с точка и интервал (или „село “), за да не „сваляме“ първата буква на „Стара Загора“
  // при case-insensitive съвпадение със съкращението „с.“.
  return name.trim().replace(/^(?:гр\.\s*|град\s+|с\.\s*|село\s+)/iu, "").trim();
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
    if (/^(?:с\.\s+|село\s+)/iu.test(trimmed)) {
      return trimmed;
    }
    const base = stripBulgarianSettlementPrefix(trimmed);
    return base ? `с. ${base}` : trimmed;
  }

  if (isVillage === false) {
    if (/^(?:гр\.\s+|град\s+)/iu.test(trimmed)) {
      return trimmed;
    }
    const base = stripBulgarianSettlementPrefix(trimmed);
    return base ? `гр. ${base}` : trimmed;
  }

  return trimmed;
}

type FestivalCityLabelInput = Pick<Festival, "city_name_display" | "city" | "cities"> & {
  city_guess?: string | null;
};

/** Етикет за UI: канонично име → показване → предположение → legacy `city`. */
export function festivalCityLabel(festival: FestivalCityLabelInput, fallback = "България"): string {
  const raw =
    festivalSettlementDisplayText({
      cityRelation: festival.cities ?? null,
      city_name_display: festival.city_name_display,
      city_guess: festival.city_guess ?? null,
      legacyCity: festival.city,
    }) ?? "";
  if (!raw.trim()) {
    return fallback;
  }
  const formatted = formatSettlementDisplayName(raw, festival.cities?.is_village ?? undefined);
  return formatted?.trim() || raw.trim() || fallback;
}

/**
 * Етикет за населено място на публичната страница на организатор:
 * първо канонично име от `cities`, после първият фестивал с наличен етикет.
 */
export function organizerPageLocationLabel(
  organizerCities: { name_bg?: string | null; is_village?: boolean | null } | null | undefined,
  festivals: FestivalCityLabelInput[],
): string | null {
  const primary = formatSettlementDisplayName(organizerCities?.name_bg ?? null, organizerCities?.is_village ?? undefined);
  if (primary?.trim()) return primary.trim();
  for (const festival of festivals) {
    const line = festivalCityLabel(festival, "").trim();
    if (line) return line;
  }
  return null;
}
