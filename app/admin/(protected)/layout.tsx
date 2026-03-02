import AdminShell from "@/components/admin/AdminShell";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <AdminShell email={user?.email ?? null}>{children}</AdminShell>;
}
