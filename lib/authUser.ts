import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabaseServer";

export const USER_AUTH_COOKIE = "festivo_user_token";
export const ACCESS_AUTH_COOKIE = "festivo_access_token";
export const REFRESH_AUTH_COOKIE = "festivo_refresh_token";

export type OptionalUser = {
  id: string;
  email: string | null;
} | null;

export async function getOptionalUser(): Promise<OptionalUser> {
  const cookieStore = await cookies();
  const token =
    cookieStore.get(ACCESS_AUTH_COOKIE)?.value ??
    cookieStore.get(USER_AUTH_COOKIE)?.value;
  if (!token) return null;

  const supabase = supabaseServer();
  if (!supabase) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) return null;
  return { id: user.id, email: user.email ?? null };
}
