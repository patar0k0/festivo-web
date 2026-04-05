"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ResearchBestGuess, ResearchDateCandidate, ResearchFestivalResult, ResearchFieldCandidate } from "@/lib/admin/research/types";
import DdMmYyyyDateInput from "@/components/ui/DdMmYyyyDateInput";
import { parseFlexibleDateToIso } from "@/lib/dates/euDateFormat";
import type { AiResearchConfidence, PerplexityFestivalResearchResult } from "@/lib/research/perplexity";
import { getAIProviderLabel } from "@/lib/ai/providerUi";
import {
  AdminEntityPageShell,
  AdminFieldGrid,
  AdminFieldInlineRow,
  AdminFieldSection,
  AdminFieldLabel,
  AdminSummaryStrip,
  ADMIN_ENTITY_SECTION,
  ADMIN_ENTITY_CONTROL_CLASS,
  ADMIN_ENTITY_TEXTAREA_CLASS,
  adminEntityUsesInlineLayout,
  buildStandardSummaryStripItems,
} from "@/components/admin/entity";
import { ADMIN_FIELD_LABEL, adminResearchAiFieldGridClass } from "@/lib/admin/entitySchema";

type EditableFinalValues = ResearchBestGuess;

const EMPTY_FINAL_VALUES: EditableFinalValues = {
  title: null,
  start_date: null,
  end_date: null,
  start_time: null,
  end_time: null,
  city: null,
  location: null,
  description: null,
  description_short: null,
  slug: null,
  organizers: [],
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
  | "category"
  | "location_name"
  | "address"
  | "description"
  | "website_url"
  | "facebook_url"
  | "instagram_url"
  | "ticket_url"
  | "hero_image";

const AI_EDITABLE_TEXT_FIELDS: Array<{
  key: Exclude<AiEditableStringField, "description">;
  labelKey: keyof typeof ADMIN_FIELD_LABEL;
  placeholder?: string;
  type?: "text" | "date" | "url";
}> = [
  { key: "title", labelKey: "title" },
  { key: "start_date", labelKey: "startDate", placeholder: "dd/mm/yyyy", type: "text" },
  { key: "end_date", labelKey: "endDate", placeholder: "dd/mm/yyyy", type: "text" },
  { key: "city", labelKey: "city" },
  { key: "category", labelKey: "category" },
  { key: "location_name", labelKey: "locationName" },
  { key: "address", labelKey: "address" },
  { key: "website_url", labelKey: "websiteUrl", type: "url" },
  { key: "facebook_url", labelKey: "facebookUrl", type: "url" },
  { key: "instagram_url", labelKey: "instagramUrl", type: "url" },
  { key: "ticket_url", labelKey: "ticketUrl", type: "url" },
  { key: "hero_image", labelKey: "heroImage", type: "url" },
];

const AI_MAIN_KEYS = new Set<AiEditableStringField>(["title", "category"]);
const AI_DATE_KEYS = new Set<AiEditableStringField>(["start_date", "end_date"]);
const AI_LOC_KEYS = new Set<AiEditableStringField>(["city", "location_name", "address"]);
const AI_LINK_KEYS = new Set<AiEditableStringField>(["website_url", "facebook_url", "instagram_url", "ticket_url"]);
const AI_MEDIA_KEYS = new Set<AiEditableStringField>(["hero_image"]);

/** Client-side keys aligned with server metadata (create-pending, research routes). */
const RESEARCH_PROVIDER_PERPLEXITY = "perplexity";
const RESEARCH_PROVIDER_GEMINI = "gemini_pipeline";

function sanitizeInputValue(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDisplayDateToIso(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = parseFlexibleDateToIso(trimmed);
  if (parsed === "") return null;
  if (parsed !== null) return parsed;

  return trimmed;
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

function shortText(value: string, max = 72) {
  const t = value.trim();
  if (!t) return "—";
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function renderAiFieldsForKeys(
  keys: Set<AiEditableStringField>,
  aiDraft: PerplexityFestivalResearchResult,
  setAiDraftField: (field: AiEditableStringField, rawValue: string) => void,
) {
  return AI_EDITABLE_TEXT_FIELDS.filter((f) => keys.has(f.key)).map((field) => {
    const control =
      field.key === "start_date" || field.key === "end_date" ? (
        <DdMmYyyyDateInput
          value={aiDraft[field.key] ?? ""}
          onChange={(iso) => setAiDraftField(field.key, iso)}
          placeholder={field.placeholder}
          className={ADMIN_ENTITY_CONTROL_CLASS}
        />
      ) : (
        <input
          type={field.type ?? "text"}
          value={aiDraft[field.key] ?? ""}
          onChange={(event) => setAiDraftField(field.key, event.target.value)}
          placeholder={field.placeholder}
          className={ADMIN_ENTITY_CONTROL_CLASS}
        />
      );
    const heroHint =
      field.key === "hero_image" ? (
        <p className="mt-1 text-xs text-black/50">
          If you paste an image URL, it is downloaded and stored in Supabase when you create the draft; the external link is not kept.
        </p>
      ) : null;
    const inline = adminEntityUsesInlineLayout(field.labelKey);
    return (
      <div key={field.key} className={adminResearchAiFieldGridClass(field.key)}>
        {inline ? (
          <>
            <AdminFieldInlineRow field={field.labelKey}>{control}</AdminFieldInlineRow>
            {heroHint}
          </>
        ) : (
          <label>
            <AdminFieldLabel field={field.labelKey} />
            {control}
            {heroHint}
          </label>
        )}
      </div>
    );
  });
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

  const summaryEyebrow = "Admin · Research festival";

  const summaryTitle = useMemo(() => {
    if (aiDraft?.title?.trim()) return aiDraft.title.trim();
    if (finalValues.title?.trim()) return finalValues.title.trim();
    return "Research Festival";
  }, [aiDraft, finalValues.title]);

  const summaryItems = useMemo(() => {
    if (aiDraft) {
      const org =
        aiDraft.organizer_names?.find((x) => (x ?? "").trim())?.trim() ??
        aiDraft.organizer_name?.trim() ??
        "—";
      return buildStandardSummaryStripItems({
        status: `Confidence: ${confidenceLabel(aiDraft.confidence)}`,
        sourceLine: shortText(aiDraft.source_urls[0] ?? "—"),
        city: aiDraft.city?.trim() || "—",
        startDate: shortText(aiDraft.start_date ?? "—", 24),
        organizer: shortText(org, 48),
        contextLabel: ADMIN_FIELD_LABEL.pipeline,
        contextValue: getAIProviderLabel(RESEARCH_PROVIDER_PERPLEXITY),
      });
    }
    if (result) {
      const org =
        finalValues.organizers?.find((o) => o.trim())?.trim() ?? finalValues.organizer?.trim() ?? "—";
      return buildStandardSummaryStripItems({
        status: String(result.confidence.overall ?? "—"),
        sourceLine: shortText(sourceSummary || "—"),
        city: finalValues.city?.trim() || "—",
        startDate: shortText(finalValues.start_date ?? "—", 24),
        organizer: shortText(org, 48),
        contextLabel: ADMIN_FIELD_LABEL.pipeline,
        contextValue: getAIProviderLabel(RESEARCH_PROVIDER_GEMINI),
      });
    }
    return buildStandardSummaryStripItems({
      status: "—",
      sourceLine: "—",
      city: "—",
      startDate: "—",
      organizer: "—",
      contextLabel: ADMIN_FIELD_LABEL.pipeline,
      contextValue: "—",
    });
  }, [aiDraft, result, finalValues, sourceSummary]);

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
        throw new Error(payload?.error ?? `${getAIProviderLabel(RESEARCH_PROVIDER_PERPLEXITY)} research request failed.`);
      }

      setAiResult(payload.result);
      const r = payload.result;
      const names =
        Array.isArray(r.organizer_names) && r.organizer_names.length > 0
          ? r.organizer_names.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          : r.organizer_name
            ? [r.organizer_name]
            : [];
      setAiDraft({ ...r, organizer_names: names.length > 0 ? names : null });
      setResult(null);
      setAiSuccess(
        `${getAIProviderLabel(RESEARCH_PROVIDER_PERPLEXITY)} research completed. Review and edit values before creating a pending draft.`,
      );
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : `Unexpected error while running ${getAIProviderLabel(RESEARCH_PROVIDER_PERPLEXITY)} research.`,
      );
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

  let summaryActions: ReactNode = null;
  if (aiDraft) {
    summaryActions = (
      <>
        <button
          type="button"
          onClick={createPendingFestival}
          disabled={!canCreate}
          className="rounded-xl border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isCreating ? "Creating..." : "Create pending draft"}
        </button>
        <button
          type="button"
          onClick={runAiResearch}
          disabled={!canAiResearch}
          className="rounded-xl bg-[#0c0e14] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isAiResearching
            ? "Researching..."
            : `Research again (${getAIProviderLabel(RESEARCH_PROVIDER_PERPLEXITY)})`}
        </button>
      </>
    );
  } else if (result) {
    summaryActions = (
      <button
        type="button"
        onClick={createPendingFestival}
        disabled={!canCreate}
        className="rounded-xl border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-45"
      >
        {isCreating ? "Creating..." : "Create pending festival"}
      </button>
    );
  }

  const appendOrganizerCandidate = (value: string) => {
    const v = value.trim();
    if (!v) return;
    setFinalValues((prev) => {
      const list = [...(prev.organizers ?? [])];
      if (list.some((x) => x.toLowerCase() === v.toLowerCase())) return prev;
      list.push(v);
      return { ...prev, organizers: list, organizer: list[0] ?? null };
    });
  };

  const renderTextCandidates = (field: keyof EditableFinalValues, candidates: ResearchFieldCandidate[]) => {
    if (candidates.length === 0) {
      return <p className="text-xs text-black/50">No alternatives extracted for this field.</p>;
    }

    return (
      <div className="mt-1.5 flex flex-wrap gap-2">
        {candidates.map((candidate, index) => (
          <button
            key={`${field}-${candidate.value}-${candidate.source_url}-${index}`}
            type="button"
            onClick={() => (field === "organizers" ? appendOrganizerCandidate(candidate.value) : setFromCandidate(field, candidate.value))}
            className="rounded-lg border border-black/[0.1] bg-white px-2 py-1 text-left text-xs hover:bg-black/[0.03]"
          >
            <div className="font-medium">{candidate.value}</div>
            <div className="text-black/55">
              {candidate.tier ?? "unknown tier"} • {candidate.language ?? "unknown lang"}
            </div>
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
      <div className="mt-1.5 flex flex-wrap gap-2">
        {candidates.map((candidate, index) => (
          <button
            key={`${candidate.start_date}-${candidate.end_date}-${candidate.source_url}-${index}`}
            type="button"
            onClick={() => setFinalValues((prev) => ({ ...prev, start_date: candidate.start_date, end_date: candidate.end_date }))}
            className="rounded-lg border border-black/[0.1] bg-white px-2 py-1 text-left text-xs hover:bg-black/[0.03]"
          >
            <div className="font-medium">{candidate.label ?? `${candidate.start_date ?? "?"} → ${candidate.end_date ?? "?"}`}</div>
            <div className="text-black/55">
              {candidate.tier ?? "unknown tier"} • {candidate.language ?? "unknown lang"}
            </div>
          </button>
        ))}
      </div>
    );
  };

  return (
    <AdminEntityPageShell>
      <AdminSummaryStrip title={summaryTitle} eyebrow={summaryEyebrow} items={summaryItems} actions={summaryActions} />

      <AdminFieldSection
        title={ADMIN_ENTITY_SECTION.researchQueries.title}
        description={`Run ${getAIProviderLabel(RESEARCH_PROVIDER_PERPLEXITY)} extraction or the ${getAIProviderLabel(RESEARCH_PROVIDER_GEMINI)} pipeline.`}
        variant={ADMIN_ENTITY_SECTION.researchQueries.variant}
      >
        <div className="space-y-2">
          <div className="space-y-1.5">
            <label htmlFor="ai-research-query" className="text-xs font-semibold uppercase tracking-[0.14em] text-black/55">
              Search query ({getAIProviderLabel(RESEARCH_PROVIDER_PERPLEXITY)})
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                id="ai-research-query"
                value={aiQuery}
                onChange={(event) => setAiQuery(event.target.value)}
                placeholder="сурва 2026"
                className={ADMIN_ENTITY_CONTROL_CLASS}
              />
              <button
                type="button"
                onClick={runAiResearch}
                disabled={!canAiResearch}
                className="h-8 shrink-0 rounded-lg bg-[#0c0e14] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isAiResearching ? "Researching..." : `Research (${getAIProviderLabel(RESEARCH_PROVIDER_PERPLEXITY)})`}
              </button>
            </div>
            {aiError ? <p className="rounded-xl border border-[#c23c1f]/25 bg-[#fff4ef] px-3 py-2 text-sm text-[#b13a1a]">{aiError}</p> : null}
            {aiSuccess ? <p className="rounded-xl border border-[#0e7a45]/20 bg-[#f0fbf4] px-3 py-2 text-sm text-[#0e7a45]">{aiSuccess}</p> : null}
          </div>

          <div className="h-px bg-black/[0.08]" />

          <div className="space-y-1.5">
            <label htmlFor="research-query" className="text-xs font-semibold uppercase tracking-[0.14em] text-black/55">
              Festival query ({getAIProviderLabel(RESEARCH_PROVIDER_GEMINI)})
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                id="research-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Сурва 2026"
                className={ADMIN_ENTITY_CONTROL_CLASS}
              />
              <button
                type="button"
                onClick={runResearch}
                disabled={!canResearch}
                className="h-8 shrink-0 rounded-lg border border-black/[0.1] bg-white px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isResearching ? "Researching..." : `Research (${getAIProviderLabel(RESEARCH_PROVIDER_GEMINI)})`}
              </button>
            </div>
          </div>
        </div>
      </AdminFieldSection>

      {aiDraft ? (
        <>
          <AdminFieldSection
            title={ADMIN_ENTITY_SECTION.mainInfo.title}
            description={`Confidence reflects extraction certainty for the ${getAIProviderLabel(RESEARCH_PROVIDER_PERPLEXITY)} pass.`}
            variant={ADMIN_ENTITY_SECTION.mainInfo.variant}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${confidenceBadgeStyle(aiDraft.confidence)}`}>
                Confidence: {confidenceLabel(aiDraft.confidence)}
              </span>
              <span className="text-xs text-black/55">{aiResult?.source_urls.length ?? 0} source(s) reviewed</span>
            </div>
            <AdminFieldGrid className="mt-1.5">{renderAiFieldsForKeys(AI_MAIN_KEYS, aiDraft, setAiDraftField)}</AdminFieldGrid>
          </AdminFieldSection>

          <AdminFieldSection title={ADMIN_ENTITY_SECTION.dateTime.title} variant={ADMIN_ENTITY_SECTION.dateTime.variant}>
            <AdminFieldGrid>{renderAiFieldsForKeys(AI_DATE_KEYS, aiDraft, setAiDraftField)}</AdminFieldGrid>
          </AdminFieldSection>

          <AdminFieldSection title={ADMIN_ENTITY_SECTION.location.title} variant={ADMIN_ENTITY_SECTION.location.variant}>
            <AdminFieldGrid>{renderAiFieldsForKeys(AI_LOC_KEYS, aiDraft, setAiDraftField)}</AdminFieldGrid>
          </AdminFieldSection>

          <AdminFieldSection title={ADMIN_ENTITY_SECTION.organizer.title} variant={ADMIN_ENTITY_SECTION.organizer.variant}>
            <AdminFieldLabel
              field={
                (aiDraft.organizer_names?.filter((x) => (x ?? "").trim()).length ?? 0) <= 1 &&
                !(aiDraft.organizer_name && !aiDraft.organizer_names?.length)
                  ? "organizerName"
                  : "organizers"
              }
            />
            <div className="mt-1 space-y-1.5">
              {(aiDraft.organizer_names?.length
                ? aiDraft.organizer_names
                : aiDraft.organizer_name
                  ? [aiDraft.organizer_name]
                  : [""]
              ).map((org, index) => (
                <input
                  key={`ai-org-${index}`}
                  value={org ?? ""}
                  onChange={(e) => {
                    setAiDraft((prev) => {
                      if (!prev) return prev;
                      const base = prev.organizer_names?.length
                        ? [...prev.organizer_names]
                        : prev.organizer_name
                          ? [prev.organizer_name]
                          : [""];
                      base[index] = e.target.value;
                      return { ...prev, organizer_names: base, organizer_name: base.find((x) => x?.trim())?.trim() ?? null };
                    });
                  }}
                  className={ADMIN_ENTITY_CONTROL_CLASS}
                />
              ))}
              <button
                type="button"
                onClick={() =>
                  setAiDraft((prev) => {
                    if (!prev) return prev;
                    const base = prev.organizer_names?.length
                      ? [...prev.organizer_names]
                      : prev.organizer_name
                        ? [prev.organizer_name]
                        : [];
                    return { ...prev, organizer_names: [...base, ""] };
                  })
                }
                className="text-xs font-semibold text-[#0e7a45]"
              >
                + Добави организатор
              </button>
            </div>
          </AdminFieldSection>

          <AdminFieldSection
            title={ADMIN_ENTITY_SECTION.linksSources.title}
            description={`Evidence URLs from the ${getAIProviderLabel(RESEARCH_PROVIDER_PERPLEXITY)} pass.`}
            variant={ADMIN_ENTITY_SECTION.linksSources.variant}
          >
            <AdminFieldGrid>{renderAiFieldsForKeys(AI_LINK_KEYS, aiDraft, setAiDraftField)}</AdminFieldGrid>
            <div className="mt-2 space-y-1.5 border-t border-black/[0.06] pt-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">{ADMIN_FIELD_LABEL.sourceUrl}s</p>
              {aiDraft.source_urls.length === 0 ? (
                <p className="text-sm text-black/60">No sources returned.</p>
              ) : (
                <div className="space-y-1.5">
                  {aiDraft.source_urls.map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-lg border border-black/[0.1] bg-white p-2 hover:bg-black/[0.02]"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-black/45">{getDomainLabel(url)}</p>
                      <p className="mt-1 break-all text-sm text-[#0e7a45] underline-offset-2 hover:underline">{url}</p>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </AdminFieldSection>

          <AdminFieldSection title={ADMIN_ENTITY_SECTION.media.title} variant={ADMIN_ENTITY_SECTION.media.variant}>
            <AdminFieldGrid>{renderAiFieldsForKeys(AI_MEDIA_KEYS, aiDraft, setAiDraftField)}</AdminFieldGrid>
          </AdminFieldSection>

          <AdminFieldSection
            title={ADMIN_ENTITY_SECTION.descriptionContent.title}
            description="Warnings from the model about missing important fields."
            variant={ADMIN_ENTITY_SECTION.descriptionContent.variant}
          >
            <label>
              <AdminFieldLabel field="description" />
            <textarea
              value={aiDraft.description ?? ""}
              onChange={(event) => setAiDraftField("description", event.target.value)}
              rows={5}
              className={ADMIN_ENTITY_TEXTAREA_CLASS}
            />
            </label>
            <label className="mt-2 flex items-center gap-2 rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-sm">
              <input
                type="checkbox"
                checked={aiDraft.is_free === true}
                onChange={(event) => setAiDraft((prev) => (prev ? { ...prev, is_free: event.target.checked ? true : null } : prev))}
                className="h-4 w-4 rounded border-black/20"
              />
              Festival is free
            </label>
            <div className="mt-2 space-y-1.5">
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
          </AdminFieldSection>
        </>
      ) : null}

      {error ? <p className="rounded-xl border border-[#c23c1f]/25 bg-[#fff4ef] px-3 py-2 text-sm text-[#b13a1a]">{error}</p> : null}
      {success ? <p className="rounded-xl border border-[#0e7a45]/20 bg-[#f0fbf4] px-3 py-2 text-sm text-[#0e7a45]">{success}</p> : null}

      {!aiDraft && !result ? (
        <p className="text-sm text-black/55">
          No extraction result yet. Run {getAIProviderLabel(RESEARCH_PROVIDER_PERPLEXITY)} research or the{" "}
          {getAIProviderLabel(RESEARCH_PROVIDER_GEMINI)} pipeline to preview festival data.
        </p>
      ) : null}

      {result ? (
        <>
          <AdminFieldSection
            title={ADMIN_ENTITY_SECTION.mainInfo.title}
            description="Best guess and alternative title candidates."
            variant={ADMIN_ENTITY_SECTION.mainInfo.variant}
          >
            <AdminFieldGrid>
              <div className="md:col-span-2">
                <label>
                  <AdminFieldLabel field="title" />
                <input
                  value={finalValues.title ?? ""}
                  onChange={(e) => setFromCandidate("title", e.target.value || null)}
                  className={ADMIN_ENTITY_CONTROL_CLASS}
                />
                {renderTextCandidates("title", result.candidates.titles)}
                </label>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">{ADMIN_FIELD_LABEL.confidence}</p>
                <p className="mt-1 text-sm font-medium text-black/80">{result.confidence.overall}</p>
              </div>
            </AdminFieldGrid>
          </AdminFieldSection>

          <AdminFieldSection title={ADMIN_ENTITY_SECTION.dateTime.title} variant={ADMIN_ENTITY_SECTION.dateTime.variant}>
            <AdminFieldGrid>
              <div>
                <AdminFieldInlineRow field="startDate">
                  <DdMmYyyyDateInput
                    value={finalValues.start_date ?? ""}
                    onChange={(iso) => setFromCandidate("start_date", iso || null)}
                    className={ADMIN_ENTITY_CONTROL_CLASS}
                  />
                </AdminFieldInlineRow>
              </div>
              <div>
                <AdminFieldInlineRow field="endDate">
                  <DdMmYyyyDateInput
                    value={finalValues.end_date ?? ""}
                    onChange={(iso) => setFromCandidate("end_date", iso || null)}
                    className={ADMIN_ENTITY_CONTROL_CLASS}
                  />
                </AdminFieldInlineRow>
              </div>
            </AdminFieldGrid>
            <div className="mt-2">{renderDateCandidates(result.candidates.dates)}</div>
          </AdminFieldSection>

          <AdminFieldSection title={ADMIN_ENTITY_SECTION.location.title} variant={ADMIN_ENTITY_SECTION.location.variant}>
            <AdminFieldGrid>
              <div className="md:col-span-2">
                <AdminFieldInlineRow field="city">
                  <input
                    value={finalValues.city ?? ""}
                    onChange={(e) => setFromCandidate("city", e.target.value || null)}
                    className={ADMIN_ENTITY_CONTROL_CLASS}
                  />
                </AdminFieldInlineRow>
                {renderTextCandidates("city", result.candidates.cities)}
              </div>
              <div className="md:col-span-2">
                <label>
                  <AdminFieldLabel field="locationName" />
                <input
                  value={finalValues.location ?? ""}
                  onChange={(e) => setFromCandidate("location", e.target.value || null)}
                  className={ADMIN_ENTITY_CONTROL_CLASS}
                />
                {renderTextCandidates("location", result.candidates.locations)}
                </label>
              </div>
            </AdminFieldGrid>
          </AdminFieldSection>

          <AdminFieldSection title={ADMIN_ENTITY_SECTION.organizer.title} variant={ADMIN_ENTITY_SECTION.organizer.variant}>
            <AdminFieldLabel
              field={(finalValues.organizers?.filter((o) => o.trim()).length ?? 0) <= 1 ? "organizerName" : "organizers"}
            />
            <div className="mt-1 space-y-1.5">
              {(finalValues.organizers?.length ? finalValues.organizers : [""]).map((org, index) => (
                <input
                  key={`gemini-org-${index}`}
                  value={org}
                  onChange={(e) => {
                    const base = [...(finalValues.organizers ?? [""])];
                    base[index] = e.target.value;
                    setFinalValues((prev) => ({
                      ...prev,
                      organizers: base,
                      organizer: base.find((x) => x.trim())?.trim() ?? null,
                    }));
                  }}
                  className={ADMIN_ENTITY_CONTROL_CLASS}
                />
              ))}
              <button
                type="button"
                onClick={() => setFinalValues((prev) => ({ ...prev, organizers: [...(prev.organizers ?? []), ""] }))}
                className="text-xs font-semibold text-[#0e7a45]"
              >
                + Добави организатор
              </button>
            </div>
            {renderTextCandidates("organizers", result.candidates.organizers)}
          </AdminFieldSection>

          <AdminFieldSection title={ADMIN_ENTITY_SECTION.linksSources.title} variant={ADMIN_ENTITY_SECTION.linksSources.variant}>
            <p className="text-sm text-black/75">
              <span className="font-semibold">{ADMIN_FIELD_LABEL.sourceUrl}:</span> {sourceSummary}
            </p>
          </AdminFieldSection>

          <AdminFieldSection
            title={ADMIN_ENTITY_SECTION.systemMeta.title}
            description={`${getAIProviderLabel(RESEARCH_PROVIDER_GEMINI)} pipeline diagnostics.`}
            variant={ADMIN_ENTITY_SECTION.systemMeta.variant}
          >
            <div className="space-y-1 text-sm text-black/80">
              <p>
                <span className="font-semibold">Provider:</span> {result.metadata?.provider ?? "-"}
              </p>
              <p>
                <span className="font-semibold">Mode:</span> {result.metadata?.mode ?? "-"}
              </p>
              <p>
                <span className="font-semibold">Source count:</span> {result.metadata?.source_count ?? result.sources.length}
              </p>
            </div>
          </AdminFieldSection>
        </>
      ) : null}
    </AdminEntityPageShell>
  );
}
