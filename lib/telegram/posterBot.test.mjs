import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyWebhookSecret, mapPosterUpdate, buildPosterDedupeKey } from "./posterBot.mjs";

test("verifyWebhookSecret matches only when equal and non-empty", () => {
  assert.equal(verifyWebhookSecret("abc", "abc"), true);
  assert.equal(verifyWebhookSecret("abc", "xyz"), false);
  assert.equal(verifyWebhookSecret("", ""), false);
  assert.equal(verifyWebhookSecret(null, undefined), false);
});

test("maps a photo message to a 'photo' action with the largest photo", () => {
  const action = mapPosterUpdate({
    message: {
      chat: { id: 10 },
      from: { id: 20 },
      caption: "доп. инфо",
      photo: [
        { file_id: "small", file_unique_id: "us", width: 90 },
        { file_id: "big", file_unique_id: "ub", width: 1280 },
      ],
    },
  });
  assert.deepEqual(action, {
    kind: "photo",
    chatId: 10,
    userId: 20,
    fileId: "big",
    fileUniqueId: "ub",
    caption: "доп. инфо",
  });
});

test("maps a duplicate-confirm callback", () => {
  const action = mapPosterUpdate({
    callback_query: { id: "cb1", from: { id: 20 }, message: { chat: { id: 10 } }, data: "poster:JOB:create" },
  });
  assert.deepEqual(action, {
    kind: "dup-decision",
    chatId: 10,
    userId: 20,
    callbackQueryId: "cb1",
    jobId: "JOB",
    decision: "create",
  });
});

test("ignores non-photo text and unknown updates", () => {
  assert.equal(mapPosterUpdate({ message: { chat: { id: 1 }, from: { id: 2 }, text: "здрасти" } }).kind, "ignore");
  assert.equal(mapPosterUpdate({}).kind, "ignore");
});

test("dedupe key is stable and 32 hex chars", () => {
  const k1 = buildPosterDedupeKey(10, "ub");
  const k2 = buildPosterDedupeKey(10, "ub");
  assert.equal(k1, k2);
  assert.match(k1, /^[0-9a-f]{32}$/);
});
