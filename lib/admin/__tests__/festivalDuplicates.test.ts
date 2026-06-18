import { describe, it, expect } from "vitest";
import { titleContainment, buildDuplicateRows, type FestivalRow } from "../festivalDuplicates";

const A = 'Фолклорен танцов фестивал „С танците на дедите ни" 2026';
const B = 'Фолклорен фестивал „С танците на дедите ни" 2026';

describe("titleContainment", () => {
  it("matches near-duplicate with one extra word", () => {
    expect(titleContainment(A, B)).toBeGreaterThanOrEqual(0.8);
  });
  it("rejects unrelated titles", () => {
    expect(titleContainment("Бирен фест Варна", "Розобер Казанлък")).toBeLessThan(0.8);
  });
});

describe("buildDuplicateRows fuzzy", () => {
  const mk = (id: string, title: string): FestivalRow => ({
    id, title, slug: null, start_date: "2026-06-19", city_id: 5, city_name: "Димитровград", status: "verified",
  });

  it("finds the near-duplicate pair when city matches", () => {
    const pairs = buildDuplicateRows([mk("1", A), mk("2", B)]);
    expect(pairs.length).toBe(1);
    expect(pairs[0].reasons).toContain("близко заглавие");
  });

  it("does not pair near-titles in different cities with different dates", () => {
    const r1 = { ...mk("1", A), city_id: 5, start_date: "2026-06-19" };
    const r2 = { ...mk("2", B), city_id: 99, start_date: "2027-01-01" };
    expect(buildDuplicateRows([r1, r2]).length).toBe(0);
  });
});
