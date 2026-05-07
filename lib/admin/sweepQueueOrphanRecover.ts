import type { SupabaseClient } from "@supabase/supabase-js";
import { isAuthUserNotFoundError } from "@/lib/admin/authAdminErrors";
import { postAuthUserSweep } from "@/lib/admin/postAuthUserSweep";

/**
 * When auth user is gone and sweep succeeds (zeros ok), queue + cleanup_pending are cleared inside postAuthUserSweep.
 * Returns true if the queue row was resolved.
 */
export async function tryRecoverOrphanSweepQueueUser(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data: authLookup, error: authErr } = await admin.auth.admin.getUserById(userId);
  if (authErr && !isAuthUserNotFoundError(authErr)) {
    console.error("[sweepQueueOrphanRecover] auth lookup error", { userId, message: authErr.message });
    return false;
  }
  if (authLookup?.user) {
    return false;
  }

  try {
    await postAuthUserSweep(admin, userId, {
      label: "sweep_orphan_recover",
      userId,
      authUserExistedBeforeSweep: false,
    });
    return true;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[sweepQueueOrphanRecover] sweep failed (orphan path)", { userId, message });
    return false;
  }
}
