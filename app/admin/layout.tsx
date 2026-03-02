import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/supabaseServer";

export default async function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { url, anon, configured } = getSupabaseEnv();

  // ако няма env, не прави loop — прати на login
  if (!configured || !url || !anon) {
    redirect("/login?next=/admin");
  }

  const cookieStore = cookies();

  const supabase = createServerClient(url, anon, {
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
          // ignore during render
        }
      },
    },
  });

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    redirect("/login?next=/admin");
  }

  const { data: roleRow, error: roleErr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  // ако няма права / няма ред — НЕ връщай към /login?next=/admin (loop),
  // прати към / (или направи /not-authorized)
  if (roleErr || !roleRow) {
    redirect("/");
  }

  return <>{children}</>;
}