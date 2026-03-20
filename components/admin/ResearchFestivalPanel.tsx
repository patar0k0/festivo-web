"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ResearchBestGuess, ResearchDateCandidate, ResearchFestivalResult, ResearchFieldCandidate } from "@/lib/admin/research/types";
import type { AiResearchConfidence, PerplexityFestivalResearchResult } from "@/lib/research/perplexity";

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

type AiEditableStringField =
  | "title"
  | "start_date"
  | "end_date"
  | "city"
  | "organizer_name"
  | "category"
  | "location_name"
  | "address"
  | "description"
  | "website_url"
  | "facebook_url"
  | "instagram_url"
  | "ticket_url"
  | "hero_image";

const AI_EDITABLE_TEXT_FIELDS: Array<{ key: Exclude<AiEditableStringField, "description">; label: string; placeholder?: string; type?: "text" | "date" | "url" }> = [
  { key: "title", label: "Title" },
  { key: "start_date", label: "Start date", placeholder: "DD.MM.YYYY г.", type: "text" },
  { key: "end_date", label: "End date", placeholder: "DD.MM.YYYY г.", type: "text" },
  { key: "city", label: "City" },
  { key: "organizer_name", label: "Organizer" },
  { key: "category", label: "Category" },
  { key: "location_name", label: "Location name" },
  { key: "address", label: "Address" },
  { key: "website_url", label: "Website URL", type: "url" },
  { key: "facebook_url", label: "Facebook URL", type: "url" },
  { key: "instagram_url", label: "Instagram URL", type: "url" },
  { key: "ticket_url", label: "Ticket URL", type: "url" },
  { key: "hero_image", label: "Hero image", type: "url" },
];

function sanitizeInputValue(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const BULGARIAN_DATE_REGEX = /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s*г\.)?$/i;

function isValidDateParts(year: number, month: number, day: number): boolean {
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  return utcDate.getUTCFullYear() === year && utcDate.getUTCMonth() === month - 1 && utcDate.getUTCDate() === day;
}

function toBulgarianDateDisplayFromIso(isoDate: string): string {
  const [, year, month, day] = isoDate.match(ISO_DATE_REGEX) ?? [];
  return `${day}.${month}.${year} г.`;
}

function normalizeDisplayDateToIso(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const isoMatch = trimmed.match(ISO_DATE_REGEX);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    return isValidDateParts(year, month, day) ? `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}` : trimmed;
  }

  const bulgarianMatch = trimmed.match(BULGARIAN_DATE_REGEX);
  if (!bulgarianMatch) return trimmed;

  const day = Number(bulgarianMatch[1]);
  const month = Number(bulgarianMatch[2]);
  const year = Number(bulgarianMatch[3]);
  if (!isValidDateParts(year, month, day)) return trimmed;

  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function formatDateForBulgarianDisplay(value: string | null): string | null {
  const normalized = normalizeDisplayDateToIso(value);
  if (!normalized) return null;
  if (ISO_DATE_REGEX.test(normalized)) return toBulgarianDateDisplayFromIso(normalized);
  return normalized;
}

function confidenceBadgeStyle(confidence: AiResearchConfidence): string {
  if (confidence === "high") return "border-[#0e7a45]/30 bg-[#f0fbf4] text-[#0e7a45]";
  if (confidence === "medium") return "border-[#9a6700]/30 bg-[#fffbeb] text-[#8a5d00]";
  return "border-[#c23c1f]/25 bg-[#fff4ef] text-[#b13a1a]";
}

function confidenceLabel(confidence: AiResearchConfidence): string {
  if (confidence === "high") return "High";
  if (confidence === "medium") return "Medium";
  return "Low";
}

function getDomainLabel(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./i, "");
  } catch {
    return "Unknown domain";
  }
}

function formatMissingField(field: string): string {
  const normalized = field.replace(/_url$/, "").replace(/_/g, " ");
  return `${normalized} missing`;
}

export default function ResearchFestivalPanel() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ResearchFestivalResult | null>(null);
  const [finalValues, setFinalValues] = useState<EditableFinalValues>(EMPTY_FINAL_VALUES);

  const [aiQuery, setAiQuery] = useState("");
  const [aiResult, setAiResult] = useState<PerplexityFestivalResearchResult | null>(null);
  const [aiDraft, setAiDraft] = useState<PerplexityFestivalResearchResult | null>(null);
  const [aiError, setAiError] = useState("");
  const [aiSuccess, setAiSuccess] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isResearching, setIsResearching] = useState(false);
  const [isAiResearching, setIsAiResearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const canResearch = query.trim().length > 0 && !isResearching;
  const canAiResearch = aiQuery.trim().length > 0 && !isAiResearching;
  const canCreate = Boolean(result || aiDraft) && !isCreating;

  const sourceSummary = useMemo(() => {
    if (!result) return "";
    const official = result.sources.find((source) => source.is_official);
    return official?.url ?? result.sources[0]?.url ?? "No source URL";
  }, [result]);

  const setFromCandidate = (field: keyof EditableFinalValues, value: string | null) => {
    setFinalValues((prev) => ({ ...prev, [field]: value }));
  };

  const setAiDraftField = (field: AiEditableStringField, rawValue: string) => {
    setAiDraft((prev) => (prev ? { ...prev, [field]: sanitizeInputValue(rawValue) } : prev));
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
      setAiDraft(null);
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
      setAiDraft({
        ...payload.result,
        start_date: formatDateForBulgarianDisplay(payload.result.start_date),
        end_date: formatDateForBulgarianDisplay(payload.result.end_date),
      });
      setResult(null);
      setAiSuccess("AI research completed. Review and edit values before creating a pending draft.");
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Unexpected error while running AI research.");
    } finally {
      setIsAiResearching(false);
    }
  };

  const createPendingFestival = async () => {
    if (!result && !aiDraft) return;

    setError("");
    setSuccess("");
    setAiError("");
    setAiSuccess("");
    setIsCreating(true);

    try {
      const normalizedAiDraft = aiDraft
        ? {
            ...aiDraft,
            start_date: normalizeDisplayDateToIso(aiDraft.start_date),
            end_date: normalizeDisplayDateToIso(aiDraft.end_date),
          }
        : null;

      const response = await fetch("/admin/api/research-festival/create-pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalizedAiDraft ? { ai_result: normalizedAiDraft } : { result, final_values: finalValues }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string; id?: string } | null;
      if (!response.ok || !payload?.id) {
        throw new Error(payload?.error ?? "Failed to create pending festival.");
      }

      const message = `Pending festival created (#${payload.id}).`;
      if (aiDraft) {
        setAiSuccess(message);
      } else {
        setSuccess(message);
      }

      router.push(`/admin/pending-festivals/${payload.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error while creating pending festival.";
      if (aiDraft) {
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

      {aiDraft ? (
        <div className="space-y-4 rounded-xl border border-black/[0.08] bg-white p-4">
          <div className="flex flex-col gap-3 border-b border-black/[0.08] pb-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">AI Research Result</p>
              <p className="mt-1 text-sm text-black/65">Review extracted values, edit as needed, then create a pending draft.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${confidenceBadgeStyle(aiDraft.confidence)}`}>
                Confidence: {confidenceLabel(aiDraft.confidence)}
              </span>
              <button type="button" onClick={createPendingFestival} disabled={!canCreate} className="rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-45">
                {isCreating ? "Creating..." : "Create pending draft"}
              </button>
              <button type="button" onClick={runAiResearch} disabled={!canAiResearch} className="rounded-xl bg-[#0c0e14] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-45">
                {isAiResearching ? "Researching..." : "Research again"}
              </button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="space-y-4 rounded-xl border border-black/[0.08] bg-[#fafafa] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Editable extracted fields</p>

              <div className="grid gap-3 md:grid-cols-2">
                {AI_EDITABLE_TEXT_FIELDS.map((field) => (
                  <div key={field.key} className={field.key === "address" ? "md:col-span-2" : ""}>
                    <label className="text-xs font-semibold uppercase tracking-[0.1em] text-black/55">{field.label}</label>
                    <input
                      type={field.type ?? "text"}
                      value={aiDraft[field.key] ?? ""}
                      onChange={(event) => setAiDraftField(field.key, event.target.value)}
                      placeholder={field.placeholder}
                      className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-2 text-sm"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-black/55">Description</label>
                <textarea
                  value={aiDraft.description ?? ""}
                  onChange={(event) => setAiDraftField("description", event.target.value)}
                  rows={5}
                  className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-2 text-sm"
                />
              </div>

              <label className="flex items-center gap-2 rounded-lg border border-black/[0.1] bg-white px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={aiDraft.is_free === true}
                  onChange={(event) => setAiDraft((prev) => (prev ? { ...prev, is_free: event.target.checked ? true : null } : prev))}
                  className="h-4 w-4 rounded border-black/20"
                />
                Festival is free
              </label>
            </div>

            <aside className="space-y-4 rounded-xl border border-black/[0.08] bg-[#fcfcfc] p-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Evidence & metadata</p>
                <p className="text-sm text-black/75">{aiResult?.source_urls.length ?? 0} source{(aiResult?.source_urls.length ?? 0) === 1 ? "" : "s"} reviewed.</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">Sources</p>
                {aiDraft.source_urls.length === 0 ? (
                  <p className="text-sm text-black/60">No sources returned.</p>
                ) : (
                  <div className="space-y-2">
                    {aiDraft.source_urls.map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-lg border border-black/[0.1] bg-white p-2.5 hover:bg-black/[0.02]"
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-black/45">{getDomainLabel(url)}</p>
                        <p className="mt-1 break-all text-sm text-[#0e7a45] underline-offset-2 hover:underline">{url}</p>
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">Missing fields</p>
                {aiDraft.missing_fields.length === 0 ? (
                  <p className="text-sm text-black/60">No missing fields flagged.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {aiDraft.missing_fields.map((field) => (
                      <span key={field} className="rounded-full border border-black/[0.12] bg-white px-2.5 py-1 text-xs text-black/75">
                        {formatMissingField(field)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </div>
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

          <div className="space-y-1 text-sm text-black/80">
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
