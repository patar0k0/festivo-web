import { getFestivalLocationDisplay } from "@/lib/location/getFestivalLocationDisplay";
import type { Festival } from "@/lib/types";

/** Prefix "с. " for villages, "гр. " for cities, "" when unknown. */
export function settlementPrefix(isVillage: boolean | null | undefined): string {
  if (isVillage === true) return "с. ";
  if (isVillage === false) return "гр. ";
  return "";
}

export function getCityLabel(city: { name_bg: string; is_village?: boolean | null }) {
  return settlementPrefix(city.is_village) + city.name_bg;
}

/** Dropdown label when `cities.region_bg` is present (disambiguate duplicate names). */
export function getCitySelectLabel(city: { name_bg: string; is_village?: boolean | null; region_bg?: string | null }) {
  const label = settlementPrefix(city.is_village) + city.name_bg;
  const r = city.region_bg?.trim();
  return r ? `${label} — ${r}` : label;
}

/** Cards / listings: `cities.name_bg` only (see `getFestivalLocationDisplay`). */
export function getFestivalListingCityPrimary(festival: Festival): string {
  return getFestivalLocationDisplay(festival).city ?? "";
}
