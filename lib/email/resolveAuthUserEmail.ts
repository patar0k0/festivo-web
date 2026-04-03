import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Primary email for an auth user (service-role client with `auth.admin`).
 * Returns null if missing or lookup fails (caller logs; no invented addresses).
 */
export async function resolveAuthUserEmail(
  admin: SupabaseClient,
  userId: string,
): Promise<string | null> {
  if (!userId?.trim()) return null;
  try {
    const { data, error } = await admin.auth.admin.getUserById(userId.trim());
    if (error || !data?.user?.email) return null;
    const e = data.user.email.trim();
    return e || null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[email_jobs] resolveAuthUserEmail failed", { user_id: userId, message });
    return null;
  }
}
