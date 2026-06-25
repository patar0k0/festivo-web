import { describe, it, expect } from "vitest";
import { applySettlementPrefix, getCityLabel, settlementPrefix } from "./getCityLabel";

describe("applySettlementPrefix", () => {
  it("prepends гр. for cities and с. for villages", () => {
    expect(applySettlementPrefix("Пловдив", false)).toBe("гр. Пловдив");
    expect(applySettlementPrefix("Гела", true)).toBe("с. Гела");
  });

  it("adds no prefix when type is unknown", () => {
    expect(applySettlementPrefix("Анхиало", null)).toBe("Анхиало");
    expect(applySettlementPrefix("Анхиало", undefined)).toBe("Анхиало");
  });

  it("does not double-prefix resort complexes (к.к. …)", () => {
    // is_village is NOT NULL in the DB, so resorts are forced to false — must not become "гр. к.к. …".
    expect(applySettlementPrefix("к.к. Мальовица", false)).toBe("к.к. Мальовица");
    expect(applySettlementPrefix("к.к. Слънчев бряг", false)).toBe("к.к. Слънчев бряг");
  });

  it("leaves an already-prefixed name untouched", () => {
    expect(applySettlementPrefix("гр. София", false)).toBe("гр. София");
    expect(applySettlementPrefix("с. Лещен", true)).toBe("с. Лещен");
    expect(applySettlementPrefix("град Варна", false)).toBe("град Варна");
  });

  it("does not mistake a capitalised name starting with С/Г for a prefix", () => {
    // No dot after the first letter → not a prefix.
    expect(applySettlementPrefix("Стара Загора", false)).toBe("гр. Стара Загора");
    expect(applySettlementPrefix("Габрово", false)).toBe("гр. Габрово");
    expect(applySettlementPrefix("Градец", true)).toBe("с. Градец");
  });

  it("trims surrounding whitespace", () => {
    expect(applySettlementPrefix("  Бургас  ", false)).toBe("гр. Бургас");
    expect(applySettlementPrefix("   ", false)).toBe("");
  });
});

describe("getCityLabel", () => {
  it("uses the defensive prefix logic", () => {
    expect(getCityLabel({ name_bg: "Пловдив", is_village: false })).toBe("гр. Пловдив");
    expect(getCityLabel({ name_bg: "к.к. Мальовица", is_village: false })).toBe("к.к. Мальовица");
  });
});

describe("settlementPrefix", () => {
  it("maps the boolean to a bare prefix string", () => {
    expect(settlementPrefix(true)).toBe("с. ");
    expect(settlementPrefix(false)).toBe("гр. ");
    expect(settlementPrefix(null)).toBe("");
  });
});
