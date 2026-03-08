import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/isAdmin";
import IngestJobsPanel from "@/components/admin/IngestJobsPanel";
import { getSourceUrlMatchMeta } from "@/lib/admin/sourceUrlMatching";

type IngestJobRow = {
  id: string;
  status: "pending" | "processing" | "done" | "failed";
  source_url: string;
  pending_festival_id: string | null;
  pending_status: "pending" | "approved" | "rejected" | null;
  published_festival_id: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
};

type PendingFestivalLookupRow = {
  id: string;
  source_url: string | null;
  created_at: string;
  status: "pending" | "approved" | "rejected";
};

type FestivalLookupRow = {
  id: string;
  source_url: string | null;
  created_at: string;
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

  const pendingBySourceUrl = new Map<string, PendingFestivalLookupRow>();
  const pendingByNormalizedUrl = new Map<string, PendingFestivalLookupRow>();
  const pendingByFacebookEventId = new Map<string, PendingFestivalLookupRow>();
  const publishedBySourceUrl = new Map<string, string>();
  const publishedByNormalizedUrl = new Map<string, string>();
  const publishedByFacebookEventId = new Map<string, string>();

  const { data: pendingRows, error: pendingError } = await ctx.supabase
    .from("pending_festivals")
    .select("id,source_url,created_at,status")
    .not("source_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (pendingError) {
    return (
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">
        Failed loading pending festivals: {pendingError.message}
      </div>
    );
  }

  for (const pendingRow of (pendingRows ?? []) as PendingFestivalLookupRow[]) {
    if (!pendingRow.source_url) continue;

    const pendingNormalized: PendingFestivalLookupRow = {
      id: String(pendingRow.id),
      source_url: pendingRow.source_url,
      created_at: pendingRow.created_at,
      status: pendingRow.status,
    };

    if (!pendingBySourceUrl.has(pendingRow.source_url)) {
      pendingBySourceUrl.set(pendingRow.source_url, pendingNormalized);
    }

    const pendingMeta = getSourceUrlMatchMeta(pendingRow.source_url);
    if (pendingMeta?.normalizedUrl && !pendingByNormalizedUrl.has(pendingMeta.normalizedUrl)) {
      pendingByNormalizedUrl.set(pendingMeta.normalizedUrl, pendingNormalized);
    }
    if (pendingMeta?.facebookEventId && !pendingByFacebookEventId.has(pendingMeta.facebookEventId)) {
      pendingByFacebookEventId.set(pendingMeta.facebookEventId, pendingNormalized);
    }
  }

  const { data: publishedRows, error: publishedError } = await ctx.supabase
    .from("festivals")
    .select("id,source_url,created_at")
    .not("source_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (publishedError) {
    return (
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">
        Failed loading published festivals: {publishedError.message}
      </div>
    );
  }

  for (const publishedRow of (publishedRows ?? []) as FestivalLookupRow[]) {
    if (!publishedRow.source_url) continue;
    const publishedId = String(publishedRow.id);

    if (!publishedBySourceUrl.has(publishedRow.source_url)) {
      publishedBySourceUrl.set(publishedRow.source_url, publishedId);
    }

    const publishedMeta = getSourceUrlMatchMeta(publishedRow.source_url);
    if (publishedMeta?.normalizedUrl && !publishedByNormalizedUrl.has(publishedMeta.normalizedUrl)) {
      publishedByNormalizedUrl.set(publishedMeta.normalizedUrl, publishedId);
    }
    if (publishedMeta?.facebookEventId && !publishedByFacebookEventId.has(publishedMeta.facebookEventId)) {
      publishedByFacebookEventId.set(publishedMeta.facebookEventId, publishedId);
    }
  }

  const rows: IngestJobRow[] = (data ?? []).map((row) => {
    const sourceUrl = row.source_url;
    const matchMeta = getSourceUrlMatchMeta(sourceUrl);

    const pendingFestival =
      pendingBySourceUrl.get(sourceUrl) ??
      (matchMeta?.normalizedUrl ? pendingByNormalizedUrl.get(matchMeta.normalizedUrl) : undefined) ??
      (matchMeta?.facebookEventId ? pendingByFacebookEventId.get(matchMeta.facebookEventId) : undefined) ??
      null;

    const publishedFestivalId =
      publishedBySourceUrl.get(sourceUrl) ??
      (matchMeta?.normalizedUrl ? publishedByNormalizedUrl.get(matchMeta.normalizedUrl) : undefined) ??
      (matchMeta?.facebookEventId ? publishedByFacebookEventId.get(matchMeta.facebookEventId) : undefined) ??
      null;

    const pendingFestivalId = pendingFestival?.id ?? null;
    const pendingStatus = pendingFestival?.status ?? null;

    console.info(
      `[admin-ingest] job=${String(row.id)} pending_status=${pendingStatus ?? "null"} published_festival_id=${publishedFestivalId ?? "null"}`,
    );

    return {
      id: String(row.id),
      status: row.status as IngestJobRow["status"],
      source_url: sourceUrl,
      pending_festival_id: pendingFestivalId,
      pending_status: pendingStatus,
      published_festival_id: publishedFestivalId,
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
