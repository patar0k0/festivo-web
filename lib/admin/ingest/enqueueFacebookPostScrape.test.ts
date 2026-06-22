import { test } from "node:test";
import assert from "node:assert/strict";
import { enqueueFacebookPostScrape } from "./enqueueFacebookPostScrape";

function fakeSupabase(opts: { existingPosterJob?: unknown; insertIngestJobError?: { code?: string; message: string } }) {
  return {
    from(table: string) {
      if (table === "poster_ingest_jobs") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle: async () => ({ data: opts.existingPosterJob ?? null }),
          upsert() {
            return this;
          },
          single: async () => ({ data: { id: "job-1" } }),
        };
      }
      if (table === "ingest_jobs") {
        return {
          insert: async () => ({ error: opts.insertIngestJobError ?? null }),
        };
      }
      if (table === "pending_festivals") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle: async () => ({ data: { status: "needs_review" } }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as never;
}

test("rejects a non-post URL", async () => {
  const result = await enqueueFacebookPostScrape(fakeSupabase({}), "https://facebook.com/events/1/", {
    telegramChatId: 10,
    telegramUserId: 20,
  });
  assert.deepEqual(result, { ok: false, kind: "error", error: "URL must be a facebook.com post, permalink, or story link.", status: 400 });
});

test("queues a new post link", async () => {
  const result = await enqueueFacebookPostScrape(fakeSupabase({}), "https://facebook.com/SomePage/posts/1", {
    telegramChatId: 10,
    telegramUserId: 20,
  });
  assert.deepEqual(result, { ok: true, kind: "queued" });
});

test("a still-processing duplicate submission reports already_queued", async () => {
  const result = await enqueueFacebookPostScrape(
    fakeSupabase({ existingPosterJob: { id: "j1", status: "processing", pending_festival_id: null, updated_at: new Date().toISOString() } }),
    "https://facebook.com/SomePage/posts/1",
    { telegramChatId: 10, telegramUserId: 20 },
  );
  assert.deepEqual(result, { ok: true, kind: "already_queued" });
});

test("a done duplicate submission reports duplicate_warning with a link", async () => {
  const result = await enqueueFacebookPostScrape(
    fakeSupabase({ existingPosterJob: { id: "j1", status: "done", pending_festival_id: "p1", updated_at: new Date().toISOString() } }),
    "https://facebook.com/SomePage/posts/1",
    { telegramChatId: 10, telegramUserId: 20 },
  );
  assert.deepEqual(result, { ok: true, kind: "duplicate_warning", jobId: "j1", status: "done", existing: { type: "pending", id: "p1" } });
});

test("a unique-constraint clash on ingest_jobs.source_url reports already_queued", async () => {
  const result = await enqueueFacebookPostScrape(
    fakeSupabase({ insertIngestJobError: { code: "23505", message: "duplicate key" } }),
    "https://facebook.com/SomePage/posts/1",
    { telegramChatId: 10, telegramUserId: 20 },
  );
  assert.deepEqual(result, { ok: true, kind: "already_queued" });
});
