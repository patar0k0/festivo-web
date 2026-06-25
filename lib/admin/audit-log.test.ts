import { describe, it, expect } from "vitest";
import { pickFields } from "./audit-log";

describe("pickFields", () => {
  it("returns only the requested keys that exist on the source", () => {
    const result = pickFields({ a: 1, b: 2, c: 3 }, ["a", "c", "missing"]);
    expect(result).toEqual({ a: 1, c: 3 });
  });

  it("returns an empty object for a null source", () => {
    expect(pickFields(null, ["a"])).toEqual({});
  });

  it("returns an empty object for an undefined source", () => {
    expect(pickFields(undefined, ["a"])).toEqual({});
  });
});
