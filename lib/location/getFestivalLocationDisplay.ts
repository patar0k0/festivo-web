import { normalizeFestivalLocationText } from "@/lib/festival/publicLocationDisplay";
import { fixMojibakeBG } from "@/lib/text/fixMojibake";

export type FestivalLocationDisplayInput = {
  location_name?: string | null;
  cities?: { name_bg?: string | null } | null;
};

export function getFestivalLocationDisplay(festival: FestivalLocationDisplayInput) {
  const locationName = festival.location_name?.trim() || null;
  const rawCity = festival.cities?.name_bg?.trim() || null;
  const city = rawCity ? fixMojibakeBG(rawCity) : null;

  return {
    title: locationName,
    city,
  };
}

/** Single-line venue + city for chips and hero metadata; omits duplicate when venue equals city. */
export function formatFestivalLocationUiLine(festival: FestivalLocationDisplayInput): string {
  const loc = getFestivalLocationDisplay(festival);
  const parts: string[] = [];
  if (loc.title) parts.push(loc.title);
  if (
    loc.city &&
    (!loc.title || normalizeFestivalLocationText(loc.city) !== normalizeFestivalLocationText(loc.title))
  ) {
    parts.push(loc.city);
  }
  return parts.join(" · ");
}
