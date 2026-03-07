import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/isAdmin";
import IngestJobsPanel from "@/components/admin/IngestJobsPanel";
import { getSourceUrlMatchMeta } from "@/lib/admin/sourceUrlMatching";

type IngestJobRow = {
  id: string;
  status: "pending" | "processing" | "done" | "failed";
  source_url: string;
  pending_festival_id: string | null;
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

  const sourceUrls = (data ?? [])
    .map((row) => row.source_url)
    .filter((url): url is string => typeof url === "string" && url.length > 0);

  const pendingBySourceUrl = new Map<string, string>();
  const pendingByNormalizedUrl = new Map<string, string>();
  const pendingByFacebookEventId = new Map<string, string>();

  if (sourceUrls.length) {
    const { data: pendingRows } = await ctx.supabase
      .from("pending_festivals")
      .select("id,source_url,created_at")
      .eq("status", "pending")
      .not("source_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(1000);

    for (const pendingRow of pendingRows ?? []) {
      if (!pendingRow.source_url) continue;

      const pendingId = String(pendingRow.id);
      if (!pendingBySourceUrl.has(pendingRow.source_url)) {
        pendingBySourceUrl.set(pendingRow.source_url, pendingId);
      }

      const pendingMeta = getSourceUrlMatchMeta(pendingRow.source_url);
      if (pendingMeta?.normalizedUrl && !pendingByNormalizedUrl.has(pendingMeta.normalizedUrl)) {
        pendingByNormalizedUrl.set(pendingMeta.normalizedUrl, pendingId);
      }
      if (pendingMeta?.facebookEventId && !pendingByFacebookEventId.has(pendingMeta.facebookEventId)) {
        pendingByFacebookEventId.set(pendingMeta.facebookEventId, pendingId);
      }
    }
  }

  const rows: IngestJobRow[] = (data ?? []).map((row) => {
    const sourceUrl = row.source_url;
    const matchMeta = getSourceUrlMatchMeta(sourceUrl);

    const pendingFestivalId =
      pendingBySourceUrl.get(sourceUrl) ??
      (matchMeta?.normalizedUrl ? pendingByNormalizedUrl.get(matchMeta.normalizedUrl) : undefined) ??
      (matchMeta?.facebookEventId ? pendingByFacebookEventId.get(matchMeta.facebookEventId) : undefined) ??
      null;

    if (process.env.NODE_ENV !== "production" && row.status === "done") {
      console.info("[admin/ingest] pending match check", {
        jobId: String(row.id),
        rawSourceUrl: sourceUrl,
        normalizedSourceUrl: matchMeta?.normalizedUrl ?? null,
        facebookEventId: matchMeta?.facebookEventId ?? null,
        matchedPendingFestivalId: pendingFestivalId,
      });
    }

    return {
      id: String(row.id),
      status: row.status as IngestJobRow["status"],
      source_url: sourceUrl,
      pending_festival_id: pendingFestivalId,
      created_at: row.created_at,
      started_at: row.started_at ?? null,
      finished_at: row.finished_at ?? null,
      error: row.error ?? null,
    };
  });

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
