import { festivalLocationPrimary } from "@/lib/settlements/formatDisplayName";
import { fixMojibakeBG } from "@/lib/text/fixMojibake";
import type { Festival } from "@/lib/types";

export function getCityLabel(city: { name_bg: string }) {
  return city.name_bg;
}

/** Dropdown label when `cities.region_bg` is present (disambiguate duplicate names). */
export function getCitySelectLabel(city: { name_bg: string; region_bg?: string | null }) {
  const r = city.region_bg?.trim();
  return r ? `${city.name_bg} — ${r}` : city.name_bg;
}

/** Cards / listings: canonical `cities.name_bg` when joined; else legacy primary line. */
export function getFestivalListingCityPrimary(festival: Festival): string {
  const nb = festival.cities?.name_bg?.trim();
  if (nb) return fixMojibakeBG(nb);
  return festivalLocationPrimary(festival, "");
}
