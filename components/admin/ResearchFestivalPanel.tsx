"use client";

import { useMemo, useState } from "react";
import type { ResearchBestGuess, ResearchDateCandidate, ResearchFestivalResult, ResearchFieldCandidate } from "@/lib/admin/research/types";

type EditableFinalValues = ResearchBestGuess;

const EMPTY_FINAL_VALUES: EditableFinalValues = {
  title: null,
  start_date: null,
  end_date: null,
  city: null,
  location: null,
  description: null,
  organizer: null,
  hero_image: null,
  tags: [],
  is_free: null,
};

export default function ResearchFestivalPanel() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ResearchFestivalResult | null>(null);
  const [finalValues, setFinalValues] = useState<EditableFinalValues>(EMPTY_FINAL_VALUES);
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

  const setFromCandidate = (field: keyof EditableFinalValues, value: string | null) => {
    setFinalValues((prev) => ({ ...prev, [field]: value }));
  };

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
      setFinalValues(payload.result.best_guess ?? EMPTY_FINAL_VALUES);
      setSuccess("Research completed. Review candidates and finalize values below.");
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
        body: JSON.stringify({ result, final_values: finalValues }),
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

  const renderTextCandidates = (field: keyof EditableFinalValues, candidates: ResearchFieldCandidate[]) => {
    if (candidates.length === 0) {
      return <p className="text-xs text-black/50">No alternatives extracted for this field.</p>;
    }

    return (
      <div className="mt-2 flex flex-wrap gap-2">
        {candidates.map((candidate, index) => (
          <button
            key={`${field}-${candidate.value}-${candidate.source_url}-${index}`}
            type="button"
            onClick={() => setFromCandidate(field, candidate.value)}
            className="rounded-lg border border-black/[0.1] bg-white px-2 py-1 text-left text-xs hover:bg-black/[0.03]"
          >
            <div className="font-medium">{candidate.value}</div>
            <div className="text-black/55">{candidate.tier ?? "unknown tier"} • {candidate.language ?? "unknown lang"}</div>
          </button>
        ))}
      </div>
    );
  };

  const renderDateCandidates = (candidates: ResearchDateCandidate[]) => {
    if (candidates.length === 0) {
      return <p className="text-xs text-black/50">No alternative date ranges extracted.</p>;
    }

    return (
      <div className="mt-2 flex flex-wrap gap-2">
        {candidates.map((candidate, index) => (
          <button
            key={`${candidate.start_date}-${candidate.end_date}-${candidate.source_url}-${index}`}
            type="button"
            onClick={() => setFinalValues((prev) => ({ ...prev, start_date: candidate.start_date, end_date: candidate.end_date }))}
            className="rounded-lg border border-black/[0.1] bg-white px-2 py-1 text-left text-xs hover:bg-black/[0.03]"
          >
            <div className="font-medium">{candidate.label ?? `${candidate.start_date ?? "?"} → ${candidate.end_date ?? "?"}`}</div>
            <div className="text-black/55">{candidate.tier ?? "unknown tier"} • {candidate.language ?? "unknown lang"}</div>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4 rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
      <div className="space-y-2">
        <label htmlFor="research-query" className="text-xs font-semibold uppercase tracking-[0.14em] text-black/55">Festival query</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input id="research-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Сурва 2026" className="w-full rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-sm" />
          <button type="button" onClick={runResearch} disabled={!canResearch} className="rounded-xl bg-[#0c0e14] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">
            {isResearching ? "Researching..." : "Research"}
          </button>
        </div>
      </div>

      {error ? <p className="rounded-xl border border-[#c23c1f]/25 bg-[#fff4ef] px-3 py-2 text-sm text-[#b13a1a]">{error}</p> : null}
      {success ? <p className="rounded-xl border border-[#0e7a45]/20 bg-[#f0fbf4] px-3 py-2 text-sm text-[#0e7a45]">{success}</p> : null}

      {!result ? <p className="text-sm text-black/55">No result yet. Run research to preview extracted festival data.</p> : (
        <div className="space-y-4 rounded-xl border border-black/[0.08] bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Best guess review</p>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">Title</label>
              <input value={finalValues.title ?? ""} onChange={(e) => setFromCandidate("title", e.target.value || null)} className="mt-1 w-full rounded-lg border border-black/[0.1] px-2 py-1.5 text-sm" />
              {renderTextCandidates("title", result.candidates.titles)}
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">City</label>
              <input value={finalValues.city ?? ""} onChange={(e) => setFromCandidate("city", e.target.value || null)} className="mt-1 w-full rounded-lg border border-black/[0.1] px-2 py-1.5 text-sm" />
              {renderTextCandidates("city", result.candidates.cities)}
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">Start date</label>
              <input value={finalValues.start_date ?? ""} onChange={(e) => setFromCandidate("start_date", e.target.value || null)} className="mt-1 w-full rounded-lg border border-black/[0.1] px-2 py-1.5 text-sm" placeholder="YYYY-MM-DD" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">End date</label>
              <input value={finalValues.end_date ?? ""} onChange={(e) => setFromCandidate("end_date", e.target.value || null)} className="mt-1 w-full rounded-lg border border-black/[0.1] px-2 py-1.5 text-sm" placeholder="YYYY-MM-DD" />
            </div>
          </div>

          <div>{renderDateCandidates(result.candidates.dates)}</div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">Location</label>
              <input value={finalValues.location ?? ""} onChange={(e) => setFromCandidate("location", e.target.value || null)} className="mt-1 w-full rounded-lg border border-black/[0.1] px-2 py-1.5 text-sm" />
              {renderTextCandidates("location", result.candidates.locations)}
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">Organizer</label>
              <input value={finalValues.organizer ?? ""} onChange={(e) => setFromCandidate("organizer", e.target.value || null)} className="mt-1 w-full rounded-lg border border-black/[0.1] px-2 py-1.5 text-sm" />
              {renderTextCandidates("organizer", result.candidates.organizers)}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">Free entry</label>
              <select value={finalValues.is_free === null ? "unknown" : finalValues.is_free ? "yes" : "no"} onChange={(e) => setFinalValues((prev) => ({ ...prev, is_free: e.target.value === "unknown" ? null : e.target.value === "yes" }))} className="mt-1 w-full rounded-lg border border-black/[0.1] px-2 py-1.5 text-sm">
                <option value="unknown">Unknown</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>

          <div className="text-sm text-black/80 space-y-1">
            <p><span className="font-semibold">Provider:</span> {result.metadata?.provider ?? "-"}</p>
            <p><span className="font-semibold">Mode:</span> {result.metadata?.mode ?? "-"}</p>
            <p><span className="font-semibold">Source count:</span> {result.metadata?.source_count ?? result.sources.length}</p>
            <p><span className="font-semibold">Primary source:</span> {sourceSummary}</p>
            <p><span className="font-semibold">Confidence:</span> {result.confidence.overall}</p>
          </div>

          {result.warnings.length > 0 ? (
            <div>
              <p className="font-semibold text-sm">Warnings</p>
              <ul className="ml-5 list-disc text-sm text-black/80">
                {result.warnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            </div>
          ) : null}

          <div>
            <p className="font-semibold text-sm">Sources</p>
            {result.sources.length === 0 ? <p className="text-sm text-black/55">-</p> : (
              <ul className="ml-5 list-disc space-y-1 text-sm text-black/80">
                {result.sources.map((source) => (
                  <li key={source.url}>
                    <a href={source.url} target="_blank" rel="noreferrer" className="text-[#0e7a45] underline-offset-2 hover:underline">{source.title || source.domain}</a>
                    <span className="text-black/60"> ({source.domain}{source.is_official ? ", official" : ""})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <button type="button" onClick={createPendingFestival} disabled={!canCreate} className="rounded-xl border border-black/[0.1] bg-white px-4 py-2 text-sm font-semibold uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-45">
        {isCreating ? "Creating..." : "Create pending festival"}
      </button>
    </div>
  );
}
