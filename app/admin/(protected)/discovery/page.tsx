import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/isAdmin";
import DiscoverySourcesTable from "@/components/admin/DiscoverySourcesTable";
import DiscoveredLinksInspectorTable, { type DiscoveredLinkRow } from "@/components/admin/DiscoveredLinksInspectorTable";

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


function prettyJson(value: unknown) {
  if (value === null || value === undefined) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return trimmed;
    }
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function pickFirstKey(rows: GenericRow[], keys: string[]) {
  return keys.find((key) => rows.some((row) => Object.prototype.hasOwnProperty.call(row, key))) ?? null;
}

function normalizeDecision(value: string) {
  return value.trim().toLowerCase();
}

function isSelectedDecision(decision: string) {
  return ["selected", "enqueue", "enqueued", "queued", "accepted"].some((candidate) => decision.includes(candidate));
}

function isRejectedDecision(decision: string) {
  return ["rejected", "reject", "ignored", "skip", "skipped", "duplicate", "filtered"].some((candidate) => decision.includes(candidate));
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export default async function AdminDiscoveryPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect("/login?next=/admin/discovery");
  }

  const [sourcesRes, runsRes, linksRes, qualityLinksRes] = await Promise.all([
    ctx.supabase.from("discovery_sources").select("*").order("created_at", { ascending: false }),
    ctx.supabase.from("discovery_runs").select("*").order("started_at", { ascending: false }).limit(50),
    ctx.supabase.from("discovered_links").select("*").order("created_at", { ascending: false }).limit(100),
    ctx.supabase.from("discovered_links").select("*"),
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

  if (qualityLinksRes.error) {
    return <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">{qualityLinksRes.error.message}</div>;
  }

  const sourceRows = ((sourcesRes.data ?? []) as GenericRow[]);
  const runRows = ((runsRes.data ?? []) as GenericRow[]);
  const linkRows = ((linksRes.data ?? []) as GenericRow[]);
  const qualityLinkRows = ((qualityLinksRes.data ?? []) as GenericRow[]);

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

  const qualitySourceKey = pickFirstKey(qualityLinkRows, ["source_id", "discovery_source_id"]);
  const qualityDecisionKey = pickFirstKey(qualityLinkRows, ["decision", "selected_for_enqueue"]);
  const qualityIngestJobIdKey = pickFirstKey(qualityLinkRows, ["ingest_job_id", "job_id"]);
  const qualityScoreKey = pickFirstKey(qualityLinkRows, ["score", "relevance_score"]);

  type SourceQualityAccumulator = {
    sourceId: string;
    sourceLabel: string;
    totalLinks: number;
    selectedCount: number;
    rejectedCount: number;
    scoreTotal: number;
    scoredCount: number;
  };

  const qualityBySource = new Map<string, SourceQualityAccumulator>();

  const ensureSourceAccumulator = (sourceId: string) => {
    const existing = qualityBySource.get(sourceId);
    if (existing) return existing;

    const next: SourceQualityAccumulator = {
      sourceId,
      sourceLabel: sourceLabelById.get(sourceId) ?? sourceId,
      totalLinks: 0,
      selectedCount: 0,
      rejectedCount: 0,
      scoreTotal: 0,
      scoredCount: 0,
    };
    qualityBySource.set(sourceId, next);
    return next;
  };

  for (const source of mappedSources) {
    ensureSourceAccumulator(source.id);
  }

  for (const row of qualityLinkRows) {
    const sourceId = qualitySourceKey ? asString(row[qualitySourceKey]) : "";
    if (!sourceId) continue;

    const acc = ensureSourceAccumulator(sourceId);
    acc.totalLinks += 1;

    const score = qualityScoreKey ? asNumber(row[qualityScoreKey]) : null;
    if (score !== null) {
      acc.scoreTotal += score;
      acc.scoredCount += 1;
    }

    let decisionValue = "";
    const selectedFlag = asBoolean(row.selected_for_enqueue);
    if (selectedFlag === true) {
      decisionValue = "selected";
    } else if (selectedFlag === false) {
      decisionValue = "rejected";
    } else if (qualityDecisionKey) {
      const rawDecision = row[qualityDecisionKey];
      if (typeof rawDecision === "boolean") {
        decisionValue = rawDecision ? "selected" : "rejected";
      } else if (typeof rawDecision === "string") {
        decisionValue = rawDecision;
      }
    }

    const normalizedDecision = normalizeDecision(decisionValue);
    const hasIngestJob = qualityIngestJobIdKey ? asString(row[qualityIngestJobIdKey]).length > 0 : false;
    if (isSelectedDecision(normalizedDecision) || hasIngestJob) {
      acc.selectedCount += 1;
    }
    if (isRejectedDecision(normalizedDecision)) {
      acc.rejectedCount += 1;
    }
  }

  const qualitySort = typeof searchParams?.qualitySort === "string" ? searchParams.qualitySort : "selection_rate";

  const sourceQualityRows = Array.from(qualityBySource.values())
    .map((source) => {
      const selectionRate = source.totalLinks ? (source.selectedCount / source.totalLinks) * 100 : 0;
      const averageScore = source.scoredCount ? source.scoreTotal / source.scoredCount : null;

      return {
        ...source,
        selectionRate,
        averageScore,
      };
    })
    .sort((a, b) => {
      if (qualitySort === "selected_count") {
        return b.selectedCount - a.selectedCount || b.selectionRate - a.selectionRate || b.totalLinks - a.totalLinks;
      }
      return b.selectionRate - a.selectionRate || b.selectedCount - a.selectedCount || b.totalLinks - a.totalLinks;
    });

  const linkSourceKey = pickFirstKey(linkRows, ["source_id", "discovery_source_id"]);
  const linkCreatedAtKey = pickFirstKey(linkRows, ["created_at", "discovered_at"]);
  const linkNormalizedUrlKey = pickFirstKey(linkRows, ["normalized_url", "url", "raw_url"]);
  const linkScoreKey = pickFirstKey(linkRows, ["score", "relevance_score"]);
  const linkDecisionKey = pickFirstKey(linkRows, ["decision", "selected_for_enqueue"]);
  const linkIngestJobIdKey = pickFirstKey(linkRows, ["ingest_job_id", "job_id"]);
  const linkRejectReasonKey = pickFirstKey(linkRows, ["reject_reason", "skip_reason", "reason"]);
  const linkReasonsJsonKey = pickFirstKey(linkRows, ["reasons_json", "score_reasons", "scoring_reasons"]);
  const linkTextKey = pickFirstKey(linkRows, ["anchor_text", "source_text", "title", "context_text"]);

  const mappedLinks: DiscoveredLinkRow[] = linkRows.map((row) => {
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
      selected: asBoolean(row.selected_for_enqueue),
      sourceId,
      createdAt: linkCreatedAtKey ? asTimestamp(row[linkCreatedAtKey]) : null,
      sourceLabel,
      normalizedUrl: linkNormalizedUrlKey ? asString(row[linkNormalizedUrlKey]) : "",
      score: linkScoreKey ? asNumber(row[linkScoreKey]) : null,
      decision: decisionValue,
      ingestJobId: linkIngestJobIdKey ? asString(row[linkIngestJobIdKey]) : "",
      rejectReason: linkRejectReasonKey ? asString(row[linkRejectReasonKey]) : "",
      reasonsJsonPretty: linkReasonsJsonKey ? prettyJson(row[linkReasonsJsonKey]) : null,
      sourceText: linkTextKey ? asString(row[linkTextKey]) : "",
    };
  });

  const sourceFilter = typeof searchParams?.source === "string" ? searchParams.source : "all";
  const decisionFilter = typeof searchParams?.decision === "string" ? searchParams.decision : "all";
  const minScoreRaw = typeof searchParams?.minScore === "string" ? searchParams.minScore : "";
  const searchFilter = typeof searchParams?.q === "string" ? searchParams.q.trim() : "";

  const minScore = Number(minScoreRaw);
  const hasMinScoreFilter = minScoreRaw.length > 0 && Number.isFinite(minScore);
  const query = searchFilter.toLowerCase();

  const filteredLinks = mappedLinks.filter((link) => {
    if (sourceFilter !== "all" && link.sourceId !== sourceFilter) {
      return false;
    }

    const normalizedDecision = normalizeDecision(link.decision);
    if (decisionFilter === "selected" && !isSelectedDecision(normalizedDecision) && !link.ingestJobId) {
      return false;
    }
    if (decisionFilter === "rejected" && !isRejectedDecision(normalizedDecision)) {
      return false;
    }
    if (decisionFilter === "other" && (isSelectedDecision(normalizedDecision) || isRejectedDecision(normalizedDecision) || link.ingestJobId)) {
      return false;
    }

    if (hasMinScoreFilter && (link.score === null || link.score < minScore)) {
      return false;
    }

    if (query.length > 0) {
      const haystack = `${link.normalizedUrl} ${link.sourceText} ${link.sourceLabel}`.toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }

    return true;
  });

  const selectedVisibleCount = filteredLinks.filter((link) => isSelectedDecision(normalizeDecision(link.decision)) || Boolean(link.ingestJobId)).length;
  const rejectedVisibleCount = filteredLinks.filter((link) => isRejectedDecision(normalizeDecision(link.decision))).length;
  const scoredVisible = filteredLinks.filter((link) => link.score !== null);
  const avgVisibleScore = scoredVisible.length
    ? scoredVisible.reduce((sum, link) => sum + (link.score ?? 0), 0) / scoredVisible.length
    : null;

  const sourceFilterOptions = mappedSources.map((source) => ({ id: source.id, label: source.label }));

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-black tracking-tight">Discovery Source Quality</h2>
          <form>
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-black/50">
              Sort by
              <select
                className="h-9 rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold normal-case tracking-normal text-black/80"
                name="qualitySort"
                defaultValue={qualitySort}
              >
                <option value="selection_rate">Selection rate</option>
                <option value="selected_count">Selected count</option>
              </select>
              <button
                type="submit"
                className="h-9 rounded-xl border border-black/10 px-3 text-xs font-semibold normal-case tracking-normal text-black/70 hover:bg-black/[0.03]"
              >
                Apply
              </button>
            </label>
          </form>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-black/[0.08] bg-white/85 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
          <table className="min-w-full divide-y divide-black/[0.08] text-sm">
            <thead className="bg-black/[0.02] text-left text-xs uppercase tracking-[0.14em] text-black/50">
              <tr>
                <th className="px-3 py-3">Source label</th>
                <th className="px-3 py-3">Total links</th>
                <th className="px-3 py-3">Selected</th>
                <th className="px-3 py-3">Rejected</th>
                <th className="px-3 py-3">Selection rate</th>
                <th className="px-3 py-3">Average score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06]">
              {sourceQualityRows.length ? (
                sourceQualityRows.map((row) => (
                  <tr key={row.sourceId} className="hover:bg-black/[0.02]">
                    <td className="px-3 py-3 font-semibold text-black/80">{row.sourceLabel}</td>
                    <td className="px-3 py-3 text-black/65">{row.totalLinks}</td>
                    <td className="px-3 py-3 text-emerald-700">{row.selectedCount}</td>
                    <td className="px-3 py-3 text-rose-700">{row.rejectedCount}</td>
                    <td className="px-3 py-3 text-black/65">{formatPercent(row.selectionRate)}</td>
                    <td className="px-3 py-3 text-black/65">{row.averageScore === null ? "-" : row.averageScore.toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-3 py-6 text-center text-black/50" colSpan={6}>
                    No discovered links found for source-quality metrics.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
        <form className="grid gap-3 rounded-2xl border border-black/[0.08] bg-white/85 p-4 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)] md:grid-cols-4">
          <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.12em] text-black/50">
            Source
            <select
              className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-medium normal-case tracking-normal text-black/80"
              name="source"
              defaultValue={sourceFilter}
            >
              <option value="all">All sources</option>
              {sourceFilterOptions.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.12em] text-black/50">
            Decision
            <select
              className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-medium normal-case tracking-normal text-black/80"
              name="decision"
              defaultValue={decisionFilter}
            >
              <option value="all">All decisions</option>
              <option value="selected">Selected / enqueued</option>
              <option value="rejected">Rejected</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.12em] text-black/50">
            Min score
            <input
              className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-medium normal-case tracking-normal text-black/80"
              type="number"
              name="minScore"
              min="0"
              step="0.01"
              defaultValue={minScoreRaw}
              placeholder="0.00"
            />
          </label>
          <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.12em] text-black/50">
            Search
            <input
              className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-medium normal-case tracking-normal text-black/80"
              type="search"
              name="q"
              defaultValue={searchFilter}
              placeholder="URL or source text"
            />
          </label>
          <div className="md:col-span-4 flex items-center gap-2">
            <button type="submit" className="h-10 rounded-xl bg-black px-4 text-sm font-semibold text-white hover:bg-black/85">
              Apply filters
            </button>
            <a href="/admin/discovery" className="h-10 rounded-xl border border-black/10 px-4 text-sm font-semibold leading-10 text-black/70 hover:bg-black/[0.03]">
              Reset
            </a>
          </div>
        </form>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Visible links</p>
            <p className="mt-1 text-2xl font-black tracking-tight">{filteredLinks.length}</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Selected / enqueued</p>
            <p className="mt-1 text-2xl font-black tracking-tight text-emerald-800">{selectedVisibleCount}</p>
          </div>
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.06] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-700">Rejected</p>
            <p className="mt-1 text-2xl font-black tracking-tight text-rose-800">{rejectedVisibleCount}</p>
          </div>
          <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Average visible score</p>
            <p className="mt-1 text-2xl font-black tracking-tight">{avgVisibleScore === null ? "-" : avgVisibleScore.toFixed(2)}</p>
          </div>
        </div>
        <DiscoveredLinksInspectorTable links={filteredLinks} />
      </section>
    </div>
  );
}
