import type { SourceAuthorityTier } from "@/lib/admin/research/source-ranking";
import type { ResearchDateCandidate, ResearchEvidence, ResearchFieldCandidate, ResearchLanguageSignal } from "@/lib/admin/research/types";

export type LlmSourcePayload = {
  source_url: string;
  domain: string;
  title: string;
  tier: SourceAuthorityTier;
  language: ResearchLanguageSignal;
  text_excerpt: string;
};

export type LlmExtractInput = {
  query: string;
  normalized_query: string;
  sources: LlmSourcePayload[];
};

export type LlmExtractResult = {
  best_guess: {
    title: string | null;
    start_date: string | null;
    end_date: string | null;
    city: string | null;
    location: string | null;
    organizer: string | null;
    description: string | null;
    hero_image: string | null;
    tags: string[];
  };
  candidates: {
    titles: ResearchFieldCandidate[];
    dates: ResearchDateCandidate[];
    cities: ResearchFieldCandidate[];
    locations: ResearchFieldCandidate[];
    organizers: ResearchFieldCandidate[];
  };
  warnings: string[];
  evidence: ResearchEvidence[];
};

export function getLlmExtractionDiagnostics() {
  const apiKey = process.env.WEB_RESEARCH_LLM_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim() || "";
  return {
    enabled: Boolean(apiKey),
    model: process.env.WEB_RESEARCH_LLM_MODEL ?? "gpt-4o-mini",
    endpoint: process.env.WEB_RESEARCH_LLM_URL ?? "https://api.openai.com/v1/chat/completions",
  };
}

function normalizeText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeDate(value: unknown): string | null {
  const text = normalizeText(value);
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function parseJson(content: string): unknown {
  const cleaned = content.replace(/```json|```/gi, "").trim();
  return JSON.parse(cleaned);
}

function normalizeFieldCandidates(value: unknown): ResearchFieldCandidate[] {
  if (!Array.isArray(value)) return [];
  const out: ResearchFieldCandidate[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const valueText = normalizeText((item as { value?: unknown }).value);
    const sourceUrl = normalizeText((item as { source_url?: unknown }).source_url);
    if (!valueText || !sourceUrl) continue;
    out.push({
      value: valueText,
      source_url: sourceUrl,
      source_title: normalizeText((item as { source_title?: unknown }).source_title),
      tier: ((item as { tier?: unknown }).tier as SourceAuthorityTier) ?? null,
      language: ((item as { language?: unknown }).language as ResearchLanguageSignal) ?? null,
      confidence: ((item as { confidence?: unknown }).confidence as "high" | "medium" | "low") ?? null,
      reason: normalizeText((item as { reason?: unknown }).reason),
    });
  }
  return out;
}

function normalizeDateCandidates(value: unknown): ResearchDateCandidate[] {
  if (!Array.isArray(value)) return [];
  const out: ResearchDateCandidate[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const startDate = normalizeDate((item as { start_date?: unknown }).start_date);
    const endDate = normalizeDate((item as { end_date?: unknown }).end_date) ?? startDate;
    const sourceUrl = normalizeText((item as { source_url?: unknown }).source_url);
    if (!startDate || !endDate || !sourceUrl) continue;
    out.push({
      start_date: startDate,
      end_date: endDate,
      source_url: sourceUrl,
      source_title: normalizeText((item as { source_title?: unknown }).source_title),
      tier: ((item as { tier?: unknown }).tier as SourceAuthorityTier) ?? null,
      language: ((item as { language?: unknown }).language as ResearchLanguageSignal) ?? null,
      confidence: ((item as { confidence?: unknown }).confidence as "high" | "medium" | "low") ?? null,
      reason: normalizeText((item as { reason?: unknown }).reason),
      label: normalizeText((item as { label?: unknown }).label) ?? `${startDate} → ${endDate}`,
    });
  }
  return out;
}

function buildPrompt(input: LlmExtractInput): { system: string; user: string } {
  return {
    system:
      "You are a strict festival information extractor. Use ONLY supplied source text. Never invent facts. Output valid JSON only.",
    user: JSON.stringify({
      task: "Extract festival data for admin moderation.",
      rules: [
        "Use only provided source snippets; if uncertain return null.",
        "Article publication date is NOT event date unless explicitly event schedule.",
        "Prefer Bulgarian event names and Bulgarian authoritative sources.",
        "Organizer must be an entity name, not prose.",
        "Location must be a real place/venue/area label.",
        "Return alternatives in candidates arrays when plausible.",
        "Description should be short factual Bulgarian summary only when supported.",
        "Return JSON object with keys: best_guess, candidates, warnings, evidence.",
      ],
      schema: {
        best_guess: {
          title: "string|null",
          start_date: "YYYY-MM-DD|null",
          end_date: "YYYY-MM-DD|null",
          city: "string|null",
          location: "string|null",
          organizer: "string|null",
          description: "string|null",
          hero_image: "string|null",
          tags: ["string"],
        },
        candidates: {
          titles: "array",
          dates: "array",
          cities: "array",
          locations: "array",
          organizers: "array",
        },
        warnings: ["string"],
        evidence: [{ field: "string", value: "string", source_url: "string" }],
      },
      input,
    }),
  };
}

export async function runLlmFieldExtraction(input: LlmExtractInput): Promise<LlmExtractResult> {
  const diagnostics = getLlmExtractionDiagnostics();
  const apiKey = process.env.WEB_RESEARCH_LLM_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
  if (!diagnostics.enabled || !apiKey) {
    throw new Error("LLM extraction is not configured.");
  }

  const prompt = buildPrompt(input);
  const response = await fetch(diagnostics.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: diagnostics.model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
    }),
    signal: AbortSignal.timeout(Number(process.env.WEB_RESEARCH_LLM_TIMEOUT_MS ?? "25000")),
  });

  if (!response.ok) {
    throw new Error(`LLM extraction request failed (${response.status}).`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM response was empty.");

  const parsed = parseJson(content) as {
    best_guess?: Record<string, unknown>;
    candidates?: Record<string, unknown>;
    warnings?: unknown;
    evidence?: unknown;
  };

  return {
    best_guess: {
      title: normalizeText(parsed.best_guess?.title),
      start_date: normalizeDate(parsed.best_guess?.start_date),
      end_date: normalizeDate(parsed.best_guess?.end_date),
      city: normalizeText(parsed.best_guess?.city),
      location: normalizeText(parsed.best_guess?.location),
      organizer: normalizeText(parsed.best_guess?.organizer),
      description: normalizeText(parsed.best_guess?.description),
      hero_image: normalizeText(parsed.best_guess?.hero_image),
      tags: Array.isArray(parsed.best_guess?.tags) ? parsed.best_guess.tags.map((item) => normalizeText(item)).filter((item): item is string => Boolean(item)) : [],
    },
    candidates: {
      titles: normalizeFieldCandidates(parsed.candidates?.titles),
      dates: normalizeDateCandidates(parsed.candidates?.dates),
      cities: normalizeFieldCandidates(parsed.candidates?.cities),
      locations: normalizeFieldCandidates(parsed.candidates?.locations),
      organizers: normalizeFieldCandidates(parsed.candidates?.organizers),
    },
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map((item) => normalizeText(item)).filter((item): item is string => Boolean(item)) : [],
    evidence: Array.isArray(parsed.evidence)
      ? parsed.evidence
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const field = normalizeText((item as { field?: unknown }).field);
            const value = normalizeText((item as { value?: unknown }).value);
            const sourceUrl = normalizeText((item as { source_url?: unknown }).source_url);
            if (!field || !value || !sourceUrl) return null;
            return { field, value, source_url: sourceUrl };
          })
          .filter((item): item is ResearchEvidence => Boolean(item))
      : [],
  };
}
