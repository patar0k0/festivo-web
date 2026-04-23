export type FestivalSettlementType = "city" | "village" | "resort";

/** Coerces API/LLM/JSON values to a known settlement type; null when missing or invalid. */
export function normalizeFestivalSettlementType(value: unknown): FestivalSettlementType | null {
  if (value === "city" || value === "village" || value === "resort") return value;
  return null;
}
