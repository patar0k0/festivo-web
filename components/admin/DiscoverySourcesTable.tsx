"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const DEFAULT_SOURCE_TYPE = "municipality_site";
const DEFAULT_PRIORITY = "100";
const DEFAULT_MAX_LINKS = "20";

export type SourceOperationalStatus = "active" | "degraded" | "disabled" | "unknown";

export type DiscoverySourceRunTrendCell = {
  enqueued: number | null;
  approvalRate: number | null;
};

type DiscoverySourceRow = {
  id: string;
  label: string;
  sourceType: string;
  baseUrl: string;
  isActive: boolean | null;
  priority: number | null;
  maxLinksPerRun: number | null;
  lastRunAt: string | null;
  totalJobsEnqueued: number | null;
  supportsMaxLinksEdit: boolean;
  operationalStatus: SourceOperationalStatus;
  approvalRateLastRun: number | null;
  enqueuedLastRun: number | null;
  totalCandidatesLastRun: number | null;
  autoDisabledLastRun: boolean;
  lastRunsTrend: DiscoverySourceRunTrendCell[];
};

type Props = {
  rows: DiscoverySourceRow[];
};

async function readErrorMessage(response: Response, fallback: string) {
  const text = await response.text().catch(() => "");
  if (text) {
    try {
      const payload = JSON.parse(text) as { error?: unknown };
      if (typeof payload.error === "string" && payload.error.trim()) {
        return payload.error.trim();
      }
    } catch {
      /* non-JSON body (e.g. HTML error page) */
    }
  }
  return fallback;
}

function responseBodyLooksLikeHtml(raw: string): boolean {
  const head = raw.trim().slice(0, 400);
  return /<!doctype\s+html/i.test(head) || /<\s*html[\s>]/i.test(head);
}

/** PATCH is_active only: richer errors + temporary debug logging. */
async function readDiscoverySourceActivityError(response: Response, requestUrl: string): Promise<string> {
  const status = response.status;
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text().catch(() => "");
  const trimmed = text.trim();
  const prefix = `Failed to update source activity. [HTTP ${status}]`;
  const ctLower = contentType.toLowerCase();
  const claimsJson = ctLower.includes("application/json");

  let usedJsonError = false;
  let detail: string | null = null;

  if (claimsJson && trimmed) {
    try {
      const payload = JSON.parse(text) as { error?: unknown };
      if (typeof payload.error === "string" && payload.error.trim()) {
        detail = payload.error.trim();
        usedJsonError = true;
      }
    } catch {
      /* malformed JSON */
    }
  }

  if (detail === null && trimmed) {
    if (responseBodyLooksLikeHtml(text)) {
      detail = "Non-JSON response returned by server.";
    } else {
      detail = trimmed.slice(0, 500);
    }
  }

  if (!usedJsonError) {
    console.error("[discovery-sources PATCH activity]", {
      method: "PATCH",
      url: requestUrl,
      status,
      contentType,
      textPreview: text.slice(0, 300),
    });
  }

  return detail ? `${prefix} ${detail}` : prefix;
}

type StatusFilter = "all" | SourceOperationalStatus;

function formatApprovalRateRatio(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function StatusBadge({ status }: { status: SourceOperationalStatus }) {
  if (status === "unknown") {
    return (
      <span className="inline-flex rounded-full bg-black/[0.06] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-black/45">
        n/a
      </span>
    );
  }

  const palette =
    status === "active"
      ? "bg-emerald-500/15 text-emerald-800"
      : status === "degraded"
        ? "bg-amber-400/20 text-amber-950"
        : "bg-rose-500/15 text-rose-900";

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] ${palette}`}
    >
      {status}
    </span>
  );
}

function WarningAutoDisabledIcon() {
  return (
    <span
      className="inline-flex shrink-0 text-amber-600"
      title="Auto-disabled due to low performance"
      aria-label="Auto-disabled due to low performance"
      role="img"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
}

export default function DiscoverySourcesTable({ rows }: Props) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [maxLinksDrafts, setMaxLinksDrafts] = useState<Record<string, string>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState("");
  const [newName, setNewName] = useState("");
  const [newBaseUrl, setNewBaseUrl] = useState("");
  const [newType, setNewType] = useState(DEFAULT_SOURCE_TYPE);
  const [newPriority, setNewPriority] = useState(DEFAULT_PRIORITY);
  const [newMaxLinks, setNewMaxLinks] = useState(DEFAULT_MAX_LINKS);

  const supportsAnyMaxLinksEdit = useMemo(() => rows.some((row) => row.supportsMaxLinksEdit), [rows]);

  const visibleRows = useMemo(() => {
    if (statusFilter === "all") return rows;
    return rows.filter((row) => row.operationalStatus === statusFilter);
  }, [rows, statusFilter]);

  const toggleActive = async (row: DiscoverySourceRow) => {
    if (busyId) return;
    setBusyId(row.id);
    setMessage("");
    setError("");

    try {
      const url = `/admin/api/discovery-sources/${row.id}`;
      const response = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_active: !(row.isActive ?? false) }),
      });

      if (!response.ok) {
        throw new Error(await readDiscoverySourceActivityError(response, url));
      }

      setMessage(`Updated source: ${row.label}`);
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unexpected source update error.");
    } finally {
      setBusyId(null);
    }
  };

  const saveMaxLinks = async (row: DiscoverySourceRow) => {
    if (busyId) return;
    const draft = maxLinksDrafts[row.id] ?? String(row.maxLinksPerRun ?? "");
    const trimmed = draft.trim();

    if (!trimmed || Number.isNaN(Number(trimmed)) || Number(trimmed) < 1) {
      setError("max_links_per_run must be a positive number.");
      return;
    }

    setBusyId(row.id);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/admin/api/discovery-sources/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ max_links_per_run: Number(trimmed) }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Failed to update max links."));
      }

      setMessage(`Updated max links for: ${row.label}`);
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unexpected source update error.");
    } finally {
      setBusyId(null);
    }
  };

  const resetAddForm = () => {
    setNewName("");
    setNewBaseUrl("");
    setNewType(DEFAULT_SOURCE_TYPE);
    setNewPriority(DEFAULT_PRIORITY);
    setNewMaxLinks(DEFAULT_MAX_LINKS);
    setCreateError("");
  };

  const closeAddModal = () => {
    setAddOpen(false);
    resetAddForm();
  };

  const submitNewSource = async () => {
    if (createBusy) return;
    setCreateError("");

    const priorityParsed = Number(newPriority);
    const maxLinksParsed = Number(newMaxLinks);
    if (!newName.trim()) {
      setCreateError("Name is required.");
      return;
    }
    if (!newBaseUrl.trim()) {
      setCreateError("Base URL is required.");
      return;
    }
    if (!Number.isFinite(priorityParsed)) {
      setCreateError("Priority must be a number.");
      return;
    }
    if (!Number.isInteger(maxLinksParsed) || maxLinksParsed < 1) {
      setCreateError("Max links per run must be a positive integer.");
      return;
    }

    setCreateBusy(true);
    try {
      const response = await fetch("/admin/api/discovery-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: newName.trim(),
          base_url: newBaseUrl.trim(),
          type: newType.trim() || DEFAULT_SOURCE_TYPE,
          priority: priorityParsed,
          max_links_per_run: maxLinksParsed,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Failed to create source."));
      }

      setMessage("Discovery source created.");
      closeAddModal();
      router.refresh();
    } catch (createErr) {
      setCreateError(createErr instanceof Error ? createErr.message : "Unexpected error while creating source.");
    } finally {
      setCreateBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-black tracking-tight">Discovery Sources</h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">Filter</span>
            {(
              [
                ["all", "All"],
                ["active", "Active"],
                ["degraded", "Degraded"],
                ["disabled", "Disabled"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={`h-8 rounded-lg border px-2.5 text-xs font-semibold transition-colors ${
                  statusFilter === value
                    ? "border-black/20 bg-black text-white"
                    : "border-black/10 bg-white text-black/70 hover:bg-black/[0.03]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setCreateError("");
              setAddOpen(true);
            }}
            className="h-10 shrink-0 rounded-xl bg-black px-4 text-sm font-semibold text-white hover:bg-black/85"
          >
            + Add Source
          </button>
        </div>
      </div>

      {addOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-discovery-source-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeAddModal();
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-black/[0.08] bg-white p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.12)]"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 id="add-discovery-source-title" className="text-lg font-black tracking-tight">
              Add discovery source
            </h3>
            <p className="mt-1 text-xs text-black/55">Creates a row in discovery_sources (active by default).</p>

            <div className="mt-4 space-y-3">
              {createError ? (
                <p className="rounded-lg bg-[#ff4c1f]/10 px-3 py-2 text-sm text-[#b13a1a]">{createError}</p>
              ) : null}

              <label className="block space-y-1 text-xs font-semibold uppercase tracking-[0.12em] text-black/50">
                Name
                <input
                  className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-medium normal-case tracking-normal text-black/80"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoComplete="off"
                  placeholder="e.g. Sofia municipality"
                />
              </label>
              <label className="block space-y-1 text-xs font-semibold uppercase tracking-[0.12em] text-black/50">
                Base URL
                <input
                  className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-medium normal-case tracking-normal text-black/80"
                  value={newBaseUrl}
                  onChange={(e) => setNewBaseUrl(e.target.value)}
                  autoComplete="url"
                  placeholder="https://example.bg/events"
                />
              </label>
              <label className="block space-y-1 text-xs font-semibold uppercase tracking-[0.12em] text-black/50">
                Type
                <input
                  className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-medium normal-case tracking-normal text-black/80"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  placeholder={DEFAULT_SOURCE_TYPE}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1 text-xs font-semibold uppercase tracking-[0.12em] text-black/50">
                  Priority
                  <input
                    className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-medium normal-case tracking-normal text-black/80"
                    type="number"
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                  />
                </label>
                <label className="block space-y-1 text-xs font-semibold uppercase tracking-[0.12em] text-black/50">
                  Max links / run
                  <input
                    className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-medium normal-case tracking-normal text-black/80"
                    type="number"
                    min={1}
                    step={1}
                    value={newMaxLinks}
                    onChange={(e) => setNewMaxLinks(e.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeAddModal}
                disabled={createBusy}
                className="h-10 rounded-xl border border-black/10 px-4 text-sm font-semibold text-black/70 hover:bg-black/[0.03] disabled:opacity-45"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitNewSource()}
                disabled={createBusy}
                className="h-10 rounded-xl bg-black px-4 text-sm font-semibold text-white hover:bg-black/85 disabled:opacity-45"
              >
                {createBusy ? "Saving…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {message ? <p className="rounded-lg bg-[#18a05e]/10 px-3 py-2 text-sm text-[#0e7a45]">{message}</p> : null}
      {error ? <p className="rounded-lg bg-[#ff4c1f]/10 px-3 py-2 text-sm text-[#b13a1a]">{error}</p> : null}

      <div className="overflow-x-auto rounded-2xl border border-black/[0.08] bg-white/85 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
        <table className="min-w-full divide-y divide-black/[0.08] text-sm">
          <thead className="bg-black/[0.02] text-left text-xs uppercase tracking-[0.14em] text-black/50">
            <tr>
              <th className="px-3 py-3">Name</th>
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3">Base URL</th>
              <th className="px-3 py-3">Active</th>
              <th className="px-3 py-3">Source health</th>
              <th className="px-3 py-3">Approval rate</th>
              <th className="px-3 py-3">Enqueued (last run)</th>
              <th className="px-3 py-3">Candidates (last run)</th>
              <th className="px-3 py-3">Last 3 runs</th>
              <th className="px-3 py-3">Priority</th>
              <th className="px-3 py-3">Max links/run</th>
              <th className="px-3 py-3">Last run</th>
              <th className="px-3 py-3">Total jobs enqueued</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.06]">
            {visibleRows.length ? (
              visibleRows.map((row) => {
                const rowBusy = busyId === row.id;
                return (
                  <tr key={row.id} className="hover:bg-black/[0.02]">
                    <td className="px-3 py-3 font-semibold text-black/80">
                      <span className="inline-flex items-center gap-1.5">
                        {row.autoDisabledLastRun ? <WarningAutoDisabledIcon /> : null}
                        <span>{row.label}</span>
                      </span>
                    </td>
                    <td className="px-3 py-3 text-black/75">{row.sourceType || "-"}</td>
                    <td className="px-3 py-3 text-black/75">
                      {row.baseUrl ? (
                        <a href={row.baseUrl} target="_blank" rel="noreferrer" className="break-all underline decoration-black/25 underline-offset-2">
                          {row.baseUrl}
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-3 py-3 text-black/75">{row.isActive === null ? "-" : row.isActive ? "yes" : "no"}</td>
                    <td className="px-3 py-3">
                      <StatusBadge status={row.operationalStatus} />
                    </td>
                    <td className="px-3 py-3 text-black/65 tabular-nums">{formatApprovalRateRatio(row.approvalRateLastRun)}</td>
                    <td className="px-3 py-3 text-black/65 tabular-nums">{row.enqueuedLastRun ?? "—"}</td>
                    <td className="px-3 py-3 text-black/65 tabular-nums">{row.totalCandidatesLastRun ?? "—"}</td>
                    <td className="px-3 py-3 text-[11px] leading-snug text-black/60">
                      {row.lastRunsTrend.length ? (
                        <span className="tabular-nums">
                          {row.lastRunsTrend.map((cell, index) => (
                            <span key={`${row.id}-trend-${index}`}>
                              {index > 0 ? <span className="text-black/35"> · </span> : null}
                              <span title={`Run ${index + 1} (newest first): enqueued / approval rate`}>
                                {cell.enqueued ?? "—"} / {formatApprovalRateRatio(cell.approvalRate)}
                              </span>
                            </span>
                          ))}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-3 text-black/65">{row.priority ?? "-"}</td>
                    <td className="px-3 py-3 text-black/65">
                      {row.supportsMaxLinksEdit ? (
                        <div className="flex items-center gap-2">
                          <input
                            value={maxLinksDrafts[row.id] ?? String(row.maxLinksPerRun ?? "")}
                            onChange={(event) => setMaxLinksDrafts((prev) => ({ ...prev, [row.id]: event.target.value }))}
                            className="w-20 rounded-lg border border-black/[0.1] bg-white px-2 py-1 text-xs"
                            inputMode="numeric"
                          />
                          <button
                            type="button"
                            onClick={() => saveMaxLinks(row)}
                            disabled={rowBusy}
                            className="rounded-lg border border-black/[0.1] bg-white px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] disabled:opacity-45"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        row.maxLinksPerRun ?? "-"
                      )}
                    </td>
                    <td className="px-3 py-3 text-black/65">{row.lastRunAt ? new Date(row.lastRunAt).toLocaleString("bg-BG") : "-"}</td>
                    <td className="px-3 py-3 text-black/65">{row.totalJobsEnqueued ?? "-"}</td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => toggleActive(row)}
                        disabled={rowBusy || row.isActive === null}
                        className="rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.13em] disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {rowBusy ? "Saving..." : row.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="px-3 py-6 text-center text-black/50" colSpan={14}>
                  {rows.length ? "No sources match this filter." : "No discovery sources found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!supportsAnyMaxLinksEdit ? <p className="text-xs text-black/50">max_links_per_run editing is unavailable in this schema.</p> : null}
    </div>
  );
}
