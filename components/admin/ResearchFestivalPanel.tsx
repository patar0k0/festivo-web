"use client";

import { useMemo, useState } from "react";
import type { ResearchBestGuess, ResearchDateCandidate, ResearchFestivalResult, ResearchFieldCandidate } from "@/lib/admin/research/types";
import type { PerplexityFestivalResearchResult } from "@/lib/research/perplexity";

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

  const [aiQuery, setAiQuery] = useState("");
  const [aiResult, setAiResult] = useState<PerplexityFestivalResearchResult | null>(null);
  const [aiError, setAiError] = useState("");
  const [aiSuccess, setAiSuccess] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isResearching, setIsResearching] = useState(false);
  const [isAiResearching, setIsAiResearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const canResearch = query.trim().length > 0 && !isResearching;
  const canAiResearch = aiQuery.trim().length > 0 && !isAiResearching;
  const canCreate = Boolean(result || aiResult) && !isCreating;

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
      setAiResult(null);
      setFinalValues(payload.result.best_guess ?? EMPTY_FINAL_VALUES);
      setSuccess("Research completed. Review candidates and finalize values below.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error while researching.");
    } finally {
      setIsResearching(false);
    }
  };

  const runAiResearch = async () => {
    setAiError("");
    setAiSuccess("");
    setIsAiResearching(true);

    try {
      const response = await fetch("/api/admin/research-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: aiQuery }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string; result?: PerplexityFestivalResearchResult } | null;
      if (!response.ok || !payload?.result) {
        throw new Error(payload?.error ?? "AI research request failed.");
      }

      setAiResult(payload.result);
      setResult(null);
      setAiSuccess("AI research completed. Review extracted values and sources.");
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Unexpected error while running AI research.");
    } finally {
      setIsAiResearching(false);
    }
  };

  const createPendingFestival = async () => {
    if (!result && !aiResult) return;

    setError("");
    setSuccess("");
    setAiError("");
    setAiSuccess("");
    setIsCreating(true);

    try {
      const response = await fetch("/admin/api/research-festival/create-pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aiResult ? { ai_result: aiResult } : { result, final_values: finalValues }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string; id?: string } | null;
      if (!response.ok || !payload?.id) {
        throw new Error(payload?.error ?? "Failed to create pending festival.");
      }

      const message = `Pending festival created (#${payload.id}).`;
      if (aiResult) {
        setAiSuccess(message);
      } else {
        setSuccess(message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error while creating pending festival.";
      if (aiResult) {
        setAiError(message);
      } else {
        setError(message);
      }
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

  const aiLinks = aiResult
    ? [
        { label: "Website", value: aiResult.website_url },
        { label: "Facebook", value: aiResult.facebook_url },
        { label: "Instagram", value: aiResult.instagram_url },
        { label: "Tickets", value: aiResult.ticket_url },
      ]
    : [];

  return (
    <div className="space-y-6 rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
      <div className="space-y-2">
        <h2 className="text-lg font-bold">AI Research</h2>
        <label htmlFor="ai-research-query" className="text-xs font-semibold uppercase tracking-[0.14em] text-black/55">Search query</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input id="ai-research-query" value={aiQuery} onChange={(event) => setAiQuery(event.target.value)} placeholder="сурва 2026" className="w-full rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-sm" />
          <button type="button" onClick={runAiResearch} disabled={!canAiResearch} className="rounded-xl bg-[#0c0e14] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">
            {isAiResearching ? "Researching..." : "Research with AI"}
          </button>
        </div>
        {aiError ? <p className="rounded-xl border border-[#c23c1f]/25 bg-[#fff4ef] px-3 py-2 text-sm text-[#b13a1a]">{aiError}</p> : null}
        {aiSuccess ? <p className="rounded-xl border border-[#0e7a45]/20 bg-[#f0fbf4] px-3 py-2 text-sm text-[#0e7a45]">{aiSuccess}</p> : null}
      </div>

      {aiResult ? (
        <div className="space-y-3 rounded-xl border border-black/[0.08] bg-white p-4 text-sm text-black/85">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/55">AI result</p>
          <p><span className="font-semibold">Title:</span> {aiResult.title ?? "-"}</p>
          <p><span className="font-semibold">Dates:</span> {aiResult.start_date ?? "-"} {aiResult.end_date ? `→ ${aiResult.end_date}` : ""}</p>
          <p><span className="font-semibold">City:</span> {aiResult.city ?? "-"}</p>
          <p><span className="font-semibold">Organizer:</span> {aiResult.organizer_name ?? "-"}</p>
          <p><span className="font-semibold">Description:</span> {aiResult.description ?? "-"}</p>
          <div>
            <p className="font-semibold">Links</p>
            <ul className="ml-5 list-disc">
              {aiLinks.map((link) => (
                <li key={link.label}>{link.label}: {link.value ? <a href={link.value} target="_blank" rel="noreferrer" className="text-[#0e7a45] underline-offset-2 hover:underline">{link.value}</a> : "-"}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold">source_urls</p>
            {aiResult.source_urls.length === 0 ? <p className="text-black/60">-</p> : (
              <ul className="ml-5 list-disc space-y-1">
                {aiResult.source_urls.map((url) => (
                  <li key={url}><a href={url} target="_blank" rel="noreferrer" className="text-[#0e7a45] underline-offset-2 hover:underline">{url}</a></li>
                ))}
              </ul>
            )}
          </div>
          <p><span className="font-semibold">Confidence:</span> {aiResult.confidence}</p>
        </div>
      ) : null}

      <div className="h-px bg-black/[0.08]" />

      <div className="space-y-2">
        <label htmlFor="research-query" className="text-xs font-semibold uppercase tracking-[0.14em] text-black/55">Festival query (legacy)</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input id="research-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Сурва 2026" className="w-full rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-sm" />
          <button type="button" onClick={runResearch} disabled={!canResearch} className="rounded-xl border border-black/[0.1] bg-white px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45">
            {isResearching ? "Researching..." : "Research"}
          </button>
        </div>
      </div>

      {error ? <p className="rounded-xl border border-[#c23c1f]/25 bg-[#fff4ef] px-3 py-2 text-sm text-[#b13a1a]">{error}</p> : null}
      {success ? <p className="rounded-xl border border-[#0e7a45]/20 bg-[#f0fbf4] px-3 py-2 text-sm text-[#0e7a45]">{success}</p> : null}

      {!result ? <p className="text-sm text-black/55">No legacy result yet. Run legacy research to preview extracted festival data.</p> : (
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

          <div className="text-sm text-black/80 space-y-1">
            <p><span className="font-semibold">Provider:</span> {result.metadata?.provider ?? "-"}</p>
            <p><span className="font-semibold">Mode:</span> {result.metadata?.mode ?? "-"}</p>
            <p><span className="font-semibold">Source count:</span> {result.metadata?.source_count ?? result.sources.length}</p>
            <p><span className="font-semibold">Primary source:</span> {sourceSummary}</p>
            <p><span className="font-semibold">Confidence:</span> {result.confidence.overall}</p>
          </div>
        </div>
      )}

      <button type="button" onClick={createPendingFestival} disabled={!canCreate} className="rounded-xl border border-black/[0.1] bg-white px-4 py-2 text-sm font-semibold uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-45">
        {isCreating ? "Creating..." : "Create pending festival"}
      </button>
    </div>
  );
}
