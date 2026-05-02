import { headers } from "next/headers";
import { getAdminAuthContext } from "@/lib/admin/isAdmin";

export default async function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = (await headers()).get("x-festivo-pathname") ?? "";
  if (!pathname.startsWith("/admin/login")) {
    await getAdminAuthContext();
  }

  return <>{children}</>;
}
