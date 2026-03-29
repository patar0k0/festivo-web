import type { ResearchCandidates, ResearchConfidenceLevel, ResearchFestivalResult, ResearchSource } from "@/lib/admin/research/types";

export type OpenAiExtractionInputSource = {
  source_url: string;
  domain: string;
  title: string;
  tier: string | null;
  language: string | null;
  excerpt: string;
};

export type OpenAiExtractionInput = {
  query: string;
  sources: OpenAiExtractionInputSource[];
};

const DEFAULT_MODEL = process.env.WEB_RESEARCH_LLM_MODEL?.trim() || "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS = Number.parseInt(process.env.WEB_RESEARCH_LLM_TIMEOUT_MS ?? "25000", 10);

function normalizeTimeout(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 25_000;
  return Math.min(value, 60_000);
}

function confidence(value: unknown, fallback: ResearchConfidenceLevel = "low"): ResearchConfidenceLevel {
  return value === "high" || value === "medium" || value === "low" ? value : fallback;
}

function normalizeCandidates(raw: unknown): ResearchCandidates {
  const candidates = (raw ?? {}) as Partial<ResearchCandidates>;
  return {
    titles: Array.isArray(candidates.titles) ? candidates.titles : [],
    dates: Array.isArray(candidates.dates) ? candidates.dates : [],
    cities: Array.isArray(candidates.cities) ? candidates.cities : [],
    locations: Array.isArray(candidates.locations) ? candidates.locations : [],
    organizers: Array.isArray(candidates.organizers) ? candidates.organizers : [],
  };
}

const INSTRUCTIONS = `You are extracting festival facts for admin moderation.
Rules:
- Return strict JSON only.
- Use ONLY the supplied source text. Do NOT invent facts.
- If a field is unclear, return null.
- Article publish date is NOT the event date.
- Prefer Bulgarian values when supported by sources.
- Description must be short factual Bulgarian summary (2-4 sentences max) only if supported.
- Organizer must be an entity, not prose.
- Location must be a real venue/place/area label, not junk.
- If multiple plausible values exist, include alternatives in candidates instead of forcing wrong canonical value.
- Keep warnings concise.`;

export async function extractFestivalWithOpenAi(
  input: OpenAiExtractionInput,
): Promise<{ result: ResearchFestivalResult; diagnostics: { model: string; attempted: true; jsonParsed: boolean; accepted: boolean } }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["best_guess", "candidates", "warnings", "confidence"],
    properties: {
      best_guess: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description", "city", "start_date", "end_date", "location", "organizer", "organizers", "hero_image", "tags", "is_free"],
        properties: {
          title: { type: ["string", "null"] },
          description: { type: ["string", "null"] },
          city: { type: ["string", "null"] },
          start_date: { type: ["string", "null"] },
          end_date: { type: ["string", "null"] },
          location: { type: ["string", "null"] },
          organizer: { type: ["string", "null"] },
          organizers: { type: "array", items: { type: "string" } },
          hero_image: { type: ["string", "null"] },
          tags: { type: "array", items: { type: "string" } },
          is_free: { type: ["boolean", "null"] },
        },
      },
      candidates: {
        type: "object",
        additionalProperties: false,
        required: ["titles", "dates", "cities", "locations", "organizers"],
        properties: {
          titles: { type: "array", items: { type: "object" } },
          dates: { type: "array", items: { type: "object" } },
          cities: { type: "array", items: { type: "object" } },
          locations: { type: "array", items: { type: "object" } },
          organizers: { type: "array", items: { type: "object" } },
        },
      },
      warnings: { type: "array", items: { type: "string" } },
      confidence: {
        type: "object",
        additionalProperties: false,
        required: ["overall"],
        properties: { overall: { type: "string", enum: ["low", "medium", "high"] } },
      },
    },
  };

  const body = {
    model: DEFAULT_MODEL,
    input: [
      { role: "system", content: [{ type: "input_text", text: INSTRUCTIONS }] },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({ query: input.query, sources: input.sources }),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "festival_research",
        schema,
        strict: true,
      },
    },
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(normalizeTimeout(DEFAULT_TIMEOUT_MS)),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`OpenAI extraction failed (${response.status}): ${errText.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    output_text?: string;
  };

  const text = payload.output_text;
  if (!text) {
    throw new Error("OpenAI response did not contain output_text");
  }

  const parsed = JSON.parse(text) as {
    best_guess?: Record<string, unknown>;
    candidates?: unknown;
    warnings?: unknown;
    confidence?: { overall?: unknown };
  };

  const bestGuess = parsed.best_guess ?? {};
  const result: ResearchFestivalResult = {
    query: input.query,
    normalized_query: input.query.trim().toLocaleLowerCase("bg-BG"),
    best_guess: {
      title: typeof bestGuess.title === "string" ? bestGuess.title : null,
      description: typeof bestGuess.description === "string" ? bestGuess.description : null,
      city: typeof bestGuess.city === "string" ? bestGuess.city : null,
      start_date: typeof bestGuess.start_date === "string" ? bestGuess.start_date : null,
      end_date: typeof bestGuess.end_date === "string" ? bestGuess.end_date : null,
      start_time: null,
      end_time: null,
      location: typeof bestGuess.location === "string" ? bestGuess.location : null,
      organizers: Array.isArray(bestGuess.organizers)
        ? bestGuess.organizers.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        : typeof bestGuess.organizer === "string" && bestGuess.organizer.trim()
          ? [bestGuess.organizer.trim()]
          : [],
      organizer: typeof bestGuess.organizer === "string" ? bestGuess.organizer : null,
      hero_image: typeof bestGuess.hero_image === "string" ? bestGuess.hero_image : null,
      tags: Array.isArray(bestGuess.tags) ? bestGuess.tags.filter((x): x is string => typeof x === "string") : [],
      is_free: typeof bestGuess.is_free === "boolean" ? bestGuess.is_free : null,
    },
    candidates: normalizeCandidates(parsed.candidates),
    sources: input.sources.map((source): ResearchSource => ({
      url: source.source_url,
      domain: source.domain,
      title: source.title,
      is_official: source.tier === "tier1_official",
      tier: (source.tier as ResearchSource["tier"]) ?? null,
      language: (source.language as ResearchSource["language"]) ?? null,
    })),
    confidence: {
      overall: confidence(parsed.confidence?.overall),
      title: confidence(parsed.confidence?.overall),
      dates: confidence(parsed.confidence?.overall),
      city: confidence(parsed.confidence?.overall),
      location: confidence(parsed.confidence?.overall),
      description: confidence(parsed.confidence?.overall),
      organizer: confidence(parsed.confidence?.overall),
      hero_image: confidence(parsed.confidence?.overall),
      is_free: confidence(parsed.confidence?.overall),
    },
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.filter((x): x is string => typeof x === "string") : [],
    evidence: [],
    metadata: {
      provider: "openai_web",
      mode: "openai_structured",
      source_count: input.sources.length,
      model: DEFAULT_MODEL,
      openai_attempted: true,
      openai_json_parsed: true,
      fallback_used: false,
    },
    title: typeof bestGuess.title === "string" ? bestGuess.title : null,
    description: typeof bestGuess.description === "string" ? bestGuess.description : null,
    city: typeof bestGuess.city === "string" ? bestGuess.city : null,
    start_date: typeof bestGuess.start_date === "string" ? bestGuess.start_date : null,
    end_date: typeof bestGuess.end_date === "string" ? bestGuess.end_date : null,
    location: typeof bestGuess.location === "string" ? bestGuess.location : null,
    organizer: typeof bestGuess.organizer === "string" ? bestGuess.organizer : null,
    hero_image: typeof bestGuess.hero_image === "string" ? bestGuess.hero_image : null,
    tags: Array.isArray(bestGuess.tags) ? bestGuess.tags.filter((x): x is string => typeof x === "string") : [],
    is_free: typeof bestGuess.is_free === "boolean" ? bestGuess.is_free : null,
  };

  return { result, diagnostics: { model: DEFAULT_MODEL, attempted: true, jsonParsed: true, accepted: true } };
}
