import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Durable sweep retry queue (survives auth.users delete + CASCADE on public.users).
 */
export async function enqueueUserSweepRetry(admin: SupabaseClient, userId: string): Promise<void> {
  const { error } = await admin.from("user_sweep_retry_queue").upsert(
    { user_id: userId, enqueued_at: new Date().toISOString() },
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

export async function listUserSweepRetryBatch(
  admin: SupabaseClient,
  limit: number,
): Promise<string[]> {
  const { data, error } = await admin
    .from("user_sweep_retry_queue")
    .select("user_id")
    .order("enqueued_at", { ascending: true })
    .limit(limit);
  if (error) {
    throw new Error(`user_sweep_retry_queue list: ${error.message}`);
  }
  return (data ?? []).map((r) => r.user_id as string);
}
