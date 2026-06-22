import { test } from "node:test";
import assert from "node:assert/strict";
import { applyPosterProcessResult } from "./applyProcessResult";
import type { ProcessResult } from "./processPosterJob";

function fakeSupabase() {
  return {
    from() {
      return {
        update() {
          return this;
        },
        eq: async () => ({ data: null }),
      };
    },
  } as never;
}

test("duplicate with heroUrl -> sendPhoto", async () => {
  const calls: { method: string; payload: unknown }[] = [];
  const tg = async (method: string, payload: unknown) => {
    calls.push({ method, payload });
  };
  const result: ProcessResult = {
    kind: "duplicate",
    matches: [{ title: "Test Fest", href: "/festivals/test", score: 0.9 } as never],
    extraction: {} as never,
    heroUrl: "https://example.com/hero.jpg",
    title: "Test Fest",
  };

  await applyPosterProcessResult(fakeSupabase(), tg, "https://festivo.bg", 123, "job1", result);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "sendPhoto");
  assert.equal((calls[0].payload as { photo: string }).photo, "https://example.com/hero.jpg");
});

test("duplicate with no heroUrl (text-only post) -> sendMessage, not sendPhoto", async () => {
  const calls: { method: string; payload: unknown }[] = [];
  const tg = async (method: string, payload: unknown) => {
    calls.push({ method, payload });
  };
  const result: ProcessResult = {
    kind: "duplicate",
    matches: [{ title: "Test Fest", href: "/festivals/test", score: 0.9 } as never],
    extraction: {} as never,
    heroUrl: null,
    title: "Test Fest",
  };

  await applyPosterProcessResult(fakeSupabase(), tg, "https://festivo.bg", 123, "job1", result);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "sendMessage");
  assert.match((calls[0].payload as { text: string }).text, /Test Fest/);
});
