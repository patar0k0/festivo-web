import AdminShell from "@/components/admin/AdminShell";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/isAdmin";

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminContext();
  if (!admin || !admin.isAdmin) {
    redirect("/login?next=/admin");
  }

  return <AdminShell email={admin.user.email ?? null}>{children}</AdminShell>;
}
