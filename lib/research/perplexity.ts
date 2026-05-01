import { programDraftHasContent, type ProgramDraft } from "@/lib/festival/programDraft";
import {
  classifyResearchSourceType,
  extractSignalsFromFacebookFallback,
  extractSignalsFromHtml,
  fetchHtmlForResearch,
  isFacebookEventsUrl,
  mergePageSignals,
  rankDiscoveryUrls,
  type ExtractedPageSignals,
  type ResearchFetchStatus,
  type ResearchSourceType,
} from "@/lib/research/htmlFestivalExtract";

export type AiResearchConfidence = "low" | "medium" | "high";

/** Admin-visible trace for multi-source HTML merge (Perplexity used only for URL discovery). */
export type FestivalResearchReport = {
  flow: "perplexity_url_discovery_html_merge";
  perplexity_model_urls: number;
  perplexity_citation_urls: number;
  perplexity_followup_queries: number;
  sources_attempted: string[];
  sources_with_extractable_data: string[];
  source_traces: Array<{
    url: string;
    source_type: ResearchSourceType;
    fetch_status: ResearchFetchStatus;
  }>;
  merge_summary_lines: string[];
  agreement_notes: string[];
  confidence_reasoning: string;
  /** Count of key fields filled: title, start_date, end_date, city, description, organizer_name. */
  completeness: { best_single_source: number; merged: number };
};

export type PerplexityFestivalResearchResult = {
  title: string | null;
  description: string | null;
  category: string | null;
  start_date: string | null;
  end_date: string | null;
  /** Optional; not part of the strict Perplexity JSON schema but preserved when present. */
  slug?: string | null;
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
  /** Structured program when sources list a schedule (days + timed items). */
  program_draft: ProgramDraft | null;
  source_urls: string[];
  confidence: AiResearchConfidence;
  missing_fields: string[];
  /** Populated by `researchFestival` multi-source HTML pipeline. */
  research_report?: FestivalResearchReport;
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

/** Perplexity returns URLs only; HTML merge does factual extraction. */
const URL_DISCOVERY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["urls"],
  properties: {
    urls: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 10 },
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

function extractCitationsFromPayload(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const c = (payload as { citations?: unknown }).citations;
  if (!Array.isArray(c)) return [];
  const out: string[] = [];
  for (const item of c) {
    if (typeof item === "string" && item.trim()) {
      out.push(item.trim());
    } else if (item && typeof item === "object" && "url" in item && typeof (item as { url: unknown }).url === "string") {
      const u = (item as { url: string }).url.trim();
      if (u) out.push(u);
    }
  }
  return out;
}

function assertUrlDiscoveryKeys(result: Record<string, unknown>) {
  if (!("urls" in result)) {
    throw new Error("Perplexity URL discovery response missing urls");
  }
}

function buildUrlDiscoveryMessages(query: string, context: ExtractionContext): PerplexityMessage[] {
  const yearInstruction = context.explicitYear
    ? `Target year ${context.explicitYear}: prefer pages that clearly refer to this edition.`
    : "Prefer the current or most recently announced edition.";
  return [
    {
      role: "system",
      content: [
        "You help find authoritative web pages about a Bulgarian festival or public event.",
        "Return ONLY valid JSON. Do not summarize the event in prose.",
        "Return 3–5 DISTINCT https URLs when possible (fewer only if the event is very obscure).",
        "Together they should cover: a Facebook event if it exists; a Bulgarian listing site (Event.bg / eventibg / Programata / similar); a news or municipality article if useful; an official site when obvious.",
        "Exclude duplicate hosts when possible. Every URL must be a real page you would cite from web search.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Festival / event research query: ${query}`,
        yearInstruction,
        'Return STRICT JSON: {"urls":["https://..."]} only.',
      ].join("\n"),
    },
  ];
}

type PerplexitySearchResultRow = { url: string | null; title: string | null; snippet: string | null };

function extractSearchResultsFromPayload(payload: unknown): PerplexitySearchResultRow[] {
  if (!payload || typeof payload !== "object") return [];
  const sr = (payload as { search_results?: unknown }).search_results;
  if (!Array.isArray(sr)) return [];
  const out: PerplexitySearchResultRow[] = [];
  for (const item of sr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const url = typeof o.url === "string" ? o.url.trim() || null : null;
    const title =
      typeof o.title === "string"
        ? o.title.trim() || null
        : typeof o.name === "string"
          ? o.name.trim() || null
          : null;
    const snippet =
      typeof o.snippet === "string"
        ? o.snippet.trim() || null
        : typeof o.text === "string"
          ? o.text.trim() || null
          : null;
    out.push({ url, title, snippet });
  }
  return out;
}

function normalizeUrlLoose(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    let path = u.pathname.replace(/\/$/, "");
    if (!path) path = "/";
    return `${u.origin}${path}`;
  } catch {
    return null;
  }
}

function collectSnippetTextForTargetUrl(targetUrl: string, rows: PerplexitySearchResultRow[]): string {
  const target = normalizeUrlLoose(targetUrl);
  const parts: string[] = [];
  for (const r of rows) {
    if (!r.url) continue;
    const row = normalizeUrlLoose(r.url);
    if (!row || !target) continue;
    if (row === target || target.includes(row) || row.includes(target)) {
      if (r.title) parts.push(r.title);
      if (r.snippet) parts.push(r.snippet);
    }
  }
  return parts.join("\n");
}

function countUniqueDiscoveryUrls(urls: string[]): number {
  const seen = new Set<string>();
  for (const raw of urls) {
    const n = normalizeSourceUrl(raw);
    if (n) seen.add(n);
  }
  return seen.size;
}

function buildSecondaryDiscoveryQuery(query: string): string {
  if (/[\u0400-\u04FF]/.test(query)) return `${query} събитие дата място`;
  return `${query} festival Bulgaria date location`;
}

function countKeyResearchFields(partial: {
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  city: string | null;
  description: string | null;
  organizer_name: string | null;
}): number {
  let n = 0;
  if (partial.title) n += 1;
  if (partial.start_date) n += 1;
  if (partial.end_date) n += 1;
  if (partial.city) n += 1;
  if (partial.description) n += 1;
  if (partial.organizer_name) n += 1;
  return n;
}

function countKeyFieldsFromSignal(s: ExtractedPageSignals): number {
  return countKeyResearchFields({
    title: s.title,
    start_date: s.start_date,
    end_date: s.end_date,
    city: s.city,
    description: s.description,
    organizer_name: s.organizer_name,
  });
}

async function fetchPerplexityUrlDiscovery(
  apiKey: string,
  query: string,
  context: ExtractionContext,
): Promise<{ modelUrls: string[]; citationUrls: string[]; searchResults: PerplexitySearchResultRow[] }> {
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
          schema: URL_DISCOVERY_SCHEMA,
        },
      },
      messages: buildUrlDiscoveryMessages(query, context),
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    const payloadText = await response.text().catch(() => "");
    throw new Error(`Perplexity URL discovery failed (${response.status}): ${payloadText || response.statusText}`);
  }

  const payload = (await response.json().catch(() => null)) as
    | {
        choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
        citations?: unknown;
        search_results?: unknown;
      }
    | null;

  const citationUrls = extractCitationsFromPayload(payload);
  const searchResults = extractSearchResultsFromPayload(payload);

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
    return { modelUrls: [], citationUrls, searchResults };
  }

  let asJson: Record<string, unknown>;
  try {
    asJson = parseJsonObject(text);
  } catch {
    return { modelUrls: [], citationUrls, searchResults };
  }

  try {
    assertUrlDiscoveryKeys(asJson);
  } catch {
    return { modelUrls: [], citationUrls, searchResults };
  }

  const modelUrls = sanitizeStringArray(asJson.urls);
  return { modelUrls, citationUrls, searchResults };
}

function computeAgreementNotes(signals: ExtractedPageSignals[]): string[] {
  const notes: string[] = [];
  const relevant = signals.filter((s) => s.had_data);
  const startMap = new Map<string, number>();
  for (const s of relevant) {
    if (!s.start_date) continue;
    startMap.set(s.start_date, (startMap.get(s.start_date) ?? 0) + 1);
  }
  for (const [d, n] of startMap) {
    if (n >= 2) notes.push(`${n} pages agree on start_date ${d}`);
  }
  const cityMap = new Map<string, number>();
  for (const s of relevant) {
    if (!s.city?.trim()) continue;
    const k = s.city.trim().toLowerCase();
    cityMap.set(k, (cityMap.get(k) ?? 0) + 1);
  }
  for (const [city, n] of cityMap) {
    if (n >= 2) notes.push(`${n} pages agree on city ${city}`);
  }
  return notes;
}

function bumpConfidenceTier(value: AiResearchConfidence): AiResearchConfidence {
  if (value === "low") return "medium";
  if (value === "medium") return "high";
  return "high";
}

/** Shared validation, year guards, missing_fields, and base confidence (before multi-source bump). */
function finalizeResearchResult(result: PerplexityFestivalResearchResult, context: ExtractionContext, query: string): void {
  const source_urls = result.source_urls;

  if (!result.website_url && source_urls.length > 0) {
    result.website_url = sanitizeUrl(source_urls[0] ?? "");
  }

  if (!result.facebook_url) {
    const facebookSource = source_urls.find((url) => /(^|\.|\/\/)(www\.)?facebook\.com\//i.test(url));
    if (facebookSource) result.facebook_url = sanitizeUrl(facebookSource);
  }

  if (!result.instagram_url) {
    const instagramSource = source_urls.find((url) => /(^|\.|\/\/)(www\.)?instagram\.com\//i.test(url));
    if (instagramSource) result.instagram_url = sanitizeUrl(instagramSource);
  }

  const hasExactYearEvidence = hasAnyYearSpecificEvidence(result, context);
  const hasStrongCanonicalMatch = hasStrongCanonicalIdentityMatch(result, query, context);

  if (context.explicitYear && !hasExactYearEvidence) {
    for (const key of STRICT_NULL_FIELDS) {
      result[key] = null;
    }
    result.program_draft = null;

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

  if (result.start_date && !result.end_date) {
    result.end_date = result.start_date;
  }

  const hasFactualClaims = FACTUAL_FIELDS.some((field) => result[field] !== null) || programDraftHasContent(result.program_draft);
  if (hasFactualClaims && result.source_urls.length === 0) {
    for (const key of FACTUAL_FIELDS) {
      result[key] = null;
    }
    result.organizer_names = null;
    result.program_draft = null;
  }

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

  const mergeSummaryLines: string[] = [];
  let searchResults: PerplexitySearchResultRow[] = [];
  let perplexityModelTotal = 0;
  let perplexityCitationTotal = 0;
  let followupQueries = 0;

  const discoveryPool: string[] = [];
  const first = await fetchPerplexityUrlDiscovery(apiKey, normalizedQuery, context);
  perplexityModelTotal += first.modelUrls.length;
  perplexityCitationTotal += first.citationUrls.length;
  searchResults = first.searchResults;
  discoveryPool.push(...first.modelUrls, ...first.citationUrls);

  if (countUniqueDiscoveryUrls(discoveryPool) < 3) {
    followupQueries = 1;
    const secondQuery = buildSecondaryDiscoveryQuery(normalizedQuery);
    const second = await fetchPerplexityUrlDiscovery(apiKey, secondQuery, context);
    perplexityModelTotal += second.modelUrls.length;
    perplexityCitationTotal += second.citationUrls.length;
    discoveryPool.push(...second.modelUrls, ...second.citationUrls);
    searchResults = [...searchResults, ...second.searchResults];
    mergeSummaryLines.push(`Discovery follow-up: initial unique URLs < 3 → second query ("${secondQuery}").`);
  }

  const ranked = rankDiscoveryUrls(discoveryPool);

  const extractedSignals: ExtractedPageSignals[] = [];
  const sourceTraces: Array<{ url: string; source_type: ResearchSourceType; fetch_status: ResearchFetchStatus }> = [];

  mergeSummaryLines.push(
    `Perplexity URL discovery: ${perplexityModelTotal} JSON URL row(s), ${perplexityCitationTotal} citation URL(s), ${searchResults.length} search snippet row(s); after ranking, ${ranked.length} fetch target(s).`,
  );

  for (const url of ranked) {
    const sourceType = classifyResearchSourceType(url);
    if (isFacebookEventsUrl(url)) {
      const html = (await fetchHtmlForResearch(url)) ?? "";
      const snippetBlob = collectSnippetTextForTargetUrl(url, searchResults);
      if (!html && !snippetBlob.trim()) {
        sourceTraces.push({ url, source_type: sourceType, fetch_status: "blocked" });
        mergeSummaryLines.push(`Facebook event URL: fetch blocked/empty and no Perplexity snippet match — ${url}`);
        continue;
      }
      const sig = extractSignalsFromFacebookFallback(html, url, snippetBlob, context.explicitYear);
      extractedSignals.push(sig);
      sourceTraces.push({ url, source_type: sourceType, fetch_status: "fallback_used" });
      mergeSummaryLines.push(
        sig.had_data
          ? `Facebook fallback (title + snippets, no JSON-LD): ${url}`
          : `Facebook fallback returned no structured fields: ${url}`,
      );
      continue;
    }

    const html = await fetchHtmlForResearch(url);
    if (!html) {
      sourceTraces.push({ url, source_type: sourceType, fetch_status: "blocked" });
      mergeSummaryLines.push(`Fetch failed or empty: ${url}`);
      continue;
    }
    const sig = extractSignalsFromHtml(html, url, context.explicitYear);
    extractedSignals.push(sig);
    sourceTraces.push({ url, source_type: sourceType, fetch_status: "success" });
    mergeSummaryLines.push(sig.had_data ? `Parsed JSON-LD / text signals: ${url}` : `HTML only (no structured fields): ${url}`);
  }

  const merged = mergePageSignals(extractedSignals);
  for (const line of merged.merge_lock_notes) {
    mergeSummaryLines.push(line);
  }

  const bestSingle = extractedSignals.length ? Math.max(0, ...extractedSignals.map(countKeyFieldsFromSignal)) : 0;

  const facebookFromList = ranked.find((u) => /facebook\.com/i.test(u)) ?? null;
  const websiteCandidate =
    ranked.find((u) => !/facebook\.com|instagram\.com|tiktok\.com/i.test(u)) ?? ranked[0] ?? null;

  const result: PerplexityFestivalResearchResult = {
    title: merged.title,
    description: merged.description,
    category: null,
    start_date: merged.start_date ? sanitizeDate(merged.start_date, context) : null,
    end_date: merged.end_date ? sanitizeDate(merged.end_date, context) : null,
    city: merged.city,
    location_name: merged.location_name,
    address: merged.address,
    organizer_name: merged.organizer_name,
    organizer_names: null,
    website_url: websiteCandidate ? sanitizeUrl(websiteCandidate) : null,
    facebook_url: facebookFromList ? sanitizeUrl(facebookFromList) : null,
    instagram_url: null,
    ticket_url: null,
    hero_image: merged.hero_image ? sanitizeUrl(merged.hero_image) : null,
    is_free: null,
    program_draft: null,
    source_urls: cleanSourceUrls(ranked),
    confidence: "low",
    missing_fields: [],
  };

  finalizeResearchResult(result, context, normalizedQuery);

  const agreementNotes = computeAgreementNotes(extractedSignals);
  const preAgreementConfidence = result.confidence;
  if (agreementNotes.length > 0) {
    result.confidence = bumpConfidenceTier(result.confidence);
  }

  const mergedFieldCount = countKeyResearchFields({
    title: result.title,
    start_date: result.start_date,
    end_date: result.end_date,
    city: result.city,
    description: result.description,
    organizer_name: result.organizer_name,
  });

  const withData = extractedSignals.filter((s) => s.had_data).length;
  const reasoningParts = [
    `Perplexity was used only to discover URLs (${perplexityModelTotal} JSON rows, ${perplexityCitationTotal} citation URLs${followupQueries ? `, ${followupQueries} follow-up quer${followupQueries === 1 ? "y" : "ies"}` : ""}).`,
    `Fetched ${ranked.length} ranked page(s); ${withData} returned extractable fields.`,
    `Field completeness: merged result ${mergedFieldCount}/6 key fields vs best single source ${bestSingle}/6.`,
    `Base confidence after validation: ${preAgreementConfidence}.`,
  ];
  if (agreementNotes.length > 0) {
    reasoningParts.push(`Agreement boost (2+ sources): ${agreementNotes.join("; ")} → ${result.confidence}.`);
  } else {
    reasoningParts.push("No multi-source agreement on start date or city; confidence not boosted for agreement.");
  }

  result.research_report = {
    flow: "perplexity_url_discovery_html_merge",
    perplexity_model_urls: perplexityModelTotal,
    perplexity_citation_urls: perplexityCitationTotal,
    perplexity_followup_queries: followupQueries,
    sources_attempted: [...ranked],
    sources_with_extractable_data: extractedSignals.filter((s) => s.had_data).map((s) => s.url),
    source_traces: sourceTraces,
    merge_summary_lines: mergeSummaryLines,
    agreement_notes: agreementNotes,
    confidence_reasoning: reasoningParts.join(" "),
    completeness: { best_single_source: bestSingle, merged: mergedFieldCount },
  };

  return result;
}
