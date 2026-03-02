import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/supabaseServer";

export async function createSupabaseServerClient() {
  const { url, anon, configured } = getSupabaseEnv();
  if (!configured || !url || !anon) {
    throw new Error("Missing Supabase env");
  }

  const cookieStore = await cookies();

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components can't always set cookies.
        }
      },
    },
  });
}
