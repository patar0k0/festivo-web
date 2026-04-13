import { normalizeSettlementInput } from "@/lib/settlements/normalizeSettlementInput";

export type FestivalCityRelation = { name_bg?: string | null; slug?: string | null } | null | undefined;

export type FestivalCityTextSource = {
  cityRelation?: FestivalCityRelation;
  city_name_display?: string | null;
  city_guess?: string | null;
};

function trimNullable(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length ? t : null;
}

/**
 * Raw settlement label for forms and resolution (no legacy `festivals.city` text).
 * Order: canonical join (name, then slug) → moderated display → AI guess.
 */
/** Raw settlement line from festival fields (no гр./с. prefix; not mojibake-normalized). */
export function festivalSettlementSourceText(src: FestivalCityTextSource): string | null {
  const rel = src.cityRelation;
  return (
    trimNullable(rel?.name_bg) ??
    trimNullable(rel?.slug) ??
    trimNullable(src.city_name_display) ??
    trimNullable(src.city_guess) ??
    null
  );
}

export type CityApprovalInputSource = {
  postedCity?: string | null;
  city_id?: number | null;
  cityRelation?: FestivalCityRelation;
  city_name_display?: string | null;
  city_guess?: string | null;
};

/**
 * Single write-side resolution for approve (and similar): body override → numeric id → free-text fallbacks.
 */
export function resolveCityInputForApproval(src: CityApprovalInputSource): string {
  const posted = trimNullable(src.postedCity);
  if (posted) {
    return normalizeSettlementInput(posted);
  }
  if (src.city_id != null && Number.isFinite(Number(src.city_id))) {
    return String(src.city_id);
  }
  const fromText = festivalSettlementSourceText({
    cityRelation: src.cityRelation,
    city_name_display: src.city_name_display,
    city_guess: src.city_guess,
  });
  if (fromText) {
    return normalizeSettlementInput(fromText);
  }
  return "";
}
