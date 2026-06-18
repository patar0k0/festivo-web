/**
 * Additive enrichment: poster data is authoritative.
 * Web fills only fields where poster has value===null OR needs_review===true.
 * Dates and program are never modified (structural poster data).
 */

/**
 * @param {{ value: unknown, confidence: number, needs_review: boolean }} conf
 * @param {unknown} webValue
 * @returns {{ value: unknown, confidence: number, needs_review: boolean }}
 */
function fillConf(conf, webValue) {
  if (webValue == null) return conf;
  const needsFill = conf.value == null || conf.needs_review === true;
  if (!needsFill) return conf;
  return { value: webValue, confidence: 0.5, needs_review: true };
}

/**
 * Merges web extraction results into a poster extraction.
 * @param {import("./posterExtractionSchema.js").PosterExtraction} poster
 * @param {import("../research/gemini-extract.js").GeminiRawExtraction} web
 * @returns {import("./posterExtractionSchema.js").PosterExtraction}
 */
export function mergeWebIntoPoster(poster, web) {
  return {
    ...poster,
    title: fillConf(poster.title, web.title),
    category: fillConf(poster.category, web.category),
    city: fillConf(poster.city, web.city),
    venue_name: fillConf(poster.venue_name, web.location_name),
    address: fillConf(poster.address, web.address),
    organizer_name: fillConf(poster.organizer_name, web.organizer_name),
    description: fillConf(poster.description, web.description),
    is_free: fillConf(poster.is_free, web.is_free),
    website_url: fillConf(poster.website_url, web.website_url),
    facebook_url: fillConf(poster.facebook_url, web.facebook_url),
    instagram_url: fillConf(poster.instagram_url, web.instagram_url),
    ticket_url: fillConf(poster.ticket_url, web.ticket_url),
    // start_date, end_date, other_dates, program: never touched
  };
}
