"use client";

import { useMemo, useState } from "react";
import type { ResearchFestivalResult } from "@/lib/admin/research/types";

export default function ResearchFestivalPanel() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ResearchFestivalResult | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isResearching, setIsResearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const canResearch = query.trim().length > 0 && !isResearching;
  const canCreate = Boolean(result) && !isCreating;

  const sourceSummary = useMemo(() => {
    if (!result) return "";
    const official = result.sources.find((source) => source.is_official);
    return official?.url ?? result.sources[0]?.url ?? "No source URL";
  }, [result]);

  const runResearch = async () => {
    setError("");
    setSuccess("");
    setIsResearching(true);

    try {
      const response = await fetch("/admin/api/research-festival", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string; result?: ResearchFestivalResult } | null;
      if (!response.ok || !payload?.result) {
        throw new Error(payload?.error ?? "Research request failed.");
      }

      setResult(payload.result);
      setSuccess("Research completed. Review the extracted result below.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error while researching.");
    } finally {
      setIsResearching(false);
    }
  };

  const createPendingFestival = async () => {
    if (!result) return;

    setError("");
    setSuccess("");
    setIsCreating(true);

    try {
      const response = await fetch("/admin/api/research-festival/create-pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string; id?: string } | null;
      if (!response.ok || !payload?.id) {
        throw new Error(payload?.error ?? "Failed to create pending festival.");
      }

      setSuccess(`Pending festival created (#${payload.id}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error while creating pending festival.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
      <div className="space-y-2">
        <label htmlFor="research-query" className="text-xs font-semibold uppercase tracking-[0.14em] text-black/55">
          Festival query
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="research-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Сурва 2026"
            className="w-full rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={runResearch}
            disabled={!canResearch}
            className="rounded-xl bg-[#0c0e14] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isResearching ? "Researching..." : "Research"}
          </button>
        </div>
      </div>

      {error ? <p className="rounded-xl border border-[#c23c1f]/25 bg-[#fff4ef] px-3 py-2 text-sm text-[#b13a1a]">{error}</p> : null}
      {success ? <p className="rounded-xl border border-[#0e7a45]/20 bg-[#f0fbf4] px-3 py-2 text-sm text-[#0e7a45]">{success}</p> : null}

      <div className="space-y-3 rounded-xl border border-black/[0.08] bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Result preview</p>
        {!result ? (
          <p className="text-sm text-black/55">No result yet. Run research to preview extracted festival data.</p>
        ) : (
          <div className="space-y-2 text-sm text-black/80">
            <p><span className="font-semibold">Title:</span> {result.title ?? "-"}</p>
            <p><span className="font-semibold">Dates:</span> {result.start_date ?? "-"} → {result.end_date ?? "-"}</p>
            <p><span className="font-semibold">City:</span> {result.city ?? "-"}</p>
            <p><span className="font-semibold">Location:</span> {result.location ?? "-"}</p>
            <p><span className="font-semibold">Organizer:</span> {result.organizer ?? "-"}</p>
            <p><span className="font-semibold">Tags:</span> {result.tags.length > 0 ? result.tags.join(", ") : "-"}</p>
            <p><span className="font-semibold">Source:</span> {sourceSummary}</p>
            <p><span className="font-semibold">Confidence:</span> {result.confidence.overall}</p>
            {result.warnings.length > 0 ? <p><span className="font-semibold">Warnings:</span> {result.warnings.join("; ")}</p> : null}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={createPendingFestival}
        disabled={!canCreate}
        className="rounded-xl border border-black/[0.1] bg-white px-4 py-2 text-sm font-semibold uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-45"
      >
        {isCreating ? "Creating..." : "Create pending festival"}
      </button>
    </div>
  );
}
