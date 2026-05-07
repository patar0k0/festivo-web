import { createSupabaseServerClient } from "@/lib/supabase/server";

export type OptionalUser = {
  id: string;
  email: string | null;
  /** Public profile image URL from `auth.users` `user_metadata.avatar_url`. */
  avatarUrl: string | null;
} | null;

export async function getOptionalUser(): Promise<OptionalUser> {
  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return null;
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const { data: row, error: rowError } = await supabase
    .from("users")
    .select("deleted_at")
    .eq("id", user.id)
    .maybeSingle();

  if (rowError) {
    console.error("[getOptionalUser] users lookup failed", rowError);
    throw rowError;
  }

  if (row?.deleted_at) return null;

  const rawAvatar = user.user_metadata?.avatar_url;
  const avatarUrl = typeof rawAvatar === "string" && rawAvatar.length > 0 ? rawAvatar : null;
  return { id: user.id, email: user.email ?? null, avatarUrl };
}
