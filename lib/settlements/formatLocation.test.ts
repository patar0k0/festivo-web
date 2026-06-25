import { describe, it, expect } from "vitest";
import {
  formatSettlementLocationLines,
  isResortComplexName,
  resolveSettlementKind,
} from "./formatLocation";

describe("isResortComplexName", () => {
  it("detects resort-complex prefixes", () => {
    expect(isResortComplexName("к.к. Мальовица")).toBe(true);
    expect(isResortComplexName("кк Боровец")).toBe(true);
    expect(isResortComplexName("курортен комплекс Албена")).toBe(true);
  });

  it("rejects ordinary settlement names", () => {
    expect(isResortComplexName("Пловдив")).toBe(false);
    expect(isResortComplexName("Карлово")).toBe(false);
    expect(isResortComplexName(null)).toBe(false);
  });
});

describe("formatSettlementLocationLines", () => {
  it("shows the тип label for ordinary cities/villages", () => {
    expect(formatSettlementLocationLines("Пловдив", false)?.secondary).toBe("град");
    expect(formatSettlementLocationLines("Гела", true)?.secondary).toBe("село");
  });

  it("suppresses the тип label for resort complexes even when is_village=false", () => {
    const lines = formatSettlementLocationLines("к.к. Мальовица", false);
    expect(lines?.secondary).toBeNull();
  });

  it("keeps the region tail when present", () => {
    expect(formatSettlementLocationLines("Пловдив, обл. Пловдив", false)?.secondary).toBe("град • обл. Пловдив");
  });
});

describe("resolveSettlementKind", () => {
  it("maps is_village to a kind", () => {
    expect(resolveSettlementKind(true)).toBe("village");
    expect(resolveSettlementKind(false)).toBe("city");
    expect(resolveSettlementKind(null)).toBeNull();
  });
});
