import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/isAdmin";
import DiscoverySourcesTable from "@/components/admin/DiscoverySourcesTable";

type GenericRow = Record<string, unknown>;

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function asTimestamp(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function pickFirstKey(rows: GenericRow[], keys: string[]) {
  return keys.find((key) => rows.some((row) => Object.prototype.hasOwnProperty.call(row, key))) ?? null;
}

export default async function AdminDiscoveryPage() {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect("/login?next=/admin/discovery");
  }

  const [sourcesRes, runsRes, linksRes] = await Promise.all([
    ctx.supabase.from("discovery_sources").select("*").order("created_at", { ascending: false }),
    ctx.supabase.from("discovery_runs").select("*").order("started_at", { ascending: false }).limit(50),
    ctx.supabase.from("discovered_links").select("*").order("created_at", { ascending: false }).limit(100),
  ]);

  if (sourcesRes.error) {
    return <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">{sourcesRes.error.message}</div>;
  }

  if (runsRes.error) {
    return <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">{runsRes.error.message}</div>;
  }

  if (linksRes.error) {
    return <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">{linksRes.error.message}</div>;
  }

  const sourceRows = ((sourcesRes.data ?? []) as GenericRow[]);
  const runRows = ((runsRes.data ?? []) as GenericRow[]);
  const linkRows = ((linksRes.data ?? []) as GenericRow[]);

  const runSourceKey = pickFirstKey(runRows, ["source_id", "discovery_source_id"]);
  const runStartedAtKey = pickFirstKey(runRows, ["started_at", "created_at"]);
  const runJobsKey = pickFirstKey(runRows, ["jobs_enqueued"]);

  const lastRunBySource = new Map<string, string>();
  const totalJobsBySource = new Map<string, number>();

  for (const run of runRows) {
    const sourceId = runSourceKey ? asString(run[runSourceKey]) : "";
    if (!sourceId) continue;

    const startedAt = runStartedAtKey ? asTimestamp(run[runStartedAtKey]) : null;
    if (startedAt) {
      const current = lastRunBySource.get(sourceId);
      if (!current || new Date(startedAt).getTime() > new Date(current).getTime()) {
        lastRunBySource.set(sourceId, startedAt);
      }
    }

    if (runJobsKey) {
      const jobs = asNumber(run[runJobsKey]);
      if (jobs !== null) {
        totalJobsBySource.set(sourceId, (totalJobsBySource.get(sourceId) ?? 0) + jobs);
      }
    }
  }

  const mappedSources = sourceRows.map((row) => {
    const id = asString(row.id);
    const label = asString(row.name) || asString(row.label) || id;
    const maxLinksPresent = Object.prototype.hasOwnProperty.call(row, "max_links_per_run");

    return {
      id,
      label,
      sourceType: asString(row.source_type),
      baseUrl: asString(row.base_url),
      isActive: asBoolean(row.is_active),
      priority: asNumber(row.priority),
      maxLinksPerRun: asNumber(row.max_links_per_run),
      supportsMaxLinksEdit: maxLinksPresent,
      lastRunAt: id ? lastRunBySource.get(id) ?? null : null,
      totalJobsEnqueued: id ? totalJobsBySource.get(id) ?? null : null,
    };
  });

  const mappedRuns = runRows.map((row) => ({
    id: asString(row.id),
    startedAt: asTimestamp(row.started_at) ?? asTimestamp(row.created_at),
    finishedAt: asTimestamp(row.finished_at),
    status: asString(row.status) || "-",
    sourcesProcessed: asNumber(row.sources_processed),
    linksFound: asNumber(row.links_found),
    linksDeduped: asNumber(row.links_deduped),
    jobsEnqueued: asNumber(row.jobs_enqueued),
    error: asString(row.error) || asString(row.error_summary) || "",
  }));

  const sourceLabelById = new Map<string, string>();
  for (const row of sourceRows) {
    const id = asString(row.id);
    if (!id) continue;
    sourceLabelById.set(id, asString(row.name) || asString(row.label) || id);
  }

  const linkSourceKey = pickFirstKey(linkRows, ["source_id", "discovery_source_id"]);
  const linkCreatedAtKey = pickFirstKey(linkRows, ["created_at", "discovered_at"]);
  const linkNormalizedUrlKey = pickFirstKey(linkRows, ["normalized_url", "url", "raw_url"]);
  const linkScoreKey = pickFirstKey(linkRows, ["score", "relevance_score"]);
  const linkDecisionKey = pickFirstKey(linkRows, ["decision", "selected_for_enqueue"]);
  const linkIngestJobIdKey = pickFirstKey(linkRows, ["ingest_job_id", "job_id"]);
  const linkRejectReasonKey = pickFirstKey(linkRows, ["reject_reason", "skip_reason", "reason"]);

  const mappedLinks = linkRows.map((row) => {
    const sourceId = linkSourceKey ? asString(row[linkSourceKey]) : "";
    const sourceLabel = sourceId ? sourceLabelById.get(sourceId) ?? sourceId : "-";

    let decisionValue = "-";
    if (linkDecisionKey) {
      const rawDecision = row[linkDecisionKey];
      if (typeof rawDecision === "boolean") {
        decisionValue = rawDecision ? "selected" : "rejected";
      } else if (typeof rawDecision === "string" && rawDecision.length > 0) {
        decisionValue = rawDecision;
      }
    }

    return {
      id: asString(row.id),
      createdAt: linkCreatedAtKey ? asTimestamp(row[linkCreatedAtKey]) : null,
      sourceLabel,
      normalizedUrl: linkNormalizedUrlKey ? asString(row[linkNormalizedUrlKey]) : "",
      score: linkScoreKey ? asNumber(row[linkScoreKey]) : null,
      decision: decisionValue,
      ingestJobId: linkIngestJobIdKey ? asString(row[linkIngestJobIdKey]) : "",
      rejectReason: linkRejectReasonKey ? asString(row[linkRejectReasonKey]) : "",
    };
  });

  const stats = {
    totalSources: mappedSources.length,
    activeSources: mappedSources.filter((source) => source.isActive).length,
    runsShown: mappedRuns.length,
    failedRunsShown: mappedRuns.filter((run) => run.status.toLowerCase() === "failed").length,
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
        <h1 className="text-3xl font-black tracking-tight">Discovery Dashboard</h1>
        <p className="mt-2 text-sm text-black/65">Monitor discovery sources and recent discovery runs from admin.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-4 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/45">Total sources</p>
          <p className="mt-2 text-3xl font-black tracking-tight">{stats.totalSources}</p>
        </div>
        <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-4 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/45">Active sources</p>
          <p className="mt-2 text-3xl font-black tracking-tight">{stats.activeSources}</p>
        </div>
        <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-4 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/45">Recent runs shown</p>
          <p className="mt-2 text-3xl font-black tracking-tight">{stats.runsShown}</p>
        </div>
        <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-4 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/45">Failed runs shown</p>
          <p className="mt-2 text-3xl font-black tracking-tight">{stats.failedRunsShown}</p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-black tracking-tight">Discovery Sources</h2>
        <DiscoverySourcesTable rows={mappedSources} />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black tracking-tight">Recent Discovery Runs</h2>
        <div className="overflow-x-auto rounded-2xl border border-black/[0.08] bg-white/85 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
          <table className="min-w-full divide-y divide-black/[0.08] text-sm">
            <thead className="bg-black/[0.02] text-left text-xs uppercase tracking-[0.14em] text-black/50">
              <tr>
                <th className="px-3 py-3">Started</th>
                <th className="px-3 py-3">Finished</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Sources processed</th>
                <th className="px-3 py-3">Links found</th>
                <th className="px-3 py-3">Links deduped</th>
                <th className="px-3 py-3">Jobs enqueued</th>
                <th className="px-3 py-3">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06]">
              {mappedRuns.length ? (
                mappedRuns.map((run) => (
                  <tr key={run.id || `${run.startedAt}-${run.finishedAt}`} className="hover:bg-black/[0.02]">
                    <td className="px-3 py-3 text-black/65">{run.startedAt ? new Date(run.startedAt).toLocaleString("bg-BG") : "-"}</td>
                    <td className="px-3 py-3 text-black/65">{run.finishedAt ? new Date(run.finishedAt).toLocaleString("bg-BG") : "-"}</td>
                    <td className="px-3 py-3 text-black/75">{run.status}</td>
                    <td className="px-3 py-3 text-black/65">{run.sourcesProcessed ?? "-"}</td>
                    <td className="px-3 py-3 text-black/65">{run.linksFound ?? "-"}</td>
                    <td className="px-3 py-3 text-black/65">{run.linksDeduped ?? "-"}</td>
                    <td className="px-3 py-3 text-black/65">{run.jobsEnqueued ?? "-"}</td>
                    <td className="px-3 py-3 text-[#b13a1a]">{run.error || "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-3 py-6 text-center text-black/50" colSpan={8}>
                    No discovery runs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black tracking-tight">Latest Discovered Links</h2>
        <div className="overflow-x-auto rounded-2xl border border-black/[0.08] bg-white/85 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
          <table className="min-w-full divide-y divide-black/[0.08] text-sm">
            <thead className="bg-black/[0.02] text-left text-xs uppercase tracking-[0.14em] text-black/50">
              <tr>
                <th className="px-3 py-3">Created</th>
                <th className="px-3 py-3">Source</th>
                <th className="px-3 py-3">Normalized URL</th>
                <th className="px-3 py-3">Score</th>
                <th className="px-3 py-3">Decision</th>
                <th className="px-3 py-3">Ingest job</th>
                <th className="px-3 py-3">Reject reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06]">
              {mappedLinks.length ? (
                mappedLinks.map((link) => (
                  <tr key={link.id || `${link.createdAt}-${link.normalizedUrl}`} className="hover:bg-black/[0.02]">
                    <td className="whitespace-nowrap px-3 py-3 text-black/65">{link.createdAt ? new Date(link.createdAt).toLocaleString("bg-BG") : "-"}</td>
                    <td className="px-3 py-3 text-black/75">{link.sourceLabel}</td>
                    <td className="max-w-[28rem] px-3 py-3 text-black/75">
                      <span className="block truncate" title={link.normalizedUrl || "-"}>
                        {link.normalizedUrl || "-"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-black/65">{link.score ?? "-"}</td>
                    <td className="px-3 py-3 text-black/65">{link.decision}</td>
                    <td className="px-3 py-3 text-black/65">{link.ingestJobId || "-"}</td>
                    <td className="px-3 py-3 text-[#b13a1a]">{link.rejectReason || "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-3 py-6 text-center text-black/50" colSpan={7}>
                    No discovered links found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
