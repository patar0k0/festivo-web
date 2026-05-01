"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ResearchBestGuess, ResearchDateCandidate, ResearchFestivalResult, ResearchFieldCandidate } from "@/lib/admin/research/types";
import ProgramDraftEditor from "@/components/admin/ProgramDraftEditor";
import { emptyProgramDraft, programDraftHasContent } from "@/lib/festival/programDraft";
import DdMmYyyyDateInput from "@/components/ui/DdMmYyyyDateInput";
import { parseFlexibleDateToIso } from "@/lib/dates/euDateFormat";
import type {
  AdminFestivalSearchHit,
  AiResearchConfidence,
  FestivalResearchReport,
  PerplexityFestivalResearchResult,
} from "@/lib/research/perplexity";
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
  program_draft: null,
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

const RESEARCH_DEBUG_SECTION =
  "text-[10px] font-semibold uppercase tracking-[0.14em] text-black/50 border-b border-black/[0.08] pb-1 mb-2";

function ResearchPipelineDebugReport({ report }: { report: FestivalResearchReport }) {
  const discovery = report.discovery;
  const hasStructured = Boolean(discovery?.ranked?.length);

  if (!hasStructured) {
    return (
      <div className="space-y-2 text-xs text-black/70">
        <p className="whitespace-pre-wrap leading-relaxed">{report.confidence_reasoning}</p>
        {report.agreement_notes.length > 0 ? (
          <ul className="list-disc space-y-0.5 pl-4">
            {report.agreement_notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : null}
        <ul className="list-disc space-y-0.5 pl-4">
          {report.merge_summary_lines.map((line) => (
            <li key={line} className="break-words">
              {line}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const formatDateLine = (start: string | null, end: string | null) => {
    if (!start && !end) return "—";
    if (start && end && start !== end) return `${start} → ${end}`;
    return start ?? end ?? "—";
  };

  return (
    <div className="space-y-4 text-xs text-black/75">
      <section>
        <h4 className={RESEARCH_DEBUG_SECTION}>DISCOVERY</h4>
        <p className="mb-1 font-medium text-black/80">Query used</p>
        <ul className="mb-2 list-inside list-decimal space-y-0.5 pl-1 text-black/70">
          {discovery!.queries.map((q) => (
            <li key={q} className="break-words">
              {q}
            </li>
          ))}
        </ul>
        <p className="mb-1 font-medium text-black/80">URLs returned (ranked)</p>
        <ul className="space-y-1.5">
          {discovery!.ranked.map((row) => (
            <li key={`${row.rank}-${row.url}`} className="rounded-md border border-black/[0.06] bg-white px-2 py-1.5">
              <span className="font-mono text-[10px] text-black/45">#{row.rank}</span>{" "}
              <span className="font-medium text-black/65">{row.source_type}</span>
              <p className="mt-0.5 break-all text-[11px] text-[#0e7a45]">{row.url}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h4 className={RESEARCH_DEBUG_SECTION}>EXTRACTION (per URL)</h4>
        <div className="space-y-3">
          {(report.extractions ?? []).map((row) => (
            <div key={row.url} className="rounded-lg border border-black/[0.08] bg-white p-2.5 shadow-sm">
              <p className="break-all font-mono text-[11px] font-semibold text-black/80">URL: {row.url}</p>
              <p className="mt-1">
                <span className="text-black/45">TYPE:</span>{" "}
                <span className="font-medium capitalize">{row.source_type}</span>
                {" · "}
                <span className="text-black/45">FETCH:</span>{" "}
                <span className="font-medium">{row.fetch}</span>
                {row.similarity != null ? (
                  <>
                    {" · "}
                    <span className="text-black/45">SIM:</span> {row.similarity}
                  </>
                ) : null}
                {row.used_in_merge ? (
                  <span className="ml-2 rounded bg-[#0e7a45]/12 px-1.5 py-0.5 text-[10px] font-semibold text-[#0e7a45]">
                    used in merge
                  </span>
                ) : null}
              </p>
              <div className="mt-2 border-t border-black/[0.06] pt-2 text-black/70">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-black/45">DATA</p>
                <ul className="mt-1 list-none space-y-0.5">
                  <li>
                    <span className="text-black/45">title:</span> {row.title ? shortText(row.title, 120) : "—"}
                  </li>
                  <li>
                    <span className="text-black/45">date:</span> {formatDateLine(row.start_date, row.end_date)}
                  </li>
                  <li>
                    <span className="text-black/45">city:</span> {row.city ?? "—"}
                  </li>
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {(report.rejected_sources ?? []).length > 0 ? (
        <section>
          <h4 className={RESEARCH_DEBUG_SECTION}>REJECTED SOURCES</h4>
          <ul className="space-y-2">
            {(report.rejected_sources ?? []).map((r) => (
              <li key={`${r.url}-${r.reason}`} className="rounded-md border border-red-200/80 bg-red-50/50 px-2 py-1.5">
                <p className="break-all font-mono text-[11px] text-black/85">{r.url}</p>
                <p className="mt-1">
                  <span className="font-semibold text-red-900/90">reason:</span>{" "}
                  <code className="rounded bg-red-100/80 px-1 py-0.5 text-[10px]">{r.reason}</code>
                </p>
                {r.detail ? <p className="mt-1 text-[11px] text-black/60">{r.detail}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {report.merge_result ? (
        <section>
          <h4 className={RESEARCH_DEBUG_SECTION}>MERGE RESULT</h4>
          <ul className="space-y-2 rounded-md border border-black/[0.06] bg-white p-2.5">
            <li>
              <span className="text-black/45">chosen title:</span>{" "}
              <span className="font-medium text-black/85">{report.merge_result.title ?? "—"}</span>
              {report.merge_result.title_from_urls.length > 0 ? (
                <p className="mt-0.5 pl-2 text-[10px] text-black/55">
                  from: {report.merge_result.title_from_urls.join(", ")}
                </p>
              ) : null}
            </li>
            <li>
              <span className="text-black/45">chosen date:</span>{" "}
              <span className="font-medium text-black/85">
                {formatDateLine(report.merge_result.start_date, report.merge_result.end_date)}
              </span>
              {report.merge_result.start_date_from_urls.length > 0 ? (
                <p className="mt-0.5 pl-2 text-[10px] text-black/55">
                  start from: {report.merge_result.start_date_from_urls.join(", ")}
                </p>
              ) : null}
              {report.merge_result.end_date_from_urls.length > 0 ? (
                <p className="mt-0.5 pl-2 text-[10px] text-black/55">
                  end from: {report.merge_result.end_date_from_urls.join(", ")}
                </p>
              ) : null}
            </li>
            <li>
              <span className="text-black/45">chosen city:</span>{" "}
              <span className="font-medium text-black/85">{report.merge_result.city ?? "—"}</span>
              {report.merge_result.city_from_urls.length > 0 ? (
                <p className="mt-0.5 pl-2 text-[10px] text-black/55">
                  from: {report.merge_result.city_from_urls.join(", ")}
                </p>
              ) : null}
            </li>
            {report.merge_result.merge_fallback_used ? (
              <li className="rounded bg-amber-50/90 px-2 py-1 text-[11px] text-amber-950/90">
                Merge fallback: {report.merge_result.merge_fallback_note ?? "Similarity thresholds relaxed."}
              </li>
            ) : null}
            {report.merge_result.lock_notes.length > 0 ? (
              <li>
                <span className="text-black/45">lock notes:</span>
                <ul className="mt-0.5 list-disc pl-4 text-[11px] text-black/65">
                  {report.merge_result.lock_notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}

      <section>
        <h4 className={RESEARCH_DEBUG_SECTION}>CONFIDENCE</h4>
        {report.confidence_debug ? (
          <>
            <p className="mb-2 font-semibold capitalize text-black/85">
              {report.confidence_debug.level} because:
            </p>
            <ul className="list-disc space-y-1 pl-4 text-black/70">
              {report.confidence_debug.bullets.map((b) => (
                <li key={b} className="leading-relaxed">
                  {b}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-black/70">Confidence tier: {report.confidence_reasoning}</p>
        )}
        <p className="mt-2 border-t border-black/[0.06] pt-2 text-[11px] text-black/55">
          {report.confidence_reasoning}
        </p>
      </section>

      {(report.pipeline_errors ?? []).length > 0 ? (
        <section>
          <h4 className={RESEARCH_DEBUG_SECTION}>ERRORS</h4>
          <ul className="space-y-2">
            {(report.pipeline_errors ?? []).map((err, i) => (
              <li key={`${err.message}-${i}`} className="rounded-md border border-amber-200/90 bg-amber-50/60 px-2 py-1.5">
                <p className="font-semibold text-amber-950/90">ERROR</p>
                {err.url ? <p className="break-all font-mono text-[11px] text-black/75">{err.url}</p> : null}
                <p className="mt-1 text-[11px] text-black/70">{err.message}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {report.completeness ? (
        <p className="text-[11px] text-black/60">
          Completeness (key fields): merged {report.completeness.merged}/6 — best single source{" "}
          {report.completeness.best_single_source}/6.
        </p>
      ) : null}

      {report.agreement_notes.length > 0 ? (
        <section>
          <h4 className={RESEARCH_DEBUG_SECTION}>SOURCE AGREEMENT (raw)</h4>
          <ul className="list-disc space-y-0.5 pl-4">
            {report.agreement_notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <details className="rounded-md border border-black/[0.06] bg-black/[0.02] px-2 py-1.5">
        <summary className="cursor-pointer text-[11px] font-medium text-black/60">Technical merge log</summary>
        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[11px] text-black/55">
          {report.merge_summary_lines.map((line) => (
            <li key={line} className="break-words">
              {line}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
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
          visualVariant="dots"
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

  const [pipelineJobId, setPipelineJobId] = useState<string | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<string | null>(null);
  const [pipelinePendingId, setPipelinePendingId] = useState<string | null>(null);

  const [sourceSearchQuery, setSourceSearchQuery] = useState("");
  const [sourceHits, setSourceHits] = useState<AdminFestivalSearchHit[]>([]);
  const [sourceSearchLoading, setSourceSearchLoading] = useState(false);
  const [sourceSearchError, setSourceSearchError] = useState("");
  const [previewHit, setPreviewHit] = useState<AdminFestivalSearchHit | null>(null);
  const [previewExtract, setPreviewExtract] = useState<PerplexityFestivalResearchResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [selectingUrl, setSelectingUrl] = useState<string | null>(null);

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

  const applyExtractionToAiDraft = (r: PerplexityFestivalResearchResult, successMessage?: string) => {
    setAiError("");
    setAiResult(r);
    const names =
      Array.isArray(r.organizer_names) && r.organizer_names.length > 0
        ? r.organizer_names.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        : r.organizer_name
          ? [r.organizer_name]
          : [];
    setAiDraft({ ...r, organizer_names: names.length > 0 ? names : null });
    setResult(null);
    setPipelineJobId(null);
    setPipelineStatus(null);
    setPipelinePendingId(null);
    if (successMessage) {
      setAiSuccess(successMessage);
    }
  };

  const runSourceSearch = async () => {
    const q = sourceSearchQuery.trim();
    if (!q) return;
    setSourceSearchError("");
    setSourceSearchLoading(true);
    setSourceHits([]);
    setPreviewHit(null);
    setPreviewExtract(null);
    setPreviewError("");
    try {
      const res = await fetch(`/admin/api/search?q=${encodeURIComponent(q)}`);
      const payload = (await res.json().catch(() => null)) as
        | { error?: string; search_results?: AdminFestivalSearchHit[] }
        | null;
      if (!res.ok || !payload?.search_results) {
        throw new Error(payload?.error ?? "Search failed.");
      }
      setSourceHits(payload.search_results);
      setAiQuery(q);
    } catch (e) {
      setSourceSearchError(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setSourceSearchLoading(false);
    }
  };

  const loadPreview = async (hit: AdminFestivalSearchHit) => {
    setPreviewHit(hit);
    setPreviewExtract(null);
    setPreviewError("");
    setPreviewLoading(true);
    try {
      const res = await fetch("/admin/api/research-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: hit.url,
          search_query_hint: sourceSearchQuery.trim() || undefined,
          snippet: hit.snippet ?? undefined,
        }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string; result?: PerplexityFestivalResearchResult } | null;
      if (!res.ok || !payload?.result) {
        throw new Error(payload?.error ?? "Preview extraction failed.");
      }
      setPreviewExtract(payload.result);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "Preview failed.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const selectFromHit = async (hit: AdminFestivalSearchHit) => {
    setAiError("");
    setSelectingUrl(hit.url);
    try {
      let r: PerplexityFestivalResearchResult;
      if (previewHit?.url === hit.url && previewExtract) {
        r = previewExtract;
      } else {
        const res = await fetch("/admin/api/research-from-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: hit.url,
            search_query_hint: sourceSearchQuery.trim() || undefined,
            snippet: hit.snippet ?? undefined,
          }),
        });
        const payload = (await res.json().catch(() => null)) as { error?: string; result?: PerplexityFestivalResearchResult } | null;
        if (!res.ok || !payload?.result) {
          throw new Error(payload?.error ?? "Extraction failed.");
        }
        r = payload.result;
      }
      applyExtractionToAiDraft(
        r,
        "Source selected: single-page extraction applied. Review confidence and missing fields, then send to pipeline.",
      );
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Select failed.");
    } finally {
      setSelectingUrl(null);
    }
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
      setPipelineJobId(null);
      setPipelineStatus(null);
      setPipelinePendingId(null);
      const bg = payload.result.best_guess ?? EMPTY_FINAL_VALUES;
      setFinalValues({ ...EMPTY_FINAL_VALUES, ...bg, program_draft: bg.program_draft ?? null });
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

      applyExtractionToAiDraft(
        payload.result,
        `${getAIProviderLabel(RESEARCH_PROVIDER_PERPLEXITY)} research completed. Review and edit values before sending to the ingest pipeline.`,
      );
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : `Unexpected error while running ${getAIProviderLabel(RESEARCH_PROVIDER_PERPLEXITY)} research.`,
      );
    } finally {
      setIsAiResearching(false);
    }
  };

  const sendToPipeline = async () => {
    if (!result && !aiDraft) return;

    setError("");
    setSuccess("");
    setAiError("");
    setAiSuccess("");
    setIsCreating(true);
    setPipelineJobId(null);
    setPipelineStatus(null);
    setPipelinePendingId(null);

    try {
      const normalizedAiDraft = aiDraft
        ? {
            ...aiDraft,
            start_date: normalizeDisplayDateToIso(aiDraft.start_date),
            end_date: normalizeDisplayDateToIso(aiDraft.end_date),
          }
        : null;

      const response = await fetch("/admin/api/ingest-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          normalizedAiDraft
            ? { source_type: "research", ai_result: normalizedAiDraft }
            : { source_type: "research", result, final_values: finalValues },
        ),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; id?: string; job_id?: string; status?: string }
        | null;
      const jobId = payload?.job_id ?? payload?.id;
      if (!response.ok || !jobId) {
        throw new Error(payload?.error ?? "Failed to enqueue ingest job.");
      }

      setPipelineJobId(jobId);
      setPipelineStatus(payload?.status ?? "pending");

      const message = `Ingest job ${jobId} queued. Status: ${payload?.status ?? "pending"} — the worker will create the pending festival.`;
      if (aiDraft) {
        setAiSuccess(message);
      } else {
        setSuccess(message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error while enqueueing ingest job.";
      if (aiDraft) {
        setAiError(message);
      } else {
        setError(message);
      }
    } finally {
      setIsCreating(false);
    }
  };

  useEffect(() => {
    if (!pipelineJobId) return;

    let cancelled = false;

    const tick = async () => {
      const res = await fetch(`/admin/api/ingest-jobs/${pipelineJobId}`);
      const body = (await res.json().catch(() => null)) as { job?: { status?: string; pending_festival_id?: string | null } } | null;
      if (cancelled || !body?.job) return;

      const job = body.job;
      setPipelineStatus(typeof job.status === "string" ? job.status : null);
      setPipelinePendingId(job.pending_festival_id ?? null);

      if (job.status === "done" && job.pending_festival_id) {
        router.push(`/admin/pending-festivals/${job.pending_festival_id}`);
      }
    };

    void tick();
    const iv = setInterval(() => void tick(), 2000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [pipelineJobId, router]);

  const pipelineStatusBadge =
    pipelineJobId && pipelineStatus ? (
      <span
        className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
          pipelineStatus === "done"
            ? "border-[#0e7a45]/30 bg-[#f0fbf4] text-[#0e7a45]"
            : pipelineStatus === "failed"
              ? "border-[#c23c1f]/30 bg-[#fff4ef] text-[#b13a1a]"
              : pipelineStatus === "processing"
                ? "border-[#9a6700]/30 bg-[#fffbeb] text-[#8a5d00]"
                : "border-black/10 bg-white text-black/60"
        }`}
        title={pipelinePendingId ? `Pending: ${pipelinePendingId}` : undefined}
      >
        Job {pipelineJobId.slice(0, 8)}… · {pipelineStatus}
      </span>
    ) : null;

  let summaryActions: ReactNode = null;
  if (aiDraft) {
    summaryActions = (
      <div className="flex flex-wrap items-center gap-2">
        {pipelineStatusBadge}
        <button
          type="button"
          onClick={sendToPipeline}
          disabled={!canCreate}
          className="rounded-xl border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isCreating ? "Sending..." : "Send to pipeline"}
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
      </div>
    );
  } else if (result) {
    summaryActions = (
      <div className="flex flex-wrap items-center gap-2">
        {pipelineStatusBadge}
        <button
          type="button"
          onClick={sendToPipeline}
          disabled={!canCreate}
          className="rounded-xl border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isCreating ? "Sending..." : "Send to pipeline"}
        </button>
      </div>
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
        description={`Search with ${getAIProviderLabel(RESEARCH_PROVIDER_PERPLEXITY)}, pick one URL to extract (controlled mode), or use multi-source / ${getAIProviderLabel(RESEARCH_PROVIDER_GEMINI)} below.`}
        variant={ADMIN_ENTITY_SECTION.researchQueries.variant}
      >
        <div className="grid gap-8 lg:grid-cols-[1fr_minmax(260px,340px)] xl:grid-cols-[1fr_minmax(280px,380px)]">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="source-web-search" className="text-xs font-semibold uppercase tracking-[0.14em] text-black/55">
                Search the web
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  id="source-web-search"
                  value={sourceSearchQuery}
                  onChange={(event) => setSourceSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void runSourceSearch();
                    }
                  }}
                  placeholder="Festival name, city, year…"
                  className={ADMIN_ENTITY_CONTROL_CLASS}
                />
                <button
                  type="button"
                  onClick={() => void runSourceSearch()}
                  disabled={sourceSearchQuery.trim().length === 0 || sourceSearchLoading}
                  className="h-8 shrink-0 rounded-lg bg-[#0c0e14] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {sourceSearchLoading ? "Searching…" : "Search"}
                </button>
              </div>
              {sourceSearchError ? (
                <p className="rounded-xl border border-[#c23c1f]/25 bg-[#fff4ef] px-3 py-2 text-sm text-[#b13a1a]">{sourceSearchError}</p>
              ) : null}
            </div>

            {sourceHits.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/45">Results</p>
                <ul className="space-y-3">
                  {sourceHits.map((hit, index) => {
                    const highlightFirst =
                      index === 0 &&
                      (hit.source_type === "facebook_event" ||
                        hit.url.toLowerCase().includes("event.bg") ||
                        hit.url.toLowerCase().includes("eventibg"));
                    const displayTitle = hit.title?.trim() || "Untitled result";
                    return (
                      <li
                        key={hit.url}
                        className={`rounded-xl border bg-white p-3 shadow-sm ${
                          highlightFirst ? "border-[#0e7a45]/40 ring-2 ring-[#0e7a45]/20" : "border-black/[0.08]"
                        }`}
                      >
                        <p className="text-base font-semibold text-[#1a0dab]">{displayTitle}</p>
                        <p className="mt-0.5 text-sm text-[#006621]">{getDomainLabel(hit.url)}</p>
                        <p className="mt-1 line-clamp-3 text-sm text-black/70">{hit.snippet ?? "—"}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void selectFromHit(hit)}
                            disabled={selectingUrl !== null}
                            className="rounded-lg bg-[#0c0e14] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            {selectingUrl === hit.url ? "Working…" : "Select"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void loadPreview(hit)}
                            disabled={previewLoading}
                            className="rounded-lg border border-black/[0.12] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            Preview
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-black/[0.08] bg-black/[0.02] p-4 lg:min-h-[220px]">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Preview</p>
            {!previewHit ? (
              <p className="mt-3 text-sm text-black/55">Choose a result and click Preview to extract fields from that URL.</p>
            ) : (
              <div className="mt-3 space-y-3 text-sm">
                {previewLoading ? <p className="text-black/60">Extracting…</p> : null}
                {previewError ? (
                  <p className="rounded-lg border border-[#c23c1f]/25 bg-[#fff4ef] px-2 py-1.5 text-xs text-[#b13a1a]">{previewError}</p>
                ) : null}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-black/45">URL</p>
                  <a
                    href={previewHit.url}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-[#0e7a45] underline-offset-2 hover:underline"
                  >
                    {previewHit.url}
                  </a>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-black/45">Title</p>
                  <p className="font-medium text-black/85">{previewExtract?.title ?? previewHit.title ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-black/45">Extracted</p>
                  <ul className="mt-1 list-none space-y-1 text-black/75">
                    <li>
                      <span className="text-black/45">date:</span>{" "}
                      {previewExtract ? (
                        <>
                          {previewExtract.start_date ?? "—"}
                          {previewExtract.end_date && previewExtract.end_date !== previewExtract.start_date
                            ? ` → ${previewExtract.end_date}`
                            : ""}
                        </>
                      ) : (
                        "—"
                      )}
                    </li>
                    <li>
                      <span className="text-black/45">city:</span> {previewExtract?.city ?? "—"}
                    </li>
                    <li>
                      <span className="text-black/45">location:</span> {previewExtract?.location_name ?? "—"}
                    </li>
                    <li>
                      <span className="text-black/45">description:</span>{" "}
                      <span className="line-clamp-4 whitespace-pre-wrap">{previewExtract?.description ?? "—"}</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-black/45">Raw snippet</p>
                  <p className="max-h-36 overflow-y-auto whitespace-pre-wrap rounded-md border border-black/[0.06] bg-white p-2 text-xs text-black/65">
                    {previewHit.snippet ?? "—"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 space-y-2">
          <div className="h-px bg-black/[0.08]" />
          <div className="space-y-1.5 pt-6">
            <label htmlFor="ai-research-query" className="text-xs font-semibold uppercase tracking-[0.14em] text-black/55">
              Multi-source merge ({getAIProviderLabel(RESEARCH_PROVIDER_PERPLEXITY)})
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
            description={
              aiDraft.research_report
                ? `Ranked URLs from ${getAIProviderLabel(RESEARCH_PROVIDER_PERPLEXITY)} discovery; form values are merged from fetched HTML (JSON-LD + Bulgarian date/location patterns).`
                : "Single URL (controlled mode): values come only from the page you selected—no multi-source merge."
            }
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
            {aiDraft.research_report ? (
              <details className="mt-3 rounded-lg border border-black/[0.08] bg-black/[0.02] p-3">
                <summary className="cursor-pointer text-sm font-semibold text-black/80">
                  Проследяване: discovery, извличане, отхвърляне, merge, увереност
                </summary>
                <div className="mt-3">
                  <ResearchPipelineDebugReport report={aiDraft.research_report} />
                </div>
              </details>
            ) : null}
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

      {aiDraft || result ? (
        <AdminFieldSection
          title="Програма и разписание"
          description="Разписание по часове и събития. Запазва се в черновата при създаване на pending."
          variant="default"
        >
          {aiDraft ? (
            <ProgramDraftEditor
              value={aiDraft.program_draft ?? emptyProgramDraft()}
              onChange={(next) => {
                const nextDraft = programDraftHasContent(next) ? next : null;
                setAiDraft((prev) => (prev ? { ...prev, program_draft: nextDraft } : prev));
              }}
            />
          ) : null}
          {result && !aiDraft ? (
            <ProgramDraftEditor
              value={finalValues.program_draft ?? emptyProgramDraft()}
              onChange={(next) => {
                const nextDraft = programDraftHasContent(next) ? next : null;
                setFinalValues((prev) => ({ ...prev, program_draft: nextDraft }));
              }}
            />
          ) : null}
        </AdminFieldSection>
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
                    visualVariant="dots"
                  />
                </AdminFieldInlineRow>
              </div>
              <div>
                <AdminFieldInlineRow field="endDate">
                  <DdMmYyyyDateInput
                    value={finalValues.end_date ?? ""}
                    onChange={(iso) => setFromCandidate("end_date", iso || null)}
                    className={ADMIN_ENTITY_CONTROL_CLASS}
                    visualVariant="dots"
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
