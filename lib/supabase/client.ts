import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/supabaseServer";

export function createSupabaseBrowserClient() {
  const { url, anon, configured } = getSupabaseEnv();
  if (!configured || !url || !anon) {
    throw new Error("Missing Supabase env");
  }

  return createBrowserClient(url, anon);
}
