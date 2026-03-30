import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/isAdmin";
import ResearchFestivalPanel from "@/components/admin/ResearchFestivalPanel";

export default async function AdminResearchPage() {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect("/login?next=/admin/research");
  }

  return <ResearchFestivalPanel />;
}
