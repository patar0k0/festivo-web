import type { Festival } from "@/lib/types";
import { formatSettlementLocationLines, type SettlementLocationLines } from "@/lib/settlements/formatLocation";
import { festivalSettlementSourceText } from "@/lib/settlements/festivalCityText";

/** @deprecated Prefer importing from `@/lib/settlements/formatLocation`. */
export { stripBulgarianSettlementPrefix } from "@/lib/settlements/formatLocation";

type FestivalCityLabelInput = Pick<Festival, "city_name_display" | "cities"> & {
  city_guess?: string | null;
};

export function getFestivalLocationLines(
  festival: FestivalCityLabelInput,
  fallback = "България",
): SettlementLocationLines {
  const rawLine = festivalSettlementSourceText({
    cityRelation: festival.cities ?? null,
    city_name_display: festival.city_name_display,
    city_guess: festival.city_guess ?? null,
  });
  const lines = formatSettlementLocationLines(rawLine, festival.cities?.is_village);
  if (lines?.primary.trim()) return lines;
  const fb = fallback.trim();
  if (!fb) return { primary: "", secondary: null, geoLine: "" };
  return { primary: fb, secondary: null, geoLine: fb };
}

/**
 * Единен низ за имейли, ICS, стари места: „Име, тип • обл. …“.
 * Типът идва само от `cities.is_village`.
 */
export function festivalSettlementDisplayText(
  name_bg: string | null | undefined,
  is_village: boolean | null | undefined,
): string | null {
  const lines = formatSettlementLocationLines(name_bg, is_village);
  return lines?.geoLine ?? null;
}

/** Пълен ред за карти и контекст (както преди `festivalCityLabel`). */
export function festivalCityLabel(festival: FestivalCityLabelInput, fallback = "България"): string {
  return getFestivalLocationLines(festival, fallback).geoLine;
}

/** Само чистото име за основен ред в UI. */
export function festivalLocationPrimary(festival: FestivalCityLabelInput, fallback = "България"): string {
  return getFestivalLocationLines(festival, fallback).primary;
}

/** Вторичен ред: тип населено място • област (ако е известна от текста). */
export function festivalLocationSecondary(festival: FestivalCityLabelInput): string | null {
  const rawLine = festivalSettlementSourceText({
    cityRelation: festival.cities ?? null,
    city_name_display: festival.city_name_display,
    city_guess: festival.city_guess ?? null,
  });
  return formatSettlementLocationLines(rawLine, festival.cities?.is_village)?.secondary ?? null;
}

