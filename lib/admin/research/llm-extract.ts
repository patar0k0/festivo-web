import type { ResearchConfidenceLevel, ResearchDateCandidate, ResearchFieldCandidate } from "@/lib/admin/research/types";
import type { SourceAuthorityTier } from "@/lib/admin/research/source-ranking";

type LlmSourcePayload = {
  source_url: string;
  domain: string;
  source_title: string;
  tier: SourceAuthorityTier;
  language: "bg" | "mixed" | "non_bg";
  text_excerpt: string;
  metadata?: {
    description?: string | null;
    date_hints?: string[];
  };
};

type LlmExtractInput = {
  query: string;
  normalized_query: string;
  sources: LlmSourcePayload[];
};

const DEFAULT_LLM_TIMEOUT_MS = 25_000;
const MIN_LLM_TIMEOUT_MS = 8_000;
const MAX_LLM_TIMEOUT_MS = 60_000;

type LlmExtractResult = {
  best_guess: {
    title: string | null;
    start_date: string | null;
    end_date: string | null;
    city: string | null;
    location: string | null;
    organizer: string | null;
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
  notes?: string | null;
};

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDate(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  return text;
}

function normalizeTier(value: unknown): SourceAuthorityTier | null {
  return value === "tier1_official" || value === "tier2_reputable" || value === "tier3_reference" || value === "tier4_commercial" || value === "tier5_weak"
    ? value
    : null;
}

function normalizeLanguage(value: unknown): "bg" | "mixed" | "non_bg" | null {
  return value === "bg" || value === "mixed" || value === "non_bg" ? value : null;
}

function normalizeConfidence(value: unknown): ResearchConfidenceLevel | null {
  return value === "high" || value === "medium" || value === "low" ? value : null;
}

function normalizeFieldCandidates(value: unknown): ResearchFieldCandidate[] {
  if (!Array.isArray(value)) return [];
  const out: ResearchFieldCandidate[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const candidateValue = normalizeText((item as { value?: unknown }).value);
    const sourceUrl = normalizeText((item as { source_url?: unknown }).source_url);
    if (!candidateValue || !sourceUrl) continue;

    const key = `${candidateValue.toLocaleLowerCase("bg-BG")}::${sourceUrl}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      value: candidateValue,
      source_url: sourceUrl,
      source_title: normalizeText((item as { source_title?: unknown }).source_title),
      tier: normalizeTier((item as { tier?: unknown }).tier),
      language: normalizeLanguage((item as { language?: unknown }).language),
      confidence: normalizeConfidence((item as { confidence?: unknown }).confidence),
      reason: normalizeText((item as { reason?: unknown }).reason),
    });
  }

  return out;
}

function normalizeDateCandidates(value: unknown): ResearchDateCandidate[] {
  if (!Array.isArray(value)) return [];
  const out: ResearchDateCandidate[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const startDate = normalizeDate((item as { start_date?: unknown }).start_date);
    const endDate = normalizeDate((item as { end_date?: unknown }).end_date) ?? startDate;
    const sourceUrl = normalizeText((item as { source_url?: unknown }).source_url);
    if (!startDate || !endDate || !sourceUrl) continue;

    const key = `${startDate}::${endDate}::${sourceUrl}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      start_date: startDate,
      end_date: endDate,
      source_url: sourceUrl,
      source_title: normalizeText((item as { source_title?: unknown }).source_title),
      tier: normalizeTier((item as { tier?: unknown }).tier),
      language: normalizeLanguage((item as { language?: unknown }).language),
      confidence: normalizeConfidence((item as { confidence?: unknown }).confidence),
      reason: normalizeText((item as { reason?: unknown }).reason),
      label: normalizeText((item as { label?: unknown }).label) ?? (startDate === endDate ? startDate : `${startDate} → ${endDate}`),
    });
  }

  return out;
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i)?.[1] ?? text;
  const trimmed = fenced.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first >= 0 && last > first) {
      return JSON.parse(trimmed.slice(first, last + 1));
    }
    throw new Error("LLM response did not include valid JSON.");
  }
}

function buildPrompt(input: LlmExtractInput): { system: string; user: string } {
  const system = [
    "You are a strict festival data extractor.",
    "Use ONLY supplied source snippets.",
    "Never use prior knowledge or invent facts.",
    "Return only JSON.",
    "If uncertain, set best_guess field to null and add warning.",
  ].join(" ");

  const user = JSON.stringify(
    {
      task: "Extract festival fields from ranked sources.",
      rules: [
        "Output strict JSON object with keys: best_guess, candidates, warnings, notes.",
        "Best guess fields: title, start_date, end_date, city, location, organizer, tags.",
        "Candidate groups: titles, dates, cities, locations, organizers.",
        "Each candidate must include value (or start_date/end_date), source_url, source_title, tier, language, confidence, reason.",
        "Use YYYY-MM-DD for dates.",
        "Distinguish article publish date from event date.",
        "Ignore navigation/login/cookie/CTA text.",
        "Travel reseller/listing pages are weak evidence.",
        "Municipality/tourism board/official organizer sources are stronger evidence.",
        "Prefer Bulgarian event names when present.",
        "Organizer must be an entity, not prose.",
        "Location must be a place/venue/area label, not sentence fragments.",
        "When conflicting values exist, include alternatives instead of forcing one.",
      ],
      query: input.query,
      normalized_query: input.normalized_query,
      sources: input.sources,
    },
    null,
    2,
  );

  return { system, user };
}

export type LlmExtractionDiagnostics = {
  enabled: boolean;
  missingPrerequisites: string[];
  prerequisites: {
    webResearchLlmApiKey: boolean;
    openAiApiKey: boolean;
    llmUrlConfigured: boolean;
    llmModelConfigured: boolean;
  };
  resolvedConfig: {
    endpoint: string;
    model: string;
    timeoutMs: number;
    authMode: "WEB_RESEARCH_LLM_API_KEY" | "OPENAI_API_KEY" | "missing";
  };
};

function resolveLlmTimeoutMs(): number {
  const timeoutMsRaw = Number(process.env.WEB_RESEARCH_LLM_TIMEOUT_MS ?? String(DEFAULT_LLM_TIMEOUT_MS));
  if (!Number.isFinite(timeoutMsRaw)) {
    return DEFAULT_LLM_TIMEOUT_MS;
  }
  return Math.min(MAX_LLM_TIMEOUT_MS, Math.max(MIN_LLM_TIMEOUT_MS, Math.round(timeoutMsRaw)));
}

function isAbortError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "name" in error && (error as { name?: unknown }).name === "AbortError");
}

function resolveLlmApiKey(): { apiKey: string | null; authMode: LlmExtractionDiagnostics["resolvedConfig"]["authMode"] } {
  const webResearchApiKey = process.env.WEB_RESEARCH_LLM_API_KEY?.trim();
  if (webResearchApiKey) {
    return { apiKey: webResearchApiKey, authMode: "WEB_RESEARCH_LLM_API_KEY" };
  }

  const openAiApiKey = process.env.OPENAI_API_KEY?.trim();
  if (openAiApiKey) {
    return { apiKey: openAiApiKey, authMode: "OPENAI_API_KEY" };
  }

  return { apiKey: null, authMode: "missing" };
}

export function getLlmExtractionDiagnostics(): LlmExtractionDiagnostics {
  const { apiKey, authMode } = resolveLlmApiKey();
  const endpoint = process.env.WEB_RESEARCH_LLM_URL ?? "https://api.openai.com/v1/chat/completions";
  const model = process.env.WEB_RESEARCH_LLM_MODEL ?? "gpt-4o-mini";
  const timeoutMs = resolveLlmTimeoutMs();

  const missingPrerequisites: string[] = [];
  if (!apiKey) {
    missingPrerequisites.push("WEB_RESEARCH_LLM_API_KEY or OPENAI_API_KEY");
  }

  return {
    enabled: missingPrerequisites.length === 0,
    missingPrerequisites,
    prerequisites: {
      webResearchLlmApiKey: Boolean(process.env.WEB_RESEARCH_LLM_API_KEY?.trim()),
      openAiApiKey: Boolean(process.env.OPENAI_API_KEY?.trim()),
      llmUrlConfigured: Boolean(process.env.WEB_RESEARCH_LLM_URL?.trim()),
      llmModelConfigured: Boolean(process.env.WEB_RESEARCH_LLM_MODEL?.trim()),
    },
    resolvedConfig: {
      endpoint,
      model,
      timeoutMs,
      authMode,
    },
  };
}

export function isLlmExtractionEnabled(): boolean {
  return getLlmExtractionDiagnostics().enabled;
}

export function estimateLlmPromptSizeChars(input: LlmExtractInput): number {
  const prompt = buildPrompt(input);
  return prompt.system.length + prompt.user.length;
}

function hasMeaningfulLlmResult(result: LlmExtractResult): boolean {
  const hasBestGuess = Boolean(
    result.best_guess.title ||
      result.best_guess.start_date ||
      result.best_guess.end_date ||
      result.best_guess.city ||
      result.best_guess.location ||
      result.best_guess.organizer ||
      result.best_guess.tags.length,
  );

  const hasCandidates =
    result.candidates.titles.length > 0 ||
    result.candidates.dates.length > 0 ||
    result.candidates.cities.length > 0 ||
    result.candidates.locations.length > 0 ||
    result.candidates.organizers.length > 0;

  return hasBestGuess || hasCandidates;
}

export async function runLlmFieldExtraction(input: LlmExtractInput): Promise<LlmExtractResult> {
  const diagnostics = getLlmExtractionDiagnostics();
  const { apiKey } = resolveLlmApiKey();
  if (!apiKey) {
    throw new Error(`LLM prerequisites missing: ${diagnostics.missingPrerequisites.join(", ")}.`);
  }

  const endpoint = diagnostics.resolvedConfig.endpoint;
  const model = diagnostics.resolvedConfig.model;
  const timeoutMs = diagnostics.resolvedConfig.timeoutMs;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const prompt = buildPrompt(input);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`LLM extraction request failed (${response.status}).`);
    }

    const payload = (await response.json().catch(() => null)) as
      | { choices?: Array<{ message?: { content?: string } }> }
      | null;
    const content = normalizeText(payload?.choices?.[0]?.message?.content);
    if (!content) {
      throw new Error("LLM response was empty.");
    }

    const parsed = extractJson(content) as {
      best_guess?: Record<string, unknown>;
      candidates?: Record<string, unknown>;
      warnings?: unknown;
      notes?: unknown;
    };

    const best = parsed.best_guess ?? {};
    const normalizedResult: LlmExtractResult = {
      best_guess: {
        title: normalizeText(best.title),
        start_date: normalizeDate(best.start_date),
        end_date: normalizeDate(best.end_date),
        city: normalizeText(best.city),
        location: normalizeText(best.location),
        organizer: normalizeText(best.organizer),
        tags: Array.isArray(best.tags)
          ? best.tags.map((item) => normalizeText(item)).filter((item): item is string => Boolean(item)).slice(0, 8)
          : [],
      },
      candidates: {
        titles: normalizeFieldCandidates(parsed.candidates?.titles),
        dates: normalizeDateCandidates(parsed.candidates?.dates),
        cities: normalizeFieldCandidates(parsed.candidates?.cities),
        locations: normalizeFieldCandidates(parsed.candidates?.locations),
        organizers: normalizeFieldCandidates(parsed.candidates?.organizers),
      },
      warnings: Array.isArray(parsed.warnings)
        ? parsed.warnings.map((item) => normalizeText(item)).filter((item): item is string => Boolean(item))
        : [],
      notes: normalizeText(parsed.notes),
    };

    if (!hasMeaningfulLlmResult(normalizedResult)) {
      throw new Error("LLM response was parsed but did not contain usable festival candidates.");
    }

    return normalizedResult;
  } catch (error) {
    if (isAbortError(error) || controller.signal.aborted) {
      const timeoutError = new Error(`LLM extraction timed out after ${timeoutMs}ms.`);
      timeoutError.name = "LlmTimeoutError";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
