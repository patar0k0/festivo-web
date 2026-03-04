import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/isAdmin";
import PendingFestivalsTable from "@/components/admin/PendingFestivalsTable";

type PendingFestivalRow = {
  id: string;
  title: string;
  city_id: number | null;
  start_date: string | null;
  end_date: string | null;
  source_url: string | null;
  created_at: string;
};

export default async function AdminPendingFestivalsPage() {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect("/login?next=/admin/pending-festivals");
  }

  const { data, error } = await ctx.supabase
    .from("pending_festivals")
    .select("id,title,city_id,start_date,end_date,source_url,created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">{error.message}</div>;
  }

  const rows: PendingFestivalRow[] = (data ?? []).map((row) => ({
    id: String(row.id),
    title: row.title ?? "(untitled)",
    city_id: row.city_id ?? null,
    start_date: row.start_date ?? null,
    end_date: row.end_date ?? null,
    source_url: row.source_url ?? null,
    created_at: row.created_at,
  }));

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
        <h1 className="text-3xl font-black tracking-tight">Pending Festivals</h1>
        <p className="mt-2 text-sm text-black/65">Review incoming ingestion records before publishing them to the main festivals catalog.</p>
      </div>

      <PendingFestivalsTable rows={rows} />
    </div>
  );
}
