import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseMcGovListPage } from "./parseListPage.js";

function loadFixture(): string {
  return readFileSync(
    path.join(import.meta.dirname, "__fixtures__/sample-list-page.html"),
    "utf-8",
  );
}

test("parses both card templates from a real fixture page", () => {
  const events = parseMcGovListPage(loadFixture());
  assert.equal(events.length, 2);

  const [first, second] = events;

  assert.equal(first.postId, "8093613");
  assert.equal(first.title, "Еньов ден – битов ритуал – Секретар, библиотекари");
  assert.equal(first.startDate, "2026-06-24");
  assert.equal(first.endDate, "2026-06-24");
  assert.equal(first.locationName, "с. Гара Орешец, община Димово");
  assert.equal(first.organizerName, "Секретар, библиотекари");
  assert.equal(first.sourceUrl, "https://mc.government.bg/?p=8093613");

  assert.equal(second.postId, "9100201");
  assert.equal(
    second.title,
    'Фолклорен събор на етносите „Пее ми се, играе ми се“ – Народно читалище „Мито Марков-1912 г.“',
  );
  assert.equal(second.startDate, "2026-07-12");
  assert.equal(second.endDate, "2026-07-12");
  assert.equal(second.locationName, "Салона на читалището, село Макреш, община Макреш");
  assert.equal(second.organizerName, 'Народно читалище „Мито Марков-1912 г.“');
  assert.equal(second.sourceUrl, "https://mc.government.bg/?p=9100201");
});

test("returns an empty array for a page with no event cards", () => {
  const events = parseMcGovListPage("<html><body>no events here</body></html>");
  assert.deepEqual(events, []);
});
