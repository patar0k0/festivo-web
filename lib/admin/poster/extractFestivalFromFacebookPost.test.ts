import { test } from "node:test";
import assert from "node:assert/strict";
import { extractFestivalFromFacebookPost } from "./extractFestivalFromFacebookPost";
import type { PosterExtraction } from "./posterExtractionSchema";

function blankExtraction(title: string): PosterExtraction {
  const conf = (v: unknown) => ({ value: v, confidence: 0.9, needs_review: false });
  return {
    title: conf(title),
    title_candidates: [],
    category: conf(null),
    start_date: { day: null, month: null, year: null, year_explicit: false, weekday: null },
    end_date: { day: null, month: null, year: null, year_explicit: false, weekday: null },
    other_dates: [],
    start_time: conf(null),
    end_time: conf(null),
    city: conf(null),
    venue_name: conf(null),
    address: conf(null),
    organizer_name: conf(null),
    organizer_names: [],
    description: conf(null),
    is_free: conf(null),
    price_range: conf(null),
    website_url: conf(null),
    facebook_url: conf(null),
    instagram_url: conf(null),
    ticket_url: conf(null),
    contact: { phone: null, person: null },
    tags: [],
    program: null,
  } as unknown as PosterExtraction;
}

test("delegates to the injected extractor and returns its result", async () => {
  const fake = blankExtraction("Тестов фестивал");
  const result = await extractFestivalFromFacebookPost({
    text: "някакъв текст",
    image: null,
    extractor: async (input) => {
      assert.equal(input.text, "някакъв текст");
      assert.equal(input.image, null);
      return fake;
    },
  });
  assert.equal(result, fake);
});

test("defaults to the Gemini extractor when none is injected", async () => {
  assert.equal(typeof (await import("./extractFestivalFromFacebookPost")).geminiFacebookPostExtractor, "function");
});
