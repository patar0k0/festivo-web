import { describe, it, expect } from "vitest";
import { decideCityResolution } from "./resolveCityUpdate";

describe("decideCityResolution", () => {
  it("returns create mode when a non-empty city_name is provided", () => {
    expect(decideCityResolution({ city_name: "  Ново село  " })).toEqual({ mode: "create", name: "Ново село" });
  });

  it("city_name takes precedence over city_id", () => {
    expect(decideCityResolution({ city_name: "Банкя", city_id: 7 })).toEqual({ mode: "create", name: "Банкя" });
  });

  it("returns existing mode for a valid positive city_id", () => {
    expect(decideCityResolution({ city_id: 42 })).toEqual({ mode: "existing", id: 42 });
  });

  it("accepts numeric-string city_id", () => {
    expect(decideCityResolution({ city_id: "42" })).toEqual({ mode: "existing", id: 42 });
  });

  it("returns none for blank city_name and missing city_id", () => {
    expect(decideCityResolution({ city_name: "   " })).toEqual({ mode: "none" });
  });

  it("returns none for null/zero/invalid city_id", () => {
    expect(decideCityResolution({ city_id: null })).toEqual({ mode: "none" });
    expect(decideCityResolution({ city_id: 0 })).toEqual({ mode: "none" });
    expect(decideCityResolution({ city_id: "abc" })).toEqual({ mode: "none" });
  });
});
