import { redirect } from "next/navigation";
import { getSupabaseEnv } from "@/lib/supabaseServer";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { url, anon, configured } = getSupabaseEnv();

  // ако няма env, не прави loop — прати на login
  if (!configured || !url || !anon) {
    console.log("[admin-layout] redirect login: missing supabase env");
    redirect("/login?next=/admin");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  console.log("[admin-layout] getUser()", {
    hasUser: Boolean(user),
    userId: user?.id ?? null,
    userErr: userErr?.message ?? null,
  });

  if (userErr || !user) {
    console.log("[admin-layout] redirect login: userErr || !user", {
      hasUser: Boolean(user),
      userErr: userErr?.message ?? null,
    });
    redirect("/login?next=/admin");
  }

  const { data: roleRows, error: roleErr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin");

  const hasAdminRole = Boolean(roleRows && roleRows.length > 0);

  console.log("[admin-layout] user_roles admin query", {
    userId: user.id,
    roleRowCount: roleRows?.length ?? 0,
    hasAdminRole,
    roleErr: roleErr?.message ?? null,
  });

  // ако няма права / няма ред — НЕ връщай към /login?next=/admin (loop),
  // прати към / (или направи /not-authorized)
  if (roleErr || !hasAdminRole) {
    console.log("[admin-layout] redirect /: roleErr || !hasAdminRole", {
      roleErr: roleErr?.message ?? null,
      roleRowCount: roleRows?.length ?? 0,
      hasAdminRole,
    });
    redirect("/");
  }

  return <>{children}</>;
}
