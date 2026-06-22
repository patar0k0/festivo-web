import { test } from "node:test";
import assert from "node:assert/strict";
import { checkExistingPosterJob } from "./posterJobIdempotency";

function fakeSupabase(rows: { poster_ingest_jobs?: unknown; pending_festivals?: unknown }) {
  return {
    from(table: string) {
      const row = table === "poster_ingest_jobs" ? rows.poster_ingest_jobs : rows.pending_festivals;
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        maybeSingle: async () => ({ data: row ?? null }),
      };
    },
  } as never;
}

test("no existing row -> proceed", async () => {
  const result = await checkExistingPosterJob(fakeSupabase({}), "key1");
  assert.deepEqual(result, { existingId: null, decision: { action: "proceed" } });
});

test("recent processing row -> still_processing", async () => {
  const result = await checkExistingPosterJob(
    fakeSupabase({ poster_ingest_jobs: { id: "j1", status: "processing", pending_festival_id: null, updated_at: new Date().toISOString() } }),
    "key1",
  );
  assert.equal(result.existingId, "j1");
  assert.deepEqual(result.decision, { action: "still_processing" });
});

test("stale processing row (>6 min old) -> proceed", async () => {
  const staleIso = new Date(Date.now() - 7 * 60 * 1000).toISOString();
  const result = await checkExistingPosterJob(
    fakeSupabase({ poster_ingest_jobs: { id: "j1", status: "processing", pending_festival_id: null, updated_at: staleIso } }),
    "key1",
  );
  assert.deepEqual(result.decision, { action: "proceed" });
});

test("done row with accepted pending festival -> already_done, not rejected", async () => {
  const result = await checkExistingPosterJob(
    fakeSupabase({
      poster_ingest_jobs: { id: "j1", status: "done", pending_festival_id: "p1", updated_at: new Date().toISOString() },
      pending_festivals: { status: "needs_review" },
    }),
    "key1",
  );
  assert.deepEqual(result, { existingId: "j1", decision: { action: "already_done", pendingId: "p1", rejected: false } });
});

test("done row with rejected pending festival -> already_done, rejected", async () => {
  const result = await checkExistingPosterJob(
    fakeSupabase({
      poster_ingest_jobs: { id: "j1", status: "done", pending_festival_id: "p1", updated_at: new Date().toISOString() },
      pending_festivals: { status: "rejected" },
    }),
    "key1",
  );
  assert.deepEqual(result, { existingId: "j1", decision: { action: "already_done", pendingId: "p1", rejected: true } });
});

test("any other status (e.g. error, cancelled) -> proceed", async () => {
  const result = await checkExistingPosterJob(
    fakeSupabase({ poster_ingest_jobs: { id: "j1", status: "error", pending_festival_id: null, updated_at: new Date().toISOString() } }),
    "key1",
  );
  assert.deepEqual(result, { existingId: "j1", decision: { action: "proceed" } });
});
