import { test } from "node:test";
import assert from "node:assert/strict";
import { pickDuplicateWithDateGuard } from "./dedupDateGuard.js";
import type { DuplicateMatch } from "@/lib/admin/research/findDuplicateFestivals";

function makeMatch(overrides: Partial<DuplicateMatch> = {}): DuplicateMatch {
  return {
    id: "match-1",
    title: "Събор на Пудрия",
    table: "festival",
    href: "/admin/festivals/match-1",
    start_date: "2026-07-12",
    status: "verified",
    score: 0.5,
    same_year: true,
    ...overrides,
  };
}

test("does NOT flag two different village fairs sharing template words but different dates", () => {
  // Real scenario discussed during design: "Събор на Краводер" vs "Събор на
  // Пудрия" share the generic word "събор" and can cross the title-score
  // threshold, but they happen on different days in different villages.
  const matches = [makeMatch({ title: "Събор на Пудрия", start_date: "2026-08-20" })];
  const result = pickDuplicateWithDateGuard(matches, "2026-07-12");
  assert.equal(result, null);
});

test("flags a match when start_date is exactly equal", () => {
  const matches = [makeMatch({ start_date: "2026-07-12" })];
  const result = pickDuplicateWithDateGuard(matches, "2026-07-12");
  assert.equal(result?.id, "match-1");
});

test("flags a match when start_date is within 2 days", () => {
  const matches = [makeMatch({ start_date: "2026-07-14" })];
  const result = pickDuplicateWithDateGuard(matches, "2026-07-12");
  assert.equal(result?.id, "match-1");
});

test("does not flag a match when start_date is more than 2 days apart", () => {
  const matches = [makeMatch({ start_date: "2026-07-15" })];
  const result = pickDuplicateWithDateGuard(matches, "2026-07-12");
  assert.equal(result, null);
});

test("returns null when the scraped event has no start_date", () => {
  const matches = [makeMatch({ start_date: "2026-07-12" })];
  const result = pickDuplicateWithDateGuard(matches, null);
  assert.equal(result, null);
});

test("skips candidates with no start_date and falls through to a later one that matches", () => {
  const matches = [
    makeMatch({ id: "no-date", start_date: null }),
    makeMatch({ id: "dated", start_date: "2026-07-12" }),
  ];
  const result = pickDuplicateWithDateGuard(matches, "2026-07-12");
  assert.equal(result?.id, "dated");
});
