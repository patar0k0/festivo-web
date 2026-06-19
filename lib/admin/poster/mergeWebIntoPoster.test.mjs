import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeWebIntoPoster } from "./mergeWebIntoPoster.mjs";

// Helpers — build minimal PosterExtraction and GeminiRawExtraction objects
function makeConf(value, { confidence = 0.9, needs_review = false } = {}) {
  return { value, confidence, needs_review };
}

function makePoster(overrides = {}) {
  return {
    title: makeConf(overrides.title ?? "Фест", { confidence: overrides.titleConf ?? 0.9, needs_review: overrides.titleNeedsReview ?? false }),
    title_candidates: [],
    category: makeConf(null, { needs_review: true }),
    start_date: { day: 25, month: 7, year: 2026, year_explicit: true, weekday: null },
    end_date: { day: null, month: null, year: null, year_explicit: false, weekday: null },
    other_dates: [],
    start_time: makeConf(null, { needs_review: true }),
    end_time: makeConf(null, { needs_review: true }),
    city: makeConf(overrides.city ?? null, { needs_review: overrides.cityNeedsReview ?? overrides.city == null }),
    venue_name: makeConf(overrides.venue_name ?? null, { needs_review: overrides.venue_name == null }),
    address: makeConf(overrides.address ?? null, { needs_review: overrides.address == null }),
    organizer_name: makeConf(overrides.organizer_name ?? null, { needs_review: overrides.organizer_name == null }),
    organizer_names: [],
    description: makeConf(overrides.description ?? null, { needs_review: overrides.description == null }),
    is_free: makeConf(overrides.is_free ?? null, { needs_review: overrides.is_free == null }),
    price_range: makeConf(null, { needs_review: true }),
    website_url: makeConf(overrides.website_url ?? null, { needs_review: overrides.website_url == null }),
    facebook_url: makeConf(overrides.facebook_url ?? null, { needs_review: overrides.facebook_url == null }),
    instagram_url: makeConf(null, { needs_review: true }),
    ticket_url: makeConf(null, { needs_review: true }),
    contact: { phone: null, person: null },
    tags: [],
    program: null,
  };
}

function makeWeb(overrides = {}) {
  return {
    title: overrides.title ?? null,
    start_date: null,
    end_date: null,
    start_time: null,
    end_time: null,
    city: overrides.city ?? null,
    location_name: overrides.location_name ?? null,
    address: overrides.address ?? null,
    organizer_name: overrides.organizer_name ?? null,
    organizer_names: null,
    description: overrides.description ?? null,
    website_url: overrides.website_url ?? null,
    facebook_url: overrides.facebook_url ?? null,
    instagram_url: overrides.instagram_url ?? null,
    ticket_url: overrides.ticket_url ?? null,
    hero_image: null,
    is_free: overrides.is_free ?? null,
    category: overrides.category ?? null,
    tags: null,
    program: null,
  };
}

// --- fill-null behaviour ---

test("fills null city conf from web value", () => {
  const merged = mergeWebIntoPoster(makePoster({ city: null }), makeWeb({ city: "Варна" }));
  assert.equal(merged.city.value, "Варна");
  assert.equal(merged.city.needs_review, true);
});

test("fills null description from web", () => {
  const merged = mergeWebIntoPoster(makePoster({ description: null }), makeWeb({ description: "Три дни музика" }));
  assert.equal(merged.description.value, "Три дни музика");
  assert.equal(merged.description.needs_review, true);
});

test("fills null website_url from web", () => {
  const merged = mergeWebIntoPoster(makePoster(), makeWeb({ website_url: "https://fest.bg" }));
  assert.equal(merged.website_url.value, "https://fest.bg");
});

test("fills null facebook_url from web", () => {
  const merged = mergeWebIntoPoster(makePoster(), makeWeb({ facebook_url: "https://facebook.com/events/123/" }));
  assert.equal(merged.facebook_url.value, "https://facebook.com/events/123/");
});

test("fills null venue_name from web location_name", () => {
  const merged = mergeWebIntoPoster(makePoster(), makeWeb({ location_name: "Летен театър" }));
  assert.equal(merged.venue_name.value, "Летен театър");
});

test("fills null address from web address", () => {
  const merged = mergeWebIntoPoster(makePoster(), makeWeb({ address: "ул. Оборище 5" }));
  assert.equal(merged.address.value, "ул. Оборище 5");
});

test("fills null organizer_name from web", () => {
  const merged = mergeWebIntoPoster(makePoster(), makeWeb({ organizer_name: "Читалище Зора" }));
  assert.equal(merged.organizer_name.value, "Читалище Зора");
});

test("fills null is_free from web boolean", () => {
  const merged = mergeWebIntoPoster(makePoster({ is_free: null }), makeWeb({ is_free: true }));
  assert.equal(merged.is_free.value, true);
});

// --- poster-authoritative: do NOT overwrite ---

test("does not overwrite poster city that has a value", () => {
  const merged = mergeWebIntoPoster(makePoster({ city: "София" }), makeWeb({ city: "Варна" }));
  assert.equal(merged.city.value, "София");
});

test("does not overwrite poster description that has a value", () => {
  const merged = mergeWebIntoPoster(
    makePoster({ description: "Оригинал" }),
    makeWeb({ description: "Уеб версия" }),
  );
  assert.equal(merged.description.value, "Оригинал");
});

test("does not overwrite poster website_url that has a value", () => {
  const merged = mergeWebIntoPoster(
    makePoster({ website_url: "https://original.bg" }),
    makeWeb({ website_url: "https://other.bg" }),
  );
  assert.equal(merged.website_url.value, "https://original.bg");
});

// --- needs_review alone must not trigger an overwrite (poster data is authoritative) ---

test("does not overwrite a needs_review city that already has a poster value", () => {
  const poster = makePoster({ city: "София", cityNeedsReview: true });
  const merged = mergeWebIntoPoster(poster, makeWeb({ city: "Пловдив" }));
  assert.equal(merged.city.value, "София");
});

// --- web null stays null ---

test("when web city is null, poster null stays null", () => {
  const merged = mergeWebIntoPoster(makePoster({ city: null }), makeWeb({ city: null }));
  assert.equal(merged.city.value, null);
});

// --- dates and program are never touched ---

test("does not modify start_date from web", () => {
  const poster = makePoster();
  const merged = mergeWebIntoPoster(poster, makeWeb({ city: "Варна" }));
  assert.deepEqual(merged.start_date, poster.start_date);
});

test("does not modify program from web", () => {
  const poster = makePoster();
  const merged = mergeWebIntoPoster(poster, makeWeb({}));
  assert.equal(merged.program, null);
});

// --- other conf fields preserved ---

test("preserves poster title when set", () => {
  const merged = mergeWebIntoPoster(
    makePoster({ title: "Оригинален фест" }),
    makeWeb({ title: "Уеб заглавие" }),
  );
  assert.equal(merged.title.value, "Оригинален фест");
});

test("fills null title from web when poster title is null", () => {
  const poster = makePoster({ title: null, titleNeedsReview: true });
  poster.title.value = null;
  const merged = mergeWebIntoPoster(poster, makeWeb({ title: "Фест 2026" }));
  assert.equal(merged.title.value, "Фест 2026");
});
