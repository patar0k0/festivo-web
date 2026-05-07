import type { SupabaseClient } from "@supabase/supabase-js";

/** Cooldown: skipped rows are not re-selected until this many ms have passed. */
export const PENDING_REVIEW_SKIP_COOLDOWN_MS = 10 * 60 * 1000;

/**
 * Picks the next pending id using DB ordering (no in-memory sort):
 * ORDER BY confidence_score DESC NULLS LAST, COALESCE(source_count,0) DESC, created_at ASC
 * LIMIT 1, with optional id exclusions and last_reviewed_at cooldown (see migration).
 */
export async function fetchNextPendingReviewId(
  supabase: SupabaseClient,
  options: { excludeIds: string[] },
): Promise<string | null> {
  const cutoff = new Date(Date.now() - PENDING_REVIEW_SKIP_COOLDOWN_MS).toISOString();

  let q = supabase
    .from("pending_festivals")
    .select("id")
    .eq("status", "pending")
    .or(`last_reviewed_at.is.null,last_reviewed_at.lt.${cutoff}`)
    .order("confidence_score", { ascending: false, nullsFirst: false })
    .order("source_count", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: true, nullsFirst: false })
    .limit(1);

  for (const id of options.excludeIds) {
    if (id) q = q.neq("id", id);
  }

  const { data, error } = await q.maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.id) {
    return null;
  }

  return String(data.id);
}

export async function countPendingFestivals(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from("pending_festivals")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}
