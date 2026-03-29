export type AiResearchConfidence = "low" | "medium" | "high";

export type PerplexityFestivalResearchResult = {
  title: string | null;
  description: string | null;
  category: string | null;
  start_date: string | null;
  end_date: string | null;
  city: string | null;
  location_name: string | null;
  address: string | null;
  organizer_name: string | null;
  /** When multiple organizers are found, listed separately (optional; falls back to organizer_name). */
  organizer_names: string[] | null;
  website_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  ticket_url: string | null;
  hero_image: string | null;
  is_free: boolean | null;
  source_urls: string[];
  confidence: AiResearchConfidence;
  missing_fields: string[];
};

type PerplexityMessage = {
  role: "system" | "user";
  content: string;
};

type ExtractionContext = {
  explicitYear: number | null;
};

type NullableResultField = {
  [K in keyof PerplexityFestivalResearchResult]-?: null extends PerplexityFestivalResearchResult[K] ? K : never;
}[keyof PerplexityFestivalResearchResult];

type StrictNullableField = Extract<
  NullableResultField,
  | "start_date"
  | "end_date"
  | "ticket_url"
  | "hero_image"
  | "is_free"
>;

const ENDPOINT = "https://api.perplexity.ai/chat/completions";
const MODEL = "sonar-pro";
const TIMEOUT_MS = 30_000;
/** Run enrichment when this many factual fields are still null (admin tool: prefer more passes over sparse forms). */
const ENRICHMENT_MISSING_THRESHOLD = 3;
/** After merge, if still this many missing, run one more targeted pass. */
const THIRD_PASS_MISSING_THRESHOLD = 5;

const LOW_VALUE_SOURCE_PATTERNS = [
  "allevents.",
  "eventsin",
  "events.",
  "grabo.",
  "programata.",
  "kade.bg",
  "fest-bg.",
  "ticketportal",
  "tickets.",
];

const OFFICIAL_SOURCE_PATTERNS = [
  "facebook.com/events",
  "facebook.com/",
  "instagram.com/",
];

const MUNICIPALITY_SOURCE_PATTERNS = [
  ".gov",
  "government",
  "municipality",
  "muni",
  "obshtina",
  "culture",
  "kultura",
  "tourism",
  "visit",
];

const LOCAL_MEDIA_SOURCE_PATTERNS = [
  "bnr.bg",
  "bntnews.bg",
  "24chasa.bg",
  "dariknews.bg",
  "dnevnik.bg",
  "marica.bg",
  "plovdiv24.bg",
  "flagman.bg",
  "trud.bg",
  "novini.bg",
  "focus-news.net",
];

const STRICT_NULL_FIELDS: readonly StrictNullableField[] = [
  "start_date",
  "end_date",
  "ticket_url",
  "hero_image",
  "is_free",
];

type ImportantMissingField = StrictNullableField | "title" | "city" | "organizer_name";

const IMPORTANT_MISSING_FIELDS: readonly ImportantMissingField[] = [
  ...STRICT_NULL_FIELDS,
  "title",
  "city",
  "organizer_name",
];

const REQUIRED_SCHEMA_FIELDS: Array<keyof PerplexityFestivalResearchResult> = [
  "title",
  "description",
  "category",
  "start_date",
  "end_date",
  "city",
  "location_name",
  "address",
  "organizer_name",
  "website_url",
  "facebook_url",
  "instagram_url",
  "ticket_url",
  "hero_image",
  "is_free",
  "source_urls",
  "confidence",
  "missing_fields",
];

const PERPLEXITY_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: REQUIRED_SCHEMA_FIELDS,
  properties: {
    title: { type: ["string", "null"] },
    description: { type: ["string", "null"] },
    category: { type: ["string", "null"] },
    start_date: { type: ["string", "null"] },
    end_date: { type: ["string", "null"] },
    city: { type: ["string", "null"] },
    location_name: { type: ["string", "null"] },
    address: { type: ["string", "null"] },
    organizer_name: { type: ["string", "null"] },
    organizer_names: { type: ["array", "null"], items: { type: "string" } },
    website_url: { type: ["string", "null"] },
    facebook_url: { type: ["string", "null"] },
    instagram_url: { type: ["string", "null"] },
    ticket_url: { type: ["string", "null"] },
    hero_image: { type: ["string", "null"] },
    is_free: { type: ["boolean", "null"] },
    source_urls: { type: "array", items: { type: "string" } },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    missing_fields: { type: "array", items: { type: "string" } },
  },
} as const;

const FACTUAL_FIELDS: readonly NullableResultField[] = [
  "title",
  "description",
  "category",
  "start_date",
  "end_date",
  "city",
  "location_name",
  "address",
  "organizer_name",
  "website_url",
  "facebook_url",
  "instagram_url",
  "ticket_url",
  "hero_image",
  "is_free",
];

function sanitizeNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeBooleanOrNull(value: unknown): boolean | null {
  if (typeof value !== "boolean") return null;
  return value;
}

function sanitizeConfidence(value: unknown): AiResearchConfidence {
  return value === "high" || value === "medium" ? value : "low";
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => sanitizeNullableString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function sanitizeUrl(value: unknown): string | null {
  const candidate = sanitizeNullableString(value);
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function sanitizeDate(value: unknown, context: ExtractionContext): string | null {
  const date = sanitizeNullableString(value);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;

  if (context.explicitYear && parsed.getUTCFullYear() !== context.explicitYear) {
    return null;
  }

  return date;
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const direct = raw.trim();
  try {
    return JSON.parse(direct) as Record<string, unknown>;
  } catch {
    const fenced = direct.match(/```json\s*([\s\S]*?)```/i) ?? direct.match(/```\s*([\s\S]*?)```/i);
    if (!fenced?.[1]) {
      throw new Error("Perplexity response was not valid JSON.");
    }
    return JSON.parse(fenced[1].trim()) as Record<string, unknown>;
  }
}

function normalizeSourceUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    const params = [...url.searchParams.keys()];
    for (const key of params) {
      if (key.toLowerCase().startsWith("utm_") || key.toLowerCase() === "fbclid") {
        url.searchParams.delete(key);
      }
    }
    if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
      url.port = "";
    }
    const pathname = url.pathname.replace(/\/$/, "");
    url.pathname = pathname || "/";
    return url.toString();
  } catch {
    return null;
  }
}

function isLowValueSource(url: string): boolean {
  const normalized = url.toLowerCase();
  return LOW_VALUE_SOURCE_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function isOfficialLikeSource(url: string): boolean {
  const normalized = url.toLowerCase();
  return OFFICIAL_SOURCE_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function isMunicipalityLikeSource(url: string): boolean {
  const normalized = url.toLowerCase();
  return MUNICIPALITY_SOURCE_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function isLocalMediaSource(url: string): boolean {
  const normalized = url.toLowerCase();
  return LOCAL_MEDIA_SOURCE_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function classifySourcePriority(url: string): number {
  if (isLowValueSource(url)) return 3;
  if (isMunicipalityLikeSource(url)) return 1;
  if (isLocalMediaSource(url)) return 2;
  return 0;
}

function isLikelyCanonicalOfficialUrl(url: string): boolean {
  return classifySourcePriority(url) <= 1 && !isLowValueSource(url) && !isLocalMediaSource(url);
}

function cleanSourceUrls(urls: string[]): string[] {
  const uniqueExact = new Map<string, string>();
  for (const raw of urls) {
    const normalized = normalizeSourceUrl(raw);
    if (!normalized) continue;
    if (!uniqueExact.has(normalized)) uniqueExact.set(normalized, normalized);
  }

  const preferred: string[] = [];
  const lowValueByHost = new Map<string, string>();

  for (const url of uniqueExact.values()) {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (!isLowValueSource(url)) {
      preferred.push(url);
      continue;
    }

    if (!lowValueByHost.has(host)) {
      lowValueByHost.set(host, url);
    }
  }

  return [...preferred, ...lowValueByHost.values()].sort((a, b) => classifySourcePriority(a) - classifySourcePriority(b));
}

function extractExplicitYear(query: string): number | null {
  const match = query.match(/\b(19\d{2}|20\d{2})\b/);
  if (!match) return null;
  const year = Number(match[1]);
  return Number.isFinite(year) ? year : null;
}

function hasAnyYearSpecificEvidence(result: PerplexityFestivalResearchResult, context: ExtractionContext): boolean {
  if (!context.explicitYear) return true;

  const yearString = String(context.explicitYear);
  if (result.start_date?.startsWith(yearString) || result.end_date?.startsWith(yearString)) {
    return true;
  }

  if (result.title?.includes(yearString) || result.description?.includes(yearString)) {
    return true;
  }

  return result.source_urls.some((url) => url.includes(yearString));
}

function tokenizeForSimilarity(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

function tokenOverlapScore(a: string, b: string): number {
  const left = new Set(tokenizeForSimilarity(a));
  const right = new Set(tokenizeForSimilarity(b));
  if (left.size === 0 || right.size === 0) return 0;

  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }

  return intersection / Math.max(left.size, right.size);
}

function hasTokenInText(token: string, text: string): boolean {
  const normalizedToken = token.toLowerCase().trim();
  return normalizedToken.length > 0 && text.toLowerCase().includes(normalizedToken);
}

function hasStrongCanonicalIdentityMatch(
  result: PerplexityFestivalResearchResult,
  query: string,
  context: ExtractionContext,
): boolean {
  if (!result.title) return false;

  let score = 0;
  const titleOverlap = tokenOverlapScore(query, result.title);
  if (titleOverlap >= 0.45) score += 2;
  else if (titleOverlap >= 0.25) score += 1;

  if (result.city && hasTokenInText(result.city, query)) score += 1;
  if (result.organizer_name && (hasTokenInText(result.organizer_name, query) || result.source_urls.some((url) => hasTokenInText(result.organizer_name!, url)))) {
    score += 1;
  }

  const nonListingSources = result.source_urls.filter((url) => !isLowValueSource(url));
  const distinctHosts = new Set(nonListingSources.map((url) => new URL(url).hostname.replace(/^www\./, "")));
  if (distinctHosts.size >= 2) score += 1;
  if (nonListingSources.some((url) => classifySourcePriority(url) <= 1)) score += 1;
  if (!context.explicitYear) score += 1;

  return score >= 3;
}

function countMissingImportantFields(result: PerplexityFestivalResearchResult): number {
  return IMPORTANT_MISSING_FIELDS.filter((field) => result[field] === null).length;
}

function deriveConfidence(
  modelConfidence: AiResearchConfidence,
  result: PerplexityFestivalResearchResult,
  context: ExtractionContext,
): AiResearchConfidence {
  const hasOfficialSource = result.source_urls.some((url) => isOfficialLikeSource(url) || !isLowValueSource(url));
  const hasExactYearEvidence = hasAnyYearSpecificEvidence(result, context);
  const hasDates = Boolean(result.start_date);
  const lowValueCount = result.source_urls.filter((url) => isLowValueSource(url)).length;
  const mostlyLowValueSources = result.source_urls.length > 0 && lowValueCount / result.source_urls.length >= 0.67;
  const missingImportant = countMissingImportantFields(result);

  if (!hasOfficialSource || !hasExactYearEvidence || !hasDates || mostlyLowValueSources || missingImportant >= 5) {
    return "low";
  }

  if (modelConfidence === "high" && missingImportant <= 1) return "high";
  return "medium";
}

function buildMissingFields(result: PerplexityFestivalResearchResult): string[] {
  const missing = FACTUAL_FIELDS.filter((field) => result[field] === null);
  return Array.from(new Set(missing));
}

type NormalizeResultOptions = {
  /**
   * Merge these URLs into `source_urls` before validation.
   * Required for enrichment passes: Perplexity sometimes omits `source_urls` on follow-up JSON;
   * without this, `hasFactualClaims && source_urls.length === 0` wipes all extracted fields.
   */
  inheritSourceUrls?: string[];
};

function normalizeResult(
  data: Record<string, unknown>,
  context: ExtractionContext,
  query: string,
  options?: NormalizeResultOptions,
): PerplexityFestivalResearchResult {
  const fromModel = cleanSourceUrls(sanitizeStringArray(data.source_urls));
  const inherited = options?.inheritSourceUrls?.length ? cleanSourceUrls(options.inheritSourceUrls) : [];
  const source_urls = cleanSourceUrls([...fromModel, ...inherited]);

  const result: PerplexityFestivalResearchResult = {
    title: sanitizeNullableString(data.title),
    description: sanitizeNullableString(data.description),
    category: sanitizeNullableString(data.category),
    start_date: sanitizeDate(data.start_date, context),
    end_date: sanitizeDate(data.end_date, context),
    city: sanitizeNullableString(data.city),
    location_name: sanitizeNullableString(data.location_name),
    address: sanitizeNullableString(data.address),
    organizer_name: sanitizeNullableString(data.organizer_name),
    organizer_names: (() => {
      const list = sanitizeStringArray(data.organizer_names);
      return list.length > 0 ? list : null;
    })(),
    website_url: sanitizeUrl(data.website_url),
    facebook_url: sanitizeUrl(data.facebook_url),
    instagram_url: sanitizeUrl(data.instagram_url),
    ticket_url: sanitizeUrl(data.ticket_url),
    hero_image: sanitizeUrl(data.hero_image),
    is_free: sanitizeBooleanOrNull(data.is_free),
    source_urls,
    confidence: sanitizeConfidence(data.confidence),
    missing_fields: [],
  };

  // If model does not provide a canonical website, keep first resolved source URL
  // so admin moderation still has a concrete landing page to review.
  if (!result.website_url && source_urls.length > 0) {
    result.website_url = source_urls[0];
  }

  // Social links are often returned only as source URLs in structured extraction.
  if (!result.facebook_url) {
    const facebookSource = source_urls.find((url) => /(^|\.|\/\/)(www\.)?facebook\.com\//i.test(url));
    if (facebookSource) result.facebook_url = facebookSource;
  }

  if (!result.instagram_url) {
    const instagramSource = source_urls.find((url) => /(^|\.|\/\/)(www\.)?instagram\.com\//i.test(url));
    if (instagramSource) result.instagram_url = instagramSource;
  }

  const hasExactYearEvidence = hasAnyYearSpecificEvidence(result, context);
  const hasStrongCanonicalMatch = hasStrongCanonicalIdentityMatch(result, query, context);

  if (context.explicitYear && !hasExactYearEvidence) {
    for (const key of STRICT_NULL_FIELDS) {
      result[key] = null;
    }

    if (!hasStrongCanonicalMatch) {
      result.address = null;
      result.organizer_name = null;
      result.location_name = null;
    }

    const clearNonCanonicalUrl = (field: "website_url" | "facebook_url" | "instagram_url") => {
      const current = result[field];
      if (!current) return;
      if (!isLikelyCanonicalOfficialUrl(current)) {
        result[field] = null;
      }
    };

    clearNonCanonicalUrl("website_url");
    clearNonCanonicalUrl("facebook_url");
    clearNonCanonicalUrl("instagram_url");
  }

  if (result.start_date && result.end_date && result.end_date < result.start_date) {
    result.end_date = null;
  }

  // Single-day events: many sources only state one date; mirror start -> end for admin convenience.
  if (result.start_date && !result.end_date) {
    result.end_date = result.start_date;
  }

  const hasFactualClaims = FACTUAL_FIELDS.some((field) => result[field] !== null);
  if (hasFactualClaims && result.source_urls.length === 0) {
    for (const key of FACTUAL_FIELDS) {
      result[key] = null;
    }
    result.organizer_names = null;
  }

  // Light heuristic when model omitted boolean (admin-only hint).
  if (result.is_free === null && result.description) {
    const d = result.description.toLowerCase();
    if (
      /\bбезплатн/i.test(d) ||
      /\bfree\b/i.test(d) ||
      /\bвходът\s+е\s+свободен/i.test(d) ||
      /\bсвободен\s+вход/i.test(d)
    ) {
      result.is_free = true;
    }
  }

  result.missing_fields = buildMissingFields(result);
  result.confidence = deriveConfidence(result.confidence, result, context);

  return result;
}

function buildMessages(query: string, context: ExtractionContext): PerplexityMessage[] {
  const yearInstruction = context.explicitYear
    ? `The query contains explicit target year ${context.explicitYear}. Treat evidence for other years only as weak context. Do not promote other-year facts as confirmed ${context.explicitYear} facts.`
    : "No explicit year in query. Prefer the most recent explicitly dated evidence and avoid assumptions.";

  return [
    {
      role: "system",
      content: [
        "You extract festival facts from web sources. Return ONLY valid JSON.",
        "Unknown or weakly-supported values must be null.",
        "Never hallucinate or infer from prior years.",
        "Prioritize evidence in this order:",
        "1) official organizer site/page",
        "2) official municipality/tourism/culture page",
        "3) current-year event page or announcement",
        "4) reputable local news source",
        "5) generic event listing pages only as fallback",
        "If stronger and weaker sources conflict, prefer the stronger source and set uncertain fields to null.",
        "Always include source_urls you relied on.",
        "When explicit event listing pages contain direct facts (organizer, venue/location, address, schedule, links), treat them as valid evidence for those fields.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Research query: ${query}`,
        yearInstruction,
        "Return STRICT JSON with this exact schema and no extra keys:",
        JSON.stringify(
          {
            title: null,
            description: null,
            category: null,
            start_date: null,
            end_date: null,
            city: null,
            location_name: null,
            address: null,
            organizer_name: null,
            organizer_names: null,
            website_url: null,
            facebook_url: null,
            instagram_url: null,
            ticket_url: null,
            hero_image: null,
            is_free: null,
            source_urls: [],
            confidence: "low",
            missing_fields: [],
          },
          null,
          2,
        ),
        "Extraction rules:",
        "- unknown/uncertain = null",
        "- do NOT infer current-year dates/location/organizer from older editions",
        "- if exact-year evidence is missing, keep unsupported fields null",
        "- if website_url is unknown but an event page URL is confirmed in source_urls, set website_url to that event page",
        "- extract organizer_name / organizer_names (multiple distinct organizers) / location_name / address whenever explicitly written in any cited source",
        "- preserve provided social links (facebook_url, instagram_url) when they appear in cited sources",
        "- program/schedule details must be null unless explicitly supported by trusted sources",
        "- confidence must be one of: low, medium, high",
        "- source_urls should prioritize high-value sources and avoid noisy duplicates",
        "- missing_fields must list schema keys that remain unknown/null",
      ].join("\n"),
    },
  ];
}

function buildEnrichmentMessages(query: string, context: ExtractionContext, firstPass: PerplexityFestivalResearchResult): PerplexityMessage[] {
  const yearInstruction = context.explicitYear
    ? `Target year is ${context.explicitYear}. Do not use conflicting data from other years unless explicitly marked as historical context.`
    : "No explicit target year. Prefer explicit current event details.";

  const knownFacts = {
    title: firstPass.title,
    start_date: firstPass.start_date,
    end_date: firstPass.end_date,
    city: firstPass.city,
    organizer_name: firstPass.organizer_name,
    organizer_names: firstPass.organizer_names,
    category: firstPass.category,
    location_name: firstPass.location_name,
    address: firstPass.address,
    website_url: firstPass.website_url,
    facebook_url: firstPass.facebook_url,
    instagram_url: firstPass.instagram_url,
    ticket_url: firstPass.ticket_url,
    hero_image: firstPass.hero_image,
    is_free: firstPass.is_free,
  };

  return [
    {
      role: "system",
      content: [
        "You are performing a second extraction pass to fill missing festival fields.",
        "Return ONLY valid JSON matching the provided schema.",
        "Use explicit evidence only. Never invent values.",
        "When a field is uncertain, return null.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Research query: ${query}`,
        yearInstruction,
        `Missing fields from first pass: ${firstPass.missing_fields.join(", ") || "none"}`,
        "Known facts from first pass (treat as stable context, do not degrade):",
        JSON.stringify(knownFacts, null, 2),
        "Focus on filling missing fields using explicit evidence from authoritative/event sources.",
        "You MUST include in source_urls every URL you used, plus re-list the known first-pass source URLs if still relevant.",
        "Use source_urls to cite the pages used.",
        "Return STRICT JSON with this exact schema and no extra keys:",
        JSON.stringify(
          {
            title: null,
            description: null,
            category: null,
            start_date: null,
            end_date: null,
            city: null,
            location_name: null,
            address: null,
            organizer_name: null,
            organizer_names: null,
            website_url: null,
            facebook_url: null,
            instagram_url: null,
            ticket_url: null,
            hero_image: null,
            is_free: null,
            source_urls: [],
            confidence: "low",
            missing_fields: [],
          },
          null,
          2,
        ),
      ].join("\n"),
    },
  ];
}

function assertRequiredKeys(result: Record<string, unknown>) {
  const missing = REQUIRED_SCHEMA_FIELDS.filter((key) => !(key in result));
  if (missing.length > 0) {
    throw new Error(`Perplexity response missing required keys: ${missing.join(", ")}`);
  }
}

function confidenceScore(value: AiResearchConfidence): number {
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

function chooseHigherConfidence(a: AiResearchConfidence, b: AiResearchConfidence): AiResearchConfidence {
  return confidenceScore(b) > confidenceScore(a) ? b : a;
}

function shouldRunEnrichmentPass(result: PerplexityFestivalResearchResult): boolean {
  return result.missing_fields.length >= ENRICHMENT_MISSING_THRESHOLD;
}

function mergeResults(
  base: PerplexityFestivalResearchResult,
  enrichment: PerplexityFestivalResearchResult,
  context: ExtractionContext,
): PerplexityFestivalResearchResult {
  const merged: PerplexityFestivalResearchResult = { ...base };
  type MergeableField = Exclude<keyof PerplexityFestivalResearchResult, "source_urls" | "confidence" | "missing_fields">;
  const mergeableFields: MergeableField[] = [
    "title",
    "description",
    "category",
    "start_date",
    "end_date",
    "city",
    "location_name",
    "address",
    "organizer_name",
    "website_url",
    "facebook_url",
    "instagram_url",
    "ticket_url",
    "hero_image",
    "is_free",
  ];

  const assignFromEnrichment = <K extends MergeableField>(field: K) => {
    const currentValue = merged[field];
    const nextValue = enrichment[field];
    if (currentValue === null && nextValue !== null) {
      merged[field] = nextValue;
    }
  };

  for (const field of mergeableFields) {
    assignFromEnrichment(field);
  }

  if ((!merged.organizer_names || merged.organizer_names.length === 0) && enrichment.organizer_names && enrichment.organizer_names.length > 0) {
    merged.organizer_names = enrichment.organizer_names;
  }

  merged.source_urls = cleanSourceUrls([...base.source_urls, ...enrichment.source_urls]);
  merged.confidence = chooseHigherConfidence(base.confidence, enrichment.confidence);
  merged.missing_fields = buildMissingFields(merged);
  merged.confidence = deriveConfidence(merged.confidence, merged, context);

  return merged;
}

async function fetchPerplexityJson(apiKey: string, messages: PerplexityMessage[]): Promise<Record<string, unknown>> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      response_format: {
        type: "json_schema",
        json_schema: {
          schema: PERPLEXITY_JSON_SCHEMA,
        },
      },
      messages,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    const payloadText = await response.text().catch(() => "");
    throw new Error(`Perplexity request failed (${response.status}): ${payloadText || response.statusText}`);
  }

  const payload = (await response.json().catch(() => null)) as
    | { choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }> }
    | null;

  const content = payload?.choices?.[0]?.message?.content;
  const text =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content
            .map((item) => (item?.type === "text" ? item.text ?? "" : ""))
            .join("\n")
            .trim()
        : "";

  if (!text) {
    throw new Error("Perplexity response did not include content");
  }

  const asJson = parseJsonObject(text);
  assertRequiredKeys(asJson);
  return asJson;
}

export async function researchFestival(query: string): Promise<PerplexityFestivalResearchResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("PERPLEXITY_API_KEY is not configured");
  }

  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    throw new Error("query is required");
  }

  const context: ExtractionContext = {
    explicitYear: extractExplicitYear(normalizedQuery),
  };

  const firstPassJson = await fetchPerplexityJson(apiKey, buildMessages(normalizedQuery, context));
  const firstPass = normalizeResult(firstPassJson, context, normalizedQuery);

  if (!shouldRunEnrichmentPass(firstPass)) {
    return firstPass;
  }

  let merged = firstPass;

  try {
    const enrichmentJson = await fetchPerplexityJson(apiKey, buildEnrichmentMessages(normalizedQuery, context, firstPass));
    const enrichmentPass = normalizeResult(enrichmentJson, context, normalizedQuery, { inheritSourceUrls: firstPass.source_urls });
    merged = mergeResults(firstPass, enrichmentPass, context);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown enrichment error";
    console.warn(`[research-ai] enrichment pass failed: ${message}`);
    return firstPass;
  }

  if (merged.missing_fields.length < THIRD_PASS_MISSING_THRESHOLD) {
    return merged;
  }

  try {
    const thirdJson = await fetchPerplexityJson(apiKey, buildEnrichmentMessages(normalizedQuery, context, merged));
    const thirdPass = normalizeResult(thirdJson, context, normalizedQuery, { inheritSourceUrls: merged.source_urls });
    merged = mergeResults(merged, thirdPass, context);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown third pass error";
    console.warn(`[research-ai] third extraction pass failed: ${message}`);
  }

  return merged;
}
