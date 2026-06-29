import { describe, it, expect } from "vitest";
import { computeSmartResearchPatch, type SmartResearchPatchTarget } from "./computeSmartResearchPatch";
import type { SmartResearchFields } from "./smart-pipeline";

function makeFields(overrides: Partial<SmartResearchFields> = {}): SmartResearchFields {
  return {
    title: null,
    start_date: null,
    end_date: null,
    start_time: null,
    end_time: null,
    city: null,
    location_name: null,
    address: null,
    organizer_name: null,
    organizer_names: null,
    description: null,
    is_free: null,
    category: null,
    tags: [],
    website_url: null,
    facebook_url: null,
    instagram_url: null,
    ticket_url: null,
    hero_image: null,
    hero_image_candidates: [],
    program_draft: null,
    ...overrides,
  };
}

function makeTarget(overrides: Partial<SmartResearchPatchTarget> = {}): SmartResearchPatchTarget {
  return {
    description: null,
    website_url: null,
    ticket_url: null,
    location_name: null,
    address: null,
    is_free: null,
    category: null,
    start_time: null,
    end_time: null,
    tags: null,
    ...overrides,
  };
}

describe("computeSmartResearchPatch", () => {
  it("fills description when target is empty", () => {
    const patch = computeSmartResearchPatch(makeFields({ description: "Три дни музика" }), makeTarget(), false);
    expect(patch?.description).toBe("Три дни музика");
  });

  it("skips a field when target already has a value", () => {
    const patch = computeSmartResearchPatch(
      makeFields({ description: "Ново" }),
      makeTarget({ description: "Старо" }),
      false,
    );
    expect(patch).toBeNull();
  });

  it("ignores blank/whitespace-only field values", () => {
    const patch = computeSmartResearchPatch(makeFields({ website_url: "   " }), makeTarget(), false);
    expect(patch).toBeNull();
  });

  it("fills is_free: false (boolean false is a valid fill value)", () => {
    const patch = computeSmartResearchPatch(makeFields({ is_free: false }), makeTarget({ is_free: null }), false);
    expect(patch?.is_free).toBe(false);
  });

  it("does not fill is_free when target already has false", () => {
    const patch = computeSmartResearchPatch(makeFields({ is_free: false }), makeTarget({ is_free: false }), false);
    expect(patch).toBeNull();
  });

  it("fills tags only when target tags is null or empty array", () => {
    const withNull = computeSmartResearchPatch(makeFields({ tags: ["народни", "музика"] }), makeTarget({ tags: null }), false);
    expect(withNull?.tags).toEqual(["народни", "музика"]);

    const withEmpty = computeSmartResearchPatch(makeFields({ tags: ["народни"] }), makeTarget({ tags: [] }), false);
    expect(withEmpty?.tags).toEqual(["народни"]);

    const withExisting = computeSmartResearchPatch(makeFields({ tags: ["народни"] }), makeTarget({ tags: ["вече има"] }), false);
    expect(withExisting).toBeNull();
  });

  it("attaches program_draft only when festival has no existing program and draft has days", () => {
    const draft = { version: 1, days: [{ date: "2026-07-01", title: null, items: [{ title: "Концерт", sort_order: 0 }] }] };
    const withNoProgram = computeSmartResearchPatch(makeFields({ program_draft: draft }), makeTarget(), false);
    expect(withNoProgram?.program_draft).toEqual(draft);

    const withExistingProgram = computeSmartResearchPatch(makeFields({ program_draft: draft }), makeTarget(), true);
    expect(withExistingProgram).toBeNull();
  });

  it("does not attach an empty program_draft", () => {
    const emptyDraft = { version: 1, days: [] };
    const patch = computeSmartResearchPatch(makeFields({ program_draft: emptyDraft }), makeTarget(), false);
    expect(patch).toBeNull();
  });

  it("patches multiple fields at once", () => {
    const patch = computeSmartResearchPatch(
      makeFields({ description: "Описание", website_url: "https://example.bg", start_time: "18:00:00" }),
      makeTarget(),
      false,
    );
    expect(patch).toEqual({ description: "Описание", website_url: "https://example.bg", start_time: "18:00:00" });
  });

  it("returns null when nothing to patch", () => {
    const patch = computeSmartResearchPatch(makeFields(), makeTarget(), false);
    expect(patch).toBeNull();
  });
});
