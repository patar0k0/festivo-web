import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeFacebookPostUrl } from "./normalizeFacebookPostUrl.mjs";

test("accepts a story.php link", () => {
  const result = normalizeFacebookPostUrl("https://m.facebook.com/story.php?story_fbid=pfbid0sr2L6LPzrCCwPziPgT98K6Ng7kAynUNbYGADpkTHrkFbaNfJxzHmjLCRfLEAnQx9l&id=100063998893885");
  assert.deepEqual(result, { value: "https://m.facebook.com/story.php?story_fbid=pfbid0sr2L6LPzrCCwPziPgT98K6Ng7kAynUNbYGADpkTHrkFbaNfJxzHmjLCRfLEAnQx9l&id=100063998893885" });
});

test("accepts a page post link", () => {
  const result = normalizeFacebookPostUrl("https://www.facebook.com/SomePage/posts/123456789/");
  assert.deepEqual(result, { value: "https://www.facebook.com/SomePage/posts/123456789" });
});

test("accepts a group post link", () => {
  const result = normalizeFacebookPostUrl("https://facebook.com/groups/987654/posts/123456/");
  assert.deepEqual(result, { value: "https://facebook.com/groups/987654/posts/123456" });
});

test("accepts a permalink link", () => {
  const result = normalizeFacebookPostUrl("https://facebook.com/permalink.php?story_fbid=1&id=2");
  assert.deepEqual(result, { value: "https://facebook.com/permalink.php?story_fbid=1&id=2" });
});

test("accepts a /share/p/ link (trailing pathname slash stripped, query kept)", () => {
  const result = normalizeFacebookPostUrl("https://www.facebook.com/share/p/1EpdXpLVQz/?mibextid=wwXIfr");
  assert.deepEqual(result, { value: "https://www.facebook.com/share/p/1EpdXpLVQz?mibextid=wwXIfr" });
});

test("rejects an event link", () => {
  const result = normalizeFacebookPostUrl("https://facebook.com/events/123/");
  assert.deepEqual(result, { error: "URL must be a facebook.com post, permalink, or story link." });
});

test("rejects a non-facebook URL", () => {
  const result = normalizeFacebookPostUrl("https://example.com/posts/1");
  assert.deepEqual(result, { error: "URL must be a facebook.com post, permalink, or story link." });
});

test("rejects an invalid URL", () => {
  assert.deepEqual(normalizeFacebookPostUrl("not a url"), { error: "Invalid URL." });
});
