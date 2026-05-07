import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Ensures a `public.users` row exists for the current Auth user (session check path).
 * Uses upsert with ignoreDuplicates (Postgres ON CONFLICT DO NOTHING on primary key).
 * @returns false when upsert failed (e.g. RLS/migration); callers must not treat missing row as invalid session.
 */
export async function ensurePublicUserRowForSession(
  supabase: SupabaseClient,
  user: User,
): Promise<boolean> {
  const { error } = await supabase.from("users").upsert(
    { id: user.id, email: user.email ?? null },
    { onConflict: "id", ignoreDuplicates: true },
  );

  if (error) {
    console.error("[ensurePublicUserRowForSession] upsert failed", error);
    return false;
  }
  return true;
}
