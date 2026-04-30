import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MAX_USER_SWEEP_ATTEMPTS,
  sweepRetryDelayMsAfterFailure,
  sweepRetryLongDeferMs,
} from "@/lib/admin/sweepRetryBackoff";
import { tryRecoverOrphanSweepQueueUser } from "@/lib/admin/sweepQueueOrphanRecover";

/**
 * Durable sweep retry queue (survives auth.users delete + CASCADE on public.users).
 */
export async function enqueueUserSweepRetry(admin: SupabaseClient, userId: string): Promise<void> {
  const nowIso = new Date().toISOString();
  const { error } = await admin.from("user_sweep_retry_queue").upsert(
    {
      user_id: userId,
      enqueued_at: nowIso,
      attempts: 0,
      next_retry_at: nowIso,
      locked_until: null,
    },
    { onConflict: "user_id" },
  );
  if (error) {
    throw new Error(`user_sweep_retry_queue: ${error.message}`);
  }
}

export async function clearUserSweepRetryQueue(admin: SupabaseClient, userId: string): Promise<void> {
  const { error } = await admin.from("user_sweep_retry_queue").delete().eq("user_id", userId);
  if (error) {
    console.error("[userSweepRetryQueue] clear queue failed", { userId, message: error.message });
  }
}

/**
 * When aborting after enqueue (e.g. auth delete failed): drop queue row and cleanup_pending.
 */
export async function clearUserSweepTracking(admin: SupabaseClient, userId: string): Promise<void> {
  await clearUserSweepRetryQueue(admin, userId);
  const { error } = await admin.from("users").update({ cleanup_pending: false }).eq("id", userId);
  if (error) {
    console.error("[userSweepRetryQueue] clear cleanup_pending failed", { userId, message: error.message });
  }
}

export async function markUserCleanupPending(admin: SupabaseClient, userId: string): Promise<void> {
  const { data: row, error: readErr } = await admin.from("users").select("id").eq("id", userId).maybeSingle();
  if (readErr) {
    throw new Error(`users: ${readErr.message}`);
  }
  if (row) {
    const { error } = await admin.from("users").update({ cleanup_pending: true }).eq("id", userId);
    if (error) {
      throw new Error(`users cleanup_pending: ${error.message}`);
    }
  }
}

export async function isUserInSweepRetryQueue(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("user_sweep_retry_queue")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[userSweepRetryQueue] lookup failed", { userId, message: error.message });
    return false;
  }
  return Boolean(data);
}

export type ClaimedSweepRetryRow = { user_id: string; attempts: number };

/**
 * Atomically claims due rows with FOR UPDATE SKIP LOCKED (via RPC) and sets a short lease.
 */
export async function claimUserSweepRetryBatch(
  admin: SupabaseClient,
  limit: number,
): Promise<ClaimedSweepRetryRow[]> {
  const { data, error } = await admin.rpc("admin_claim_user_sweep_retry_batch", { p_limit: limit });
  if (error) {
    throw new Error(`admin_claim_user_sweep_retry_batch: ${error.message}`);
  }
  const rows = (data ?? []) as Array<{ user_id: string; attempts: number }>;
  return rows.map((r) => ({ user_id: r.user_id, attempts: Number(r.attempts) || 0 }));
}

/**
 * After a failed sweep in the cron worker: backoff, orphan recovery at max attempts, or long defer.
 */
export async function recordUserSweepRetryFailure(
  admin: SupabaseClient,
  userId: string,
  attemptsBeforeRun: number,
): Promise<void> {
  const reachedMax = attemptsBeforeRun + 1 >= MAX_USER_SWEEP_ATTEMPTS;
  const nextAttempts = reachedMax ? MAX_USER_SWEEP_ATTEMPTS : attemptsBeforeRun + 1;

  if (reachedMax) {
    const recovered = await tryRecoverOrphanSweepQueueUser(admin, userId);
    if (recovered) {
      return;
    }
    const deferIso = new Date(Date.now() + sweepRetryLongDeferMs()).toISOString();
    const { error } = await admin
      .from("user_sweep_retry_queue")
      .update({
        attempts: nextAttempts,
        next_retry_at: deferIso,
        locked_until: null,
      })
      .eq("user_id", userId);
    if (error) {
      console.error("[userSweepRetryQueue] record failure (max attempts, defer)", {
        userId,
        message: error.message,
      });
    }
    console.error("[userSweepRetryQueue] sweep still failing after max attempts; deferred", {
      userId,
      attempts: nextAttempts,
      next_retry_at: deferIso,
    });
    return;
  }

  const delayMs = sweepRetryDelayMsAfterFailure(nextAttempts);
  if (delayMs == null) {
    return;
  }
  const nextIso = new Date(Date.now() + delayMs).toISOString();
  const { error } = await admin
    .from("user_sweep_retry_queue")
    .update({
      attempts: nextAttempts,
      next_retry_at: nextIso,
      locked_until: null,
    })
    .eq("user_id", userId);
  if (error) {
    console.error("[userSweepRetryQueue] record failure (backoff)", { userId, message: error.message });
  }
}
