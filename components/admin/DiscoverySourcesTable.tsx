"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
};

type Props = {
  rows: DiscoverySourceRow[];
};

async function readErrorMessage(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error ?? fallback;
}

export default function DiscoverySourcesTable({ rows }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [maxLinksDrafts, setMaxLinksDrafts] = useState<Record<string, string>>({});

  const supportsAnyMaxLinksEdit = useMemo(() => rows.some((row) => row.supportsMaxLinksEdit), [rows]);

  const toggleActive = async (row: DiscoverySourceRow) => {
    if (busyId) return;
    setBusyId(row.id);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/admin/api/discovery-sources/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_active: !(row.isActive ?? false) }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Failed to update source activity."));
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

  return (
    <div className="space-y-3">
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
              <th className="px-3 py-3">Priority</th>
              <th className="px-3 py-3">Max links/run</th>
              <th className="px-3 py-3">Last run</th>
              <th className="px-3 py-3">Total jobs enqueued</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.06]">
            {rows.length ? (
              rows.map((row) => {
                const rowBusy = busyId === row.id;
                return (
                  <tr key={row.id} className="hover:bg-black/[0.02]">
                    <td className="px-3 py-3 font-semibold text-black/80">{row.label}</td>
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
                <td className="px-3 py-6 text-center text-black/50" colSpan={9}>
                  No discovery sources found.
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
