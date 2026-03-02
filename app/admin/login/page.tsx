import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/isAdmin";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getAdminSession();
  const params = await searchParams;
  const next = typeof params.next === "string" && params.next.startsWith("/") ? params.next : "/admin";

  if (session?.isAdmin) {
    redirect(next);
  }

  redirect(`/login?next=${encodeURIComponent(next)}`);
}
