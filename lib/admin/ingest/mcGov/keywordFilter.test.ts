import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesFestivalKeyword } from "./keywordFilter.js";

test("matches titles containing any festival-adjacent keyword", () => {
  assert.equal(matchesFestivalKeyword("Международен фолклорен фестивал"), true);
  assert.equal(matchesFestivalKeyword("Събор на читалището"), true);
  assert.equal(matchesFestivalKeyword("Великденски панаир на занаятите"), true);
  assert.equal(matchesFestivalKeyword("Карнавал на цветята"), true);
  assert.equal(matchesFestivalKeyword("Надпяване и надсвирване край реката"), true);
  assert.equal(matchesFestivalKeyword("Празник на гората"), true);
  assert.equal(matchesFestivalKeyword("Лятен джаз концерт"), true);
});

test("rejects titles with no festival-adjacent keyword", () => {
  assert.equal(matchesFestivalKeyword("Отбелязване на годишнина от рождението на Васил Левски"), false);
  assert.equal(matchesFestivalKeyword("130 години Народно читалище „Пробуда“"), false);
  assert.equal(matchesFestivalKeyword("Изложба на местни художници"), false);
});

test("is case-insensitive", () => {
  assert.equal(matchesFestivalKeyword("ФЕСТИВАЛ на изкуствата"), true);
});
