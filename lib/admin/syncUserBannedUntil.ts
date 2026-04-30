import type { SupabaseClient } from "@supabase/supabase-js";

/** Keeps public.users.banned_until aligned with Auth (admin ban / unban). */
export async function adminSyncUserBannedUntil(
  admin: SupabaseClient,
  userId: string,
  untilIso: string | null,
): Promise<void> {
  const { error } = await admin.rpc("admin_sync_user_banned_until", {
    p_user_id: userId,
    p_until: untilIso,
  });
  if (error) {
    throw new Error(`sync banned_until: ${error.message}`);
  }
  const { error: flagErr } = await admin.from("users").update({ ban_sync_error: false }).eq("id", userId);
  if (flagErr) {
    throw new Error(`sync banned_until (clear ban_sync_error): ${flagErr.message}`);
  }
}

export async function retryPendingBanSync(admin: SupabaseClient, limit = 50): Promise<number> {
  const maxRows = Math.max(1, Math.min(limit, 200));
  const { data: rows, error: readErr } = await admin
    .from("users")
    .select("id")
    .eq("ban_sync_error", true)
    .limit(maxRows);
  if (readErr) {
    throw new Error(`ban sync retry read: ${readErr.message}`);
  }

  let retried = 0;
  for (const row of rows ?? []) {
    const userId = String((row as { id: string }).id);
    const { data: authData, error: authErr } = await admin.auth.admin.getUserById(userId);
    if (authErr || !authData?.user) {
      continue;
    }
    await adminSyncUserBannedUntil(admin, userId, authData.user.banned_until ?? null);
    retried += 1;
  }

  return retried;
}
