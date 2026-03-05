import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/isAdmin";
import IngestJobsPanel from "@/components/admin/IngestJobsPanel";

type IngestJobRow = {
  id: string;
  status: "pending" | "processing" | "done" | "failed";
  source_url: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
};

export default async function AdminIngestPage() {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect("/login?next=/admin/ingest");
  }

  const { data, error } = await ctx.supabase
    .from("ingest_jobs")
    .select("id,status,source_url,created_at,started_at,finished_at,error")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">{error.message}</div>;
  }

  const rows: IngestJobRow[] = (data ?? []).map((row) => ({
    id: String(row.id),
    status: row.status as IngestJobRow["status"],
    source_url: row.source_url,
    created_at: row.created_at,
    started_at: row.started_at ?? null,
    finished_at: row.finished_at ?? null,
    error: row.error ?? null,
  }));

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
        <h1 className="text-3xl font-black tracking-tight">Ingest Queue</h1>
        <p className="mt-2 text-sm text-black/65">Manage source URLs for background ingestion into pending festivals.</p>
      </div>

      <IngestJobsPanel rows={rows} />
    </div>
  );
}
