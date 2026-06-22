import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyWebhookSecret, mapPosterUpdate, buildPosterDedupeKey, buildPosterUrlDedupeKey, extractUrlsFromMessage, formatUrlResultLine } from "./posterBot.mjs";

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
    dupId: null,
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

test("buildPosterUrlDedupeKey is stable, 32 hex chars, and differs from the photo dedupe key for the same chat", () => {
  const k1 = buildPosterUrlDedupeKey(10, "https://facebook.com/SomePage/posts/1");
  const k2 = buildPosterUrlDedupeKey(10, "https://facebook.com/SomePage/posts/1");
  assert.equal(k1, k2);
  assert.match(k1, /^[0-9a-f]{32}$/);
  assert.notEqual(k1, buildPosterDedupeKey(10, "https://facebook.com/SomePage/posts/1"));
});

import { formatInserted, formatDuplicate, dupKeyboard } from "./posterBot.mjs";

test("formatInserted shows the admin link and review note", () => {
  const msg = formatInserted({ pendingId: "abc", title: "Фестивал X", needsReview: true, baseUrl: "https://festivo.bg" });
  assert.match(msg, /Фестивал X/);
  assert.match(msg, /https:\/\/festivo\.bg\/admin\/pending-festivals\/abc/);
  assert.match(msg, /преглед/i);
});

test("dupKeyboard builds create/discard callback buttons for the job", () => {
  const kb = dupKeyboard("JOB1");
  assert.deepEqual(kb.inline_keyboard[0][0].callback_data, "poster:JOB1:create");
  assert.deepEqual(kb.inline_keyboard[0][1].callback_data, "poster:JOB1:discard");
});

test("formatDuplicate lists the matched titles", () => {
  const msg = formatDuplicate([{ title: "Фестивал X 2026", href: "/admin/festivals/1" }], "https://festivo.bg");
  assert.match(msg, /Възможен дубликат/);
  assert.match(msg, /Фестивал X 2026/);
});

test("extractUrlsFromMessage pulls a plain http(s) link from text", () => {
  const urls = extractUrlsFromMessage({ text: "виж това https://www.facebook.com/events/123456/ супер" });
  assert.deepEqual(urls, ["https://www.facebook.com/events/123456/"]);
});

test("extractUrlsFromMessage reads text_link entities and dedupes", () => {
  const urls = extractUrlsFromMessage({
    text: "клик тук и https://facebook.com/events/999/",
    entities: [{ type: "text_link", url: "https://facebook.com/events/999/" }],
  });
  assert.deepEqual(urls, ["https://facebook.com/events/999/"]);
});

test("extractUrlsFromMessage strips trailing punctuation", () => {
  const urls = extractUrlsFromMessage({ text: "(https://facebook.com/events/1/)." });
  assert.deepEqual(urls, ["https://facebook.com/events/1/"]);
});

test("mapPosterUpdate maps a text message with a URL to a url action", () => {
  const action = mapPosterUpdate({
    message: { chat: { id: 10 }, from: { id: 20 }, text: "https://facebook.com/events/123/" },
  });
  assert.deepEqual(action, {
    kind: "url",
    chatId: 10,
    userId: 20,
    url: "https://facebook.com/events/123/",
    urls: ["https://facebook.com/events/123/"],
  });
});

test("mapPosterUpdate: a photo with a link in the caption is still a photo", () => {
  const action = mapPosterUpdate({
    message: {
      chat: { id: 1 },
      from: { id: 2 },
      caption: "https://facebook.com/events/5/",
      photo: [{ file_id: "big", file_unique_id: "ub", width: 1280 }],
    },
  });
  assert.equal(action.kind, "photo");
});

test("mapPosterUpdate still ignores plain text without a URL", () => {
  assert.equal(mapPosterUpdate({ message: { chat: { id: 1 }, from: { id: 2 }, text: "здрасти" } }).kind, "ignore");
});

test("formatUrlResultLine: queued", () => {
  const line = formatUrlResultLine("https://facebook.com/events/1/", { ok: true, kind: "queued" }, "https://festivo.bg");
  assert.match(line, /✅/);
  assert.match(line, /опашк/i);
});

test("formatUrlResultLine: already_queued", () => {
  const line = formatUrlResultLine("https://facebook.com/events/1/", { ok: true, kind: "already_queued" }, "https://festivo.bg");
  assert.match(line, /ℹ️/);
});

test("formatUrlResultLine: duplicate_warning links to the existing record", () => {
  const line = formatUrlResultLine(
    "https://facebook.com/events/1/",
    { ok: true, kind: "duplicate_warning", jobId: "j", status: "pending", existing: { type: "published", id: "fid" } },
    "https://festivo.bg",
  );
  assert.match(line, /⚠️/);
  assert.match(line, /https:\/\/festivo\.bg\/admin\/festivals\/fid/);
});

test("formatUrlResultLine: error shows the message", () => {
  const line = formatUrlResultLine(
    "https://example.com/x",
    { ok: false, kind: "error", error: "URL must contain facebook.com/events/.", status: 400 },
    "https://festivo.bg",
  );
  assert.match(line, /❌/);
  assert.match(line, /facebook\.com\/events/);
});
