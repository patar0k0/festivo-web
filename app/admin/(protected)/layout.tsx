import AdminShell from "@/components/admin/AdminShell";
import { requireAdmin } from "@/lib/admin/isAdmin";

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  return <AdminShell email={session.email}>{children}</AdminShell>;
}
