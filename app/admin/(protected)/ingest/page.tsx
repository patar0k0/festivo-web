import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/isAdmin";
import IngestJobsPanel from "@/components/admin/IngestJobsPanel";
import { getSourceUrlMatchMeta } from "@/lib/admin/sourceUrlMatching";

type IngestJobRow = {
  id: string;
  status: "queued" | "pending" | "processing" | "done" | "failed";
  source_url: string;
  pending_festival_id: string | null;
  pending_status: "pending" | "approved" | "rejected" | null;
  published_festival_id: string | null;
  moderation_action: "open_pending" | "open_festival" | "no_pending_record" | "rejected" | "approved_without_festival" | "in_progress";
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  fb_browser_context: "authenticated" | "anonymous" | null;
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

function pickLatestPending(
  current: PendingFestivalLookupRow | undefined,
  incoming: PendingFestivalLookupRow,
): PendingFestivalLookupRow {
  if (!current) return incoming;
  return new Date(incoming.created_at).getTime() > new Date(current.created_at).getTime() ? incoming : current;
}

export default async function AdminIngestPage() {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect("/login?next=/admin/ingest");
  }

  const { data, error } = await ctx.supabase
    .from("ingest_jobs")
    .select("id,status,source_url,created_at,started_at,finished_at,error,fb_browser_context")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">{error.message}</div>;
  }

  const pendingById = new Map<string, PendingFestivalLookupRow>();
  const pendingIdsBySourceUrl = new Map<string, Set<string>>();
  const pendingIdsByNormalizedUrl = new Map<string, Set<string>>();
  const pendingIdsByFacebookEventId = new Map<string, Set<string>>();
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

    pendingById.set(pendingNormalized.id, pendingNormalized);

    if (!pendingIdsBySourceUrl.has(pendingRow.source_url)) {
      pendingIdsBySourceUrl.set(pendingRow.source_url, new Set<string>());
    }
    pendingIdsBySourceUrl.get(pendingRow.source_url)?.add(pendingNormalized.id);

    const pendingMeta = getSourceUrlMatchMeta(pendingRow.source_url);
    if (pendingMeta?.normalizedUrl) {
      if (!pendingIdsByNormalizedUrl.has(pendingMeta.normalizedUrl)) {
        pendingIdsByNormalizedUrl.set(pendingMeta.normalizedUrl, new Set<string>());
      }
      pendingIdsByNormalizedUrl.get(pendingMeta.normalizedUrl)?.add(pendingNormalized.id);
    }
    if (pendingMeta?.facebookEventId) {
      if (!pendingIdsByFacebookEventId.has(pendingMeta.facebookEventId)) {
        pendingIdsByFacebookEventId.set(pendingMeta.facebookEventId, new Set<string>());
      }
      pendingIdsByFacebookEventId.get(pendingMeta.facebookEventId)?.add(pendingNormalized.id);
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

    const pendingCandidateIds = new Set<string>();
    const sourceUrlCandidates = pendingIdsBySourceUrl.get(sourceUrl);
    sourceUrlCandidates?.forEach((id) => pendingCandidateIds.add(id));

    if (matchMeta?.normalizedUrl) {
      const normalizedCandidates = pendingIdsByNormalizedUrl.get(matchMeta.normalizedUrl);
      normalizedCandidates?.forEach((id) => pendingCandidateIds.add(id));
    }

    if (matchMeta?.facebookEventId) {
      const facebookCandidates = pendingIdsByFacebookEventId.get(matchMeta.facebookEventId);
      facebookCandidates?.forEach((id) => pendingCandidateIds.add(id));
    }

    const pendingCandidates = Array.from(pendingCandidateIds)
      .map((candidateId) => pendingById.get(candidateId))
      .filter((candidate): candidate is PendingFestivalLookupRow => !!candidate);

    const pendingFestival = pendingCandidates.reduce<PendingFestivalLookupRow | undefined>(pickLatestPending, undefined) ?? null;

    const publishedFestivalId =
      publishedBySourceUrl.get(sourceUrl) ??
      (matchMeta?.normalizedUrl ? publishedByNormalizedUrl.get(matchMeta.normalizedUrl) : undefined) ??
      (matchMeta?.facebookEventId ? publishedByFacebookEventId.get(matchMeta.facebookEventId) : undefined) ??
      null;

    const pendingFestivalId = pendingFestival?.id ?? null;
    const pendingStatus = pendingFestival?.status ?? null;

    const moderationAction: IngestJobRow["moderation_action"] =
      row.status !== "done"
        ? "in_progress"
        : pendingFestivalId && pendingStatus === "pending"
          ? "open_pending"
          : pendingFestivalId && pendingStatus === "approved"
            ? publishedFestivalId
              ? "open_festival"
              : "approved_without_festival"
            : pendingFestivalId && pendingStatus === "rejected"
              ? "rejected"
              : publishedFestivalId
                ? "open_festival"
                : "no_pending_record";

    const consideredPending = pendingCandidates
      .map((candidate) => `${candidate.id}:${candidate.status}:${candidate.created_at}`)
      .join(",");

    console.info(
      `[admin-ingest] job=${String(row.id)} matched_pending=${consideredPending || "none"} pending_id=${pendingFestivalId ?? "null"} pending_status=${pendingStatus ?? "null"} published_festival_id=${publishedFestivalId ?? "null"} chosen_status=${pendingStatus ?? "none"} chosen_action=${moderationAction}`,
    );

    const fbCtx = row.fb_browser_context;
    const fb_browser_context: IngestJobRow["fb_browser_context"] =
      fbCtx === "authenticated" || fbCtx === "anonymous" ? fbCtx : null;

    return {
      id: String(row.id),
      status: row.status as IngestJobRow["status"],
      source_url: sourceUrl,
      pending_festival_id: pendingFestivalId,
      pending_status: pendingStatus,
      published_festival_id: publishedFestivalId,
      moderation_action: moderationAction,
      created_at: row.created_at,
      started_at: row.started_at ?? null,
      finished_at: row.finished_at ?? null,
      error: row.error ?? null,
      fb_browser_context,
    };
  });

  return <IngestJobsPanel rows={rows} />;
}
