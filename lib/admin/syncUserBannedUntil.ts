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
}
