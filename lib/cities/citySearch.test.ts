import { describe, it, expect } from "vitest";
import { rankCitySuggestions, type CitySuggestion } from "./citySearch";

const row = (id: number, name_bg: string, slug: string, is_village: boolean | null = false): CitySuggestion => ({
  id,
  name_bg,
  slug,
  is_village,
});

describe("rankCitySuggestions", () => {
  it("dedups by id, preserving first occurrence", () => {
    const rows = [row(1, "София", "sofia"), row(1, "София", "sofia"), row(2, "Сливен", "sliven")];
    const result = rankCitySuggestions(rows, "сли");
    expect(result.suggestions.map((s) => s.id)).toEqual([2, 1]);
  });

  it("puts exact name match first and flags hasExactMatch", () => {
    const rows = [row(1, "Старо село", "staro-selo"), row(2, "Стара Загора", "stara-zagora")];
    const result = rankCitySuggestions(rows, "Стара Загора");
    expect(result.suggestions[0].id).toBe(2);
    expect(result.hasExactMatch).toBe(true);
  });

  it("treats Bulgarian locality prefixes and case as equal for exact match", () => {
    const rows = [row(5, "Баня", "banya")];
    const result = rankCitySuggestions(rows, "с. баня");
    expect(result.hasExactMatch).toBe(true);
    expect(result.normalizedInput).toBe("баня");
  });

  it("reports no exact match when only partial hits exist", () => {
    const rows = [row(3, "Пловдив", "plovdiv")];
    const result = rankCitySuggestions(rows, "плов");
    expect(result.hasExactMatch).toBe(false);
  });

  it("limits the number of suggestions", () => {
    const rows = Array.from({ length: 20 }, (_, i) => row(i + 1, `Град${i}`, `grad-${i}`));
    const result = rankCitySuggestions(rows, "град", 8);
    expect(result.suggestions).toHaveLength(8);
  });

  it("returns empty suggestions and no exact match for blank query", () => {
    const result = rankCitySuggestions([row(1, "София", "sofia")], "   ");
    expect(result.hasExactMatch).toBe(false);
    expect(result.normalizedInput).toBe("");
  });
});
