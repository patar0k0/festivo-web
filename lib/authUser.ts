import { createSupabaseServerClient } from "@/lib/supabase/server";

export const USER_AUTH_COOKIE = "festivo_user_token";
export const ACCESS_AUTH_COOKIE = "festivo_access_token";
export const REFRESH_AUTH_COOKIE = "festivo_refresh_token";

export type OptionalUser = {
  id: string;
  email: string | null;
} | null;

export async function getOptionalUser(): Promise<OptionalUser> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return null;
    return { id: user.id, email: user.email ?? null };
  } catch {
    return null;
  }
}
