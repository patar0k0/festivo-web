import AdminShell from "@/components/admin/AdminShell";
import { getAdminAuthContext } from "@/lib/admin/isAdmin";

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminAuthContext();

  return <AdminShell email={admin.user.email ?? null}>{children}</AdminShell>;
}
