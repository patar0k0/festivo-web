import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/isAdmin";

export default async function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminContext();
  if (!admin || !admin.isAdmin) {
    redirect("/login?next=/admin");
  }

  return <>{children}</>;
}
