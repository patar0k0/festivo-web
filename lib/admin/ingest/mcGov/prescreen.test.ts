import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPrescreenPrompt, parsePrescreenResponse } from "./prescreen.js";
import type { McGovScrapedEvent } from "./parseListPage.js";

function makeEvent(overrides: Partial<McGovScrapedEvent> = {}): McGovScrapedEvent {
  return {
    postId: "1",
    title: "Фолклорен събор на етносите",
    startDate: "2026-07-12",
    endDate: "2026-07-12",
    locationName: "село Макреш",
    organizerName: "Народно читалище",
    sourceUrl: "https://mc.government.bg/?p=1",
    ...overrides,
  };
}

test("buildPrescreenPrompt includes all scraped fields", () => {
  const prompt = buildPrescreenPrompt(makeEvent());
  assert.match(prompt, /Фолклорен събор на етносите/);
  assert.match(prompt, /Народно читалище/);
  assert.match(prompt, /село Макреш/);
  assert.match(prompt, /2026-07-12/);
});

test("buildPrescreenPrompt handles missing organizer/location gracefully", () => {
  const prompt = buildPrescreenPrompt(makeEvent({ organizerName: null, locationName: null }));
  assert.doesNotMatch(prompt, /null/);
});

test("parsePrescreenResponse accepts a well-formed response", () => {
  const result = parsePrescreenResponse({ is_festival: true, score: 85, reason: "Многодневен фолклорен събор" });
  assert.deepEqual(result, { is_festival: true, score: 85, reason: "Многодневен фолклорен събор" });
});

test("parsePrescreenResponse clamps score to 0-100", () => {
  const result = parsePrescreenResponse({ is_festival: true, score: 140, reason: "" });
  assert.equal(result?.score, 100);
});

test("parsePrescreenResponse returns null when is_festival is missing", () => {
  const result = parsePrescreenResponse({ score: 85, reason: "x" });
  assert.equal(result, null);
});

test("parsePrescreenResponse returns null for non-object input", () => {
  assert.equal(parsePrescreenResponse(null), null);
  assert.equal(parsePrescreenResponse("not an object"), null);
});
