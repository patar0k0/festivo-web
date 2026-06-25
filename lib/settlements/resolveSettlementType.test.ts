import { describe, it, expect } from "vitest";
import { resolveSettlementType } from "./resolveSettlementType";

describe("resolveSettlementType", () => {
  it("classifies known towns as град (false)", () => {
    expect(resolveSettlementType("София")).toBe(false);
    expect(resolveSettlementType("Добринище")).toBe(false);
    expect(resolveSettlementType("Костандово")).toBe(false);
    expect(resolveSettlementType("Павел баня")).toBe(false);
  });

  it("classifies towns whose name contains 'град' via the list, not a broken substring rule", () => {
    expect(resolveSettlementType("Асеновград")).toBe(false);
    expect(resolveSettlementType("Благоевград")).toBe(false);
  });

  it("defaults unknown settlements to село (true)", () => {
    expect(resolveSettlementType("Вакарел")).toBe(true);
    expect(resolveSettlementType("Ягодово")).toBe(true);
    expect(resolveSettlementType("Орешак")).toBe(true);
  });

  it("does not treat a village ending in 'град' as a town (regression)", () => {
    // "Новград" is a village; the old `key.includes('град')` rule wrongly flagged it as град.
    expect(resolveSettlementType("Новград")).toBe(true);
  });

  it("treats resort complexes as neither (null)", () => {
    expect(resolveSettlementType("к.к. Мальовица")).toBeNull();
    expect(resolveSettlementType("Боровец")).toBeNull();
    expect(resolveSettlementType("курортен комплекс Албена")).toBeNull();
  });

  it("honours an explicit prefix in the supplied text", () => {
    expect(resolveSettlementType("с. Брезово")).toBe(true); // prefix wins over the town list
    expect(resolveSettlementType("гр. Несебър")).toBe(false);
  });

  it("uses the manual dataset overrides", () => {
    expect(resolveSettlementType("Гела")).toBe(true);
    expect(resolveSettlementType("Копривщица")).toBe(false);
  });

  it("returns null for empty input", () => {
    expect(resolveSettlementType("")).toBeNull();
    expect(resolveSettlementType("   ")).toBeNull();
  });
});
