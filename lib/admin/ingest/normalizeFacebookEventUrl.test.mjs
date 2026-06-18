import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeFacebookEventUrl } from "./normalizeFacebookEventUrl.mjs";

test("valid event url: forces https, strips hash + trailing slash", () => {
  const r = normalizeFacebookEventUrl("http://www.facebook.com/events/1234567890/#x");
  assert.deepEqual(r, { value: "https://www.facebook.com/events/1234567890" });
});

test("keeps the query string", () => {
  const r = normalizeFacebookEventUrl("https://facebook.com/events/999999/?ref=a");
  assert.deepEqual(r, { value: "https://facebook.com/events/999999?ref=a" });
});

test("trims surrounding whitespace", () => {
  const r = normalizeFacebookEventUrl("  https://facebook.com/events/555/  ");
  assert.deepEqual(r, { value: "https://facebook.com/events/555" });
});

test("rejects non-facebook host", () => {
  assert.equal("error" in normalizeFacebookEventUrl("https://example.com/events/123"), true);
});

test("rejects facebook url without /events/", () => {
  assert.equal("error" in normalizeFacebookEventUrl("https://facebook.com/somepage"), true);
});

test("rejects non-http protocol", () => {
  assert.equal("error" in normalizeFacebookEventUrl("ftp://facebook.com/events/123"), true);
});

test("rejects malformed url", () => {
  assert.equal("error" in normalizeFacebookEventUrl("not a url"), true);
});
