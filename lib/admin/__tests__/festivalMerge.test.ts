import { describe, it, expect } from "vitest";
import { computeFillNullPatch, mergeTags } from "../festivalMerge";

describe("mergeTags", () => {
  it("unions preserving winner order then new loser tags", () => {
    expect(mergeTags(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
  });
  it("ignores non-arrays", () => {
    expect(mergeTags(null, ["a"])).toEqual(["a"]);
  });
});

describe("computeFillNullPatch", () => {
  it("fills empty winner fields from loser, never overwrites", () => {
    const winner = { description: "", website_url: null, ticket_url: "http://w", tags: ["a"] };
    const loser = { description: "desc", website_url: "http://l", ticket_url: "http://l2", tags: ["a", "b"] };
    const patch = computeFillNullPatch(winner, loser);
    expect(patch.description).toBe("desc");
    expect(patch.website_url).toBe("http://l");
    expect(patch.ticket_url).toBeUndefined();
    expect(patch.tags).toEqual(["a", "b"]);
  });
  it("omits tags when loser adds nothing new", () => {
    const patch = computeFillNullPatch({ tags: ["a", "b"] }, { tags: ["a"] });
    expect(patch.tags).toBeUndefined();
  });
  it("omits a field when loser is also empty", () => {
    const patch = computeFillNullPatch({ description: "" }, { description: "  " });
    expect(patch.description).toBeUndefined();
  });
});
