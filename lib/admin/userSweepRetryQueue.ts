import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MAX_USER_SWEEP_ATTEMPTS,
  sweepRetryDelayMsAfterFailure,
  sweepRetryLongDeferMs,
} from "@/lib/admin/sweepRetryBackoff";
import { invalidateCachedUserGateSafe } from "@/lib/middlewareUserGateCache";
import { tryRecoverOrphanSweepQueueUser } from "@/lib/admin/sweepQueueOrphanRecover";

/**
 * Durable sweep retry queue (survives auth.users delete + CASCADE on public.users).
 */
export async function enqueueUserSweepRetry(
  admin: SupabaseClient,
  userId: string,
  options?: { seenInAuthBefore?: boolean },
): Promise<void> {
  const nowIso = new Date().toISOString();
  const seenInAuthBeforeRequested = Boolean(options?.seenInAuthBefore);
  let seenInAuthBefore = seenInAuthBeforeRequested;
  const { data: existingRow, error: existingReadError } = await admin
    .from("user_sweep_retry_queue")
    .select("seen_in_auth_before")
    .eq("user_id", userId)
    .maybeSingle();
  if (existingReadError) {
    throw new Error(`user_sweep_retry_queue read: ${existingReadError.message}`);
  }
  if (existingRow?.seen_in_auth_before) {
    seenInAuthBefore = true;
  }
  const { error } = await admin.from("user_sweep_retry_queue").upsert(
    {
      user_id: userId,
      enqueued_at: nowIso,
      attempts: 0,
      next_retry_at: nowIso,
      locked_until: null,
      seen_in_auth_before: seenInAuthBefore,
    },
    { onConflict: "user_id" },
  );
  if (error) {
    throw new Error(`user_sweep_retry_queue: ${error.message}`);
  }
}

export type UserSweepRetryQueueStats = {
  pending: number;
  retrying: number;
  failedMaxAttempts: number;
};

export async function getUserSweepRetryQueueStats(
  admin: SupabaseClient,
): Promise<UserSweepRetryQueueStats> {
  const nowIso = new Date().toISOString();
  const { count: pendingCount, error: pendingError } = await admin
    .from("user_sweep_retry_queue")
    .select("user_id", { count: "exact", head: true })
    .lte("next_retry_at", nowIso);
  if (pendingError) {
    throw new Error(`user_sweep_retry_queue stats pending: ${pendingError.message}`);
  }

  const { count: retryingCount, error: retryingError } = await admin
    .from("user_sweep_retry_queue")
    .select("user_id", { count: "exact", head: true })
    .gt("attempts", 0)
    .lt("attempts", MAX_USER_SWEEP_ATTEMPTS);
  if (retryingError) {
    throw new Error(`user_sweep_retry_queue stats retrying: ${retryingError.message}`);
  }

  const { count: failedCount, error: failedError } = await admin
    .from("user_sweep_retry_queue")
    .select("user_id", { count: "exact", head: true })
    .gte("attempts", MAX_USER_SWEEP_ATTEMPTS);
  if (failedError) {
    throw new Error(`user_sweep_retry_queue stats failed: ${failedError.message}`);
  }

  return {
    pending: pendingCount ?? 0,
    retrying: retryingCount ?? 0,
    failedMaxAttempts: failedCount ?? 0,
  };
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
  invalidateCachedUserGateSafe(userId, "clearUserSweepTracking");
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

export type ClaimedSweepRetryRow = { user_id: string; attempts: number; seen_in_auth_before: boolean };

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
  const rows = (data ?? []) as Array<{ user_id: string; attempts: number; seen_in_auth_before?: boolean | null }>;
  return rows.map((r) => ({
    user_id: r.user_id,
    attempts: Number(r.attempts) || 0,
    seen_in_auth_before: Boolean(r.seen_in_auth_before),
  }));
}

/**
 * After a failed sweep in the cron worker: backoff, orphan recovery at max attempts, or long defer.
 */
export async function recordUserSweepRetryFailure(
  admin: SupabaseClient,
  userId: string,
  attemptsBeforeRun: number,
  seenInAuthBefore: boolean,
): Promise<void> {
  const reachedMax = attemptsBeforeRun + 1 >= MAX_USER_SWEEP_ATTEMPTS;
  const nextAttempts = reachedMax ? MAX_USER_SWEEP_ATTEMPTS : attemptsBeforeRun + 1;

  if (reachedMax) {
    if (!seenInAuthBefore) {
      console.warn("[userSweepRetryQueue] dropping queue row never seen in auth", { userId });
      await clearUserSweepTracking(admin, userId);
      return;
    }

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
