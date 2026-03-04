import { notFound, redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/isAdmin";
import PendingFestivalEditForm from "@/components/admin/PendingFestivalEditForm";

export default async function AdminPendingFestivalEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect(`/login?next=/admin/pending-festivals/${id}`);
  }

  const { data, error } = await ctx.supabase.from("pending_festivals").select("*").eq("id", id).maybeSingle();

  if (error) {
    return <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">{error.message}</div>;
  }

  if (!data) {
    notFound();
  }

  return <PendingFestivalEditForm pendingFestival={{ ...data, id: String(data.id) }} />;
}
