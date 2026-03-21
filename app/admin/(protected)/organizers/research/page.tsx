import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/isAdmin";
import OrganizerResearchCreatePanel from "@/components/admin/OrganizerResearchCreatePanel";

export default async function AdminOrganizerResearchPage() {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect("/login?next=/admin/organizers/research");
  }

  return <OrganizerResearchCreatePanel />;
}
