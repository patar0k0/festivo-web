import { validateFestivalData } from "@/lib/admin/research/festivalDataQuality";

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

/** Merge joined city name into validation shape when `city_name_display` is empty. */
export function augmentPendingRowForValidation(row: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...row };
  const cityRel = row.city;
  let nameBg: string | null = null;
  if (cityRel && typeof cityRel === "object" && !Array.isArray(cityRel)) {
    const n = (cityRel as { name_bg?: unknown }).name_bg;
    if (typeof n === "string" && n.trim()) nameBg = n.trim();
  }
  if (nameBg && !str(next.city_name_display)) {
    next.city_name_display = nameBg;
  }
  return next;
}

/**
 * Fast-review “Missing:” line: date, city, venue — from validateFestivalData + venue heuristic.
 */
export function getFastReviewMissingLabels(row: Record<string, unknown>): string[] {
  const forVal = augmentPendingRowForValidation(row);
  const v = validateFestivalData(forVal);
  const labels: string[] = [];
  if (v.missing.includes("start_date")) labels.push("date");
  if (v.missing.includes("city")) labels.push("city");
  const venue = str(row.location_name) ?? str(row.location_guess) ?? str(row.address);
  if (!venue) labels.push("venue");
  return labels;
}
