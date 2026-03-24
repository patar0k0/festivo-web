import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/supabaseServer";

/**
 * Reads auth user id from the session cookie without writing refreshed cookies.
 * Used before rate limiting so we can key limits per user; full `getUser()` refresh
 * still runs on the normal middleware response path.
 */
export async function getSessionUserIdReadOnly(request: NextRequest): Promise<string | null> {
  const { url, anon, configured } = getSupabaseEnv();
  if (!configured || !url || !anon) {
    return null;
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        // Intentionally no-op: avoid dropping refreshed cookies on early 429/403 responses.
      },
    },
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.user?.id ?? null;
}
