import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/isAdmin";
import ResearchFestivalPanel from "@/components/admin/ResearchFestivalPanel";

export default async function AdminResearchPage() {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect("/login?next=/admin/research");
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
        <h1 className="text-3xl font-black tracking-tight">Research Festival</h1>
        <p className="mt-2 text-sm text-black/65">Run on-demand festival research, review extracted data, and create a pending moderation record.</p>
      </div>

      <ResearchFestivalPanel />
    </div>
  );
}
