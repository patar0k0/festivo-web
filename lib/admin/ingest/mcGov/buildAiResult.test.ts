import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAiResultFromSmartResearch } from "./buildAiResult.js";
import type { SmartResearchResult } from "@/lib/admin/research/smart-pipeline";

function makeSmartResult(overrides: Partial<SmartResearchResult["fields"]> = {}): SmartResearchResult {
  return {
    fields: {
      title: "Фолклорен събор на етносите",
      start_date: "2026-07-12",
      end_date: "2026-07-12",
      start_time: null,
      end_time: null,
      city: "Макреш",
      location_name: "Салона на читалището",
      address: null,
      organizer_name: "Народно читалище",
      organizer_names: ["Народно читалище"],
      description: "Тридневен фолклорен събор.",
      is_free: true,
      category: "folk",
      tags: ["фолклор"],
      website_url: null,
      facebook_url: "https://facebook.com/example",
      instagram_url: null,
      ticket_url: null,
      hero_image: null,
      hero_image_candidates: ["https://example.com/a.jpg", "https://example.com/b.jpg"],
      program_draft: null,
      ...overrides,
    },
    sources: [
      { url: "https://example.com/a", title: "A", domain: "example.com", snippet: null, is_ai_overview: false },
      { url: "https://example.com/overview", title: "AI Overview", domain: "google.com", snippet: null, is_ai_overview: true },
    ],
    confidence: "high",
    providers_used: ["serpapi"],
    warnings: [],
    gemini_model: "gemini-2.5-flash",
  };
}

test("maps fields straight through", () => {
  const result = buildAiResultFromSmartResearch(makeSmartResult());
  assert.equal(result.title, "Фолклорен събор на етносите");
  assert.equal(result.start_date, "2026-07-12");
  assert.equal(result.city, "Макреш");
  assert.equal(result.organizer_name, "Народно читалище");
  assert.equal(result.confidence, "high");
});

test("excludes AI-overview sources from source_urls", () => {
  const result = buildAiResultFromSmartResearch(makeSmartResult());
  assert.deepEqual(result.source_urls, ["https://example.com/a"]);
});

test("uses the first hero_image_candidate as hero when hero_image is null", () => {
  const result = buildAiResultFromSmartResearch(makeSmartResult({ hero_image: null }));
  assert.equal(result.hero_image, "https://example.com/a.jpg");
  assert.deepEqual(result.gallery_image_urls, ["https://example.com/b.jpg"]);
});

test("prefers an explicit hero_image over the candidates list", () => {
  const result = buildAiResultFromSmartResearch(
    makeSmartResult({ hero_image: "https://example.com/explicit.jpg" }),
  );
  assert.equal(result.hero_image, "https://example.com/explicit.jpg");
  assert.deepEqual(result.gallery_image_urls, ["https://example.com/a.jpg", "https://example.com/b.jpg"]);
});

test("missing_fields is always empty (no human review step here)", () => {
  const result = buildAiResultFromSmartResearch(makeSmartResult());
  assert.deepEqual(result.missing_fields, []);
});
