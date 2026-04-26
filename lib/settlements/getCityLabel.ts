import { getFestivalLocationDisplay } from "@/lib/location/getFestivalLocationDisplay";
import type { Festival } from "@/lib/types";

export function getCityLabel(city: { name_bg: string }) {
  return city.name_bg;
}

/** Dropdown label when `cities.region_bg` is present (disambiguate duplicate names). */
export function getCitySelectLabel(city: { name_bg: string; region_bg?: string | null }) {
  const r = city.region_bg?.trim();
  return r ? `${city.name_bg} — ${r}` : city.name_bg;
}

/** Cards / listings: `cities.name_bg` only (see `getFestivalLocationDisplay`). */
export function getFestivalListingCityPrimary(festival: Festival): string {
  return getFestivalLocationDisplay(festival).city ?? "";
}
