import { normalizeSettlementInput } from "@/lib/settlements/normalizeSettlementInput";

export type CitySuggestion = {
  id: number;
  name_bg: string;
  slug: string;
  is_village: boolean | null;
};

export type CitySearchResult = {
  suggestions: CitySuggestion[];
  hasExactMatch: boolean;
  normalizedInput: string;
};

/** Lowercased, prefix-stripped key for comparing settlement names (Bulgarian collation). */
function compareKey(value: string): string {
  return normalizeSettlementInput(value).toLocaleLowerCase("bg-BG");
}

/**
 * Pure ranking for the organizer city autocomplete.
 * - dedups rows by id (first occurrence wins)
 * - exact-name matches float to the top
 * - partial matches (prefix, then substring) float above non-matches, ordered by match position
 * - reports whether an exact match exists (drives the "➕ Добави …" affordance)
 *
 * Note: the plan's reference implementation only floats exact matches and leaves the rest
 * in input order, but its own first test ("dedups by id, preserving first occurrence")
 * expects a prefix match to outrank a non-matching row — so partial-match floating is required
 * for the test suite to pass, not an embellishment.
 */
export function rankCitySuggestions(rows: CitySuggestion[], query: string, limit = 8): CitySearchResult {
  const normalizedInput = compareKey(query);

  const seen = new Set<number>();
  const unique: CitySuggestion[] = [];
  for (const row of rows) {
    if (!row || typeof row.id !== "number" || seen.has(row.id)) continue;
    seen.add(row.id);
    unique.push(row);
  }

  const exact: CitySuggestion[] = [];
  const partial: Array<{ row: CitySuggestion; index: number }> = [];
  const rest: CitySuggestion[] = [];

  for (const row of unique) {
    const cityKey = compareKey(row.name_bg);
    if (normalizedInput.length > 0 && cityKey === normalizedInput) {
      exact.push(row);
    } else if (normalizedInput.length > 0 && cityKey.includes(normalizedInput)) {
      partial.push({ row, index: cityKey.indexOf(normalizedInput) });
    } else {
      rest.push(row);
    }
  }

  partial.sort((a, b) => a.index - b.index);

  return {
    suggestions: [...exact, ...partial.map((p) => p.row), ...rest].slice(0, limit),
    hasExactMatch: exact.length > 0,
    normalizedInput,
  };
}
