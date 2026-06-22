import type { SupabaseClient } from "@supabase/supabase-js";

export type ExistingJobDecision =
  | { action: "still_processing" }
  | { action: "already_done"; pendingId: string | null; rejected: boolean }
  | { action: "proceed" };

export type ExistingJobCheck = { existingId: string | null; decision: ExistingJobDecision };

// Longer than maxDuration=300s on the webhook/job routes — a "processing"
// row past this is a dead invocation (crash/timeout), not a live one.
const STALE_PROCESSING_MS = 6 * 60 * 1000;

/** Looks up a poster_ingest_jobs row by dedupe_key and decides what the caller should do. */
export async function checkExistingPosterJob(supabase: SupabaseClient, dedupeKey: string): Promise<ExistingJobCheck> {
  const { data: existing } = await supabase
    .from("poster_ingest_jobs")
    .select("id,status,pending_festival_id,updated_at")
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();

  if (!existing) return { existingId: null, decision: { action: "proceed" } };

  const existingId = String(existing.id);
  const isStale = existing.updated_at ? Date.now() - new Date(existing.updated_at).getTime() > STALE_PROCESSING_MS : true;

  if (existing.status === "processing" && !isStale) {
    return { existingId, decision: { action: "still_processing" } };
  }

  if (existing.status === "done") {
    let rejected = false;
    if (existing.pending_festival_id) {
      const { data: pf } = await supabase
        .from("pending_festivals")
        .select("status")
        .eq("id", existing.pending_festival_id)
        .maybeSingle();
      rejected = pf?.status === "rejected";
    }
    return { existingId, decision: { action: "already_done", pendingId: existing.pending_festival_id ?? null, rejected } };
  }

  return { existingId, decision: { action: "proceed" } };
}
