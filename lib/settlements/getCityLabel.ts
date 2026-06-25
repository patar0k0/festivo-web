import { getFestivalLocationDisplay } from "@/lib/location/getFestivalLocationDisplay";
import type { Festival } from "@/lib/types";

/** Prefix "с. " for villages, "гр. " for cities, "" when unknown. */
export function settlementPrefix(isVillage: boolean | null | undefined): string {
  if (isVillage === true) return "с. ";
  if (isVillage === false) return "гр. ";
  return "";
}

/**
 * Detects a locality prefix already present in the name (гр./с./к.к. and word forms).
 * Names that carry their own prefix — resort complexes ("к.к. Мальовица") or
 * pre-prefixed input — must not get a second one prepended.
 */
// NB: `\b` is ASCII-only in JS regex, so it never fires after Cyrillic — use
// explicit `\s` / dots as separators instead.
const LEADING_LOCALITY_PREFIX = /^(?:гр\.|град\s|с\.|село\s|к\.\s*к\.?|кк\s|курортен\s+комплекс)/iu;

/**
 * Prepends "гр. "/"с. " from `is_village`, but skips it when the name already
 * begins with a locality prefix (avoids "гр. к.к. Мальовица" double prefixes).
 */
export function applySettlementPrefix(name: string, isVillage: boolean | null | undefined): string {
  const n = (name ?? "").trim();
  if (!n || LEADING_LOCALITY_PREFIX.test(n)) return n;
  return settlementPrefix(isVillage) + n;
}

export function getCityLabel(city: { name_bg: string; is_village?: boolean | null }) {
  return applySettlementPrefix(city.name_bg, city.is_village);
}

/** Dropdown label when `cities.region` is present (disambiguate duplicate names). */
export function getCitySelectLabel(city: { name_bg: string; is_village?: boolean | null; region?: string | null }) {
  const label = applySettlementPrefix(city.name_bg, city.is_village);
  const r = city.region?.trim();
  return r ? `${label} — ${r}` : label;
}

/** Cards / listings: `cities.name_bg` only (see `getFestivalLocationDisplay`). */
export function getFestivalListingCityPrimary(festival: Festival): string {
  return getFestivalLocationDisplay(festival).city ?? "";
}
