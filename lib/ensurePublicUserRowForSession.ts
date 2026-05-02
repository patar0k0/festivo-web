import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Ensures a `public.users` row exists for the current Auth user (session check path).
 * Uses upsert with ignoreDuplicates (Postgres ON CONFLICT DO NOTHING on primary key).
 */
export async function ensurePublicUserRowForSession(
  supabase: SupabaseClient,
  user: User,
): Promise<void> {
  const { error } = await supabase.from("users").upsert(
    { id: user.id, email: user.email ?? null },
    { onConflict: "id", ignoreDuplicates: true },
  );

  if (error) {
    console.error("[ensurePublicUserRowForSession] upsert failed", error);
  }
}
