import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveEventYear, bgWeekdayToIndex } from "./resolveMissingYear.mjs";

const TODAY = new Date("2026-06-17T00:00:00Z"); // Wednesday

test("explicit year is returned untouched, not inferred", () => {
  const r = resolveEventYear({ day: 4, month: 7, explicitYear: 2026, today: TODAY });
  assert.equal(r.year, 2026);
  assert.equal(r.inferred, false);
});

test("weekday cross-check uniquely resolves the year (20 June, събота → 2026)", () => {
  const r = resolveEventYear({ day: 20, month: 6, weekday: "събота", today: TODAY });
  assert.equal(r.year, 2026);
  assert.equal(r.inferred, true);
  assert.equal(r.weekdayMatched, true);
});

test("no weekday: picks the nearest future occurrence (29 Aug → this year)", () => {
  const r = resolveEventYear({ day: 29, month: 8, today: TODAY });
  assert.equal(r.year, 2026);
  assert.equal(r.inferred, true);
});

test("no weekday, date already passed this year → next year (1 Jan → 2027)", () => {
  const r = resolveEventYear({ day: 1, month: 1, today: TODAY });
  assert.equal(r.year, 2027);
});

test("bgWeekdayToIndex maps Bulgarian names to JS getUTCDay", () => {
  assert.equal(bgWeekdayToIndex("неделя"), 0);
  assert.equal(bgWeekdayToIndex("събота"), 6);
  assert.equal(bgWeekdayToIndex("сряда"), 3);
  assert.equal(bgWeekdayToIndex("nonsense"), null);
});
