import { test } from "node:test";
import assert from "node:assert/strict";
import { isoFromComponents, programToGeminiShape, contactNote } from "./buildPosterPendingRow.mjs";

test("isoFromComponents resolves explicit and inferred years", () => {
  assert.equal(isoFromComponents({ day: 4, month: 7, year: 2026, year_explicit: true, weekday: null }, new Date("2026-06-17T00:00:00Z")), "2026-07-04");
  // 20 June, събота → 2026
  assert.equal(isoFromComponents({ day: 20, month: 6, year: null, year_explicit: false, weekday: "събота" }, new Date("2026-06-17T00:00:00Z")), "2026-06-20");
  assert.equal(isoFromComponents({ day: null, month: null, year: null, year_explicit: false, weekday: null }, new Date()), null);
});

test("programToGeminiShape assigns the festival year to dateless program days", () => {
  const shape = programToGeminiShape({ days: [{ day: 26, month: 6, title: "Петък", items: [{ title: "Откриване", start_time: "17:00", end_time: null, stage: null, description: null }] }] }, 2026);
  assert.deepEqual(shape, {
    days: [{ date: "2026-06-26", title: "Петък", items: [{ title: "Откриване", start_time: "17:00", end_time: null, stage: null, description: null }] }],
  });
});

test("contactNote formats phone + person, or empty", () => {
  assert.equal(contactNote({ phone: "089 837 0588", person: "Николета Деведжиева" }), "За информация: Николета Деведжиева, 089 837 0588");
  assert.equal(contactNote({ phone: null, person: null }), "");
});
