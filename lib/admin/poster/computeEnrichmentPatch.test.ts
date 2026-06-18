import { test } from "node:test";
import assert from "node:assert/strict";
import { computeEnrichmentPatch } from "./computeEnrichmentPatch.js";

function makeExtraction(overrides: Record<string, unknown> = {}) {
  const conf = (v: unknown) => ({ value: v ?? null, confidence: 0.9, needs_review: false });
  return {
    title: conf("Тест фест"),
    title_candidates: [],
    category: conf(overrides.category ?? null),
    start_date: { day: 1, month: 7, year: 2026, year_explicit: true, weekday: null },
    end_date: { day: null, month: null, year: null, year_explicit: false, weekday: null },
    other_dates: [],
    start_time: conf(null),
    end_time: conf(null),
    city: conf(null),
    venue_name: conf(overrides.venue_name ?? null),
    address: conf(overrides.address ?? null),
    organizer_name: conf(null),
    organizer_names: [],
    description: conf(overrides.description ?? null),
    is_free: conf(overrides.is_free !== undefined ? overrides.is_free : null),
    price_range: conf(null),
    website_url: conf(overrides.website_url ?? null),
    facebook_url: conf(overrides.facebook_url ?? null),
    instagram_url: conf(overrides.instagram_url ?? null),
    ticket_url: conf(overrides.ticket_url ?? null),
    contact: { phone: null, person: null },
    tags: [],
    program: overrides.program ?? null,
  };
}

test("returns patch with description when target is empty", () => {
  const ext = makeExtraction({ description: "Три дни музика" });
  const patch = computeEnrichmentPatch(ext, { description: null }, "festival");
  assert.equal(patch?.description, "Три дни музика");
});

test("skips field when target already has a value", () => {
  const ext = makeExtraction({ description: "Ново" });
  const patch = computeEnrichmentPatch(ext, { description: "Старо" }, "festival");
  assert.equal(patch, null);
});

test("fills facebook_url when empty string on target", () => {
  const ext = makeExtraction({ facebook_url: "https://fb.com/events/1" });
  const patch = computeEnrichmentPatch(ext, { facebook_url: "" }, "festival");
  assert.equal(patch?.facebook_url, "https://fb.com/events/1");
});

test("fills is_free: false (boolean false is a valid fill value)", () => {
  const ext = makeExtraction({ is_free: false });
  const patch = computeEnrichmentPatch(ext, { is_free: null }, "festival");
  assert.equal(patch?.is_free, false);
});

test("does not fill is_free when target already has false", () => {
  const ext = makeExtraction({ is_free: false });
  const patch = computeEnrichmentPatch(ext, { is_free: false }, "festival");
  assert.equal(patch, null);
});

test("fills location_name from venue_name", () => {
  const ext = makeExtraction({ venue_name: "Летен театър" });
  const patch = computeEnrichmentPatch(ext, { location_name: null }, "festival");
  assert.equal(patch?.location_name, "Летен театър");
});

test("includes program_draft for pending target but not festival target", () => {
  const ext = makeExtraction({ program: [{ time: "20:00", act: "Концерт" }] });
  const patchPending = computeEnrichmentPatch(ext, { program_draft: null }, "pending");
  const patchFestival = computeEnrichmentPatch(ext, {}, "festival");
  assert.ok(patchPending?.program_draft !== undefined);
  assert.equal(patchFestival?.program_draft, undefined);
});

test("returns null when nothing to patch", () => {
  const ext = makeExtraction({ description: null, facebook_url: null });
  const patch = computeEnrichmentPatch(ext, {}, "festival");
  assert.equal(patch, null);
});

test("patches multiple fields at once", () => {
  const ext = makeExtraction({ description: "Описание", facebook_url: "https://fb.com/1" });
  const patch = computeEnrichmentPatch(ext, { description: null, facebook_url: null }, "festival");
  assert.equal(patch?.description, "Описание");
  assert.equal(patch?.facebook_url, "https://fb.com/1");
});
