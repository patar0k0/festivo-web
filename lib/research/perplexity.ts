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

export type ResearchRejectionReason = "name_mismatch" | "low_similarity" | "no_data" | "fetch_failed";

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

  /** Structured debug: discovery step. */
  discovery: {
    queries: string[];
    followup_query: string | null;
    ranked: Array<{ url: string; source_type: ResearchSourceType; rank: number }>;
  };
  /** One row per ranked fetch target. */
  extractions: Array<{
    url: string;
    rank: number;
    source_type: ResearchSourceType;
    fetch: ResearchFetchStatus;
    similarity: number | null;
    title: string | null;
    start_date: string | null;
    end_date: string | null;
    city: string | null;
    used_in_merge: boolean;
  }>;
  rejected_sources: Array<{ url: string; reason: ResearchRejectionReason; detail?: string }>;
  merge_result: {
    title: string | null;
    title_from_urls: string[];
    start_date: string | null;
    start_date_from_urls: string[];
    end_date: string | null;
    end_date_from_urls: string[];
    city: string | null;
    city_from_urls: string[];
    merge_fallback_used: boolean;
    merge_fallback_note: string | null;
    lock_notes: string[];
  };
  confidence_debug: {
    level: AiResearchConfidence;
    bullets: string[];
  };
  pipeline_errors: Array<{ url?: string; message: string }>;
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

/** Query vs extracted identity blob (title, place, excerpt) for inclusion in merge. */
function identityOverlapForSignal(query: string, sig: ExtractedPageSignals): number {
  const blob = [sig.title, sig.city, sig.location_name, sig.description?.slice(0, 400)].filter(Boolean).join(" ");
  if (!blob.trim()) return 0;
  return tokenOverlapScore(query, blob);
}

const SIMILARITY_NAME_MISMATCH_LT = 0.14;
const SIMILARITY_LOW_LT = 0.32;

function similarityRejection(overlap: number, hadData: boolean): ResearchRejectionReason | null {
  if (!hadData) return null;
  if (overlap < SIMILARITY_NAME_MISMATCH_LT) return "name_mismatch";
  if (overlap < SIMILARITY_LOW_LT) return "low_similarity";
  return null;
}

function normTitleKey(t: string | null | undefined): string | null {
  if (!t) return null;
  const s = t.trim().toLowerCase();
  return s.length > 0 ? s : null;
}

function urlsContributingTitle(title: string | null, inputs: ExtractedPageSignals[]): string[] {
  const key = normTitleKey(title);
  if (!key) return [];
  return inputs.filter((s) => normTitleKey(s.title) === key).map((s) => s.url);
}

function urlsContributingDate(iso: string | null, inputs: ExtractedPageSignals[], which: "start" | "end"): string[] {
  if (!iso) return [];
  return inputs
    .filter((s) => (which === "start" ? s.start_date === iso : s.end_date === iso))
    .map((s) => s.url);
}

function urlsContributingCity(city: string | null, inputs: ExtractedPageSignals[]): string[] {
  if (!city?.trim()) return [];
  const k = city.trim().toLowerCase();
  return inputs.filter((s) => s.city?.trim().toLowerCase() === k).map((s) => s.url);
}

function buildConfidenceDebugBullets(args: {
  result: PerplexityFestivalResearchResult;
  agreementNotes: string[];
  preTier: AiResearchConfidence;
  postTier: AiResearchConfidence;
  context: ExtractionContext;
  mergeInputCount: number;
  rankedCount: number;
}): string[] {
  const { result, agreementNotes, preTier, postTier, context, mergeInputCount, rankedCount } = args;
  const bullets: string[] = [];

  const dateAgreements = agreementNotes.filter((n) => n.includes("start_date"));
  const cityAgreements = agreementNotes.filter((n) => n.includes("city"));
  for (const n of dateAgreements) bullets.push(`${n} (start date consensus).`);
  for (const n of cityAgreements) bullets.push(`${n} (city consensus).`);

  const hasOfficial = result.source_urls.some((url) => isOfficialLikeSource(url) || !isLowValueSource(url));
  if (hasOfficial) bullets.push("At least one official or non-aggregate source is present in the URL set.");

  if (context.explicitYear) {
    if (result.start_date?.startsWith(String(context.explicitYear))) {
      bullets.push(`Start date aligns with query year ${context.explicitYear}.`);
    } else if (result.start_date) {
      bullets.push(`Start date year differs from query year ${context.explicitYear} (validation may cap confidence).`);
    } else {
      bullets.push(`Query targets year ${context.explicitYear} but no aligned start date after validation.`);
    }
  }

  const missingN = countMissingImportantFields(result);
  if (missingN >= 5) bullets.push(`Many important fields missing (${missingN}); caps confidence at low.`);
  else if (missingN >= 3) bullets.push(`${missingN} important fields still missing.`);

  const lowValueCount = result.source_urls.filter((url) => isLowValueSource(url)).length;
  if (result.source_urls.length > 0 && lowValueCount / result.source_urls.length >= 0.67) {
    bullets.push("Most sources are low-value aggregators; confidence is limited.");
  }

  bullets.push(`Merge used ${mergeInputCount} page(s) with passing identity similarity (of ${rankedCount} ranked fetch targets).`);

  if (postTier !== preTier) {
    bullets.push(`Agreement boost raised confidence from ${preTier} to ${postTier}.`);
  } else {
    bullets.push(`No agreement-based bump; tier stays ${postTier} after validation.`);
  }

  return bullets;
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

/** Admin UI: detect source kind for search hits (extends `ResearchSourceType` with explicit Facebook event label). */
export type AdminFestivalSearchDetectedType = "facebook_event" | "listing" | "article" | "other";

export type AdminFestivalSearchHit = {
  url: string;
  title: string | null;
  snippet: string | null;
  source_type: AdminFestivalSearchDetectedType;
};

function mapResearchSourceToAdminDetected(t: ResearchSourceType): AdminFestivalSearchDetectedType {
  if (t === "facebook") return "facebook_event";
  if (t === "listing") return "listing";
  return "article";
}

/** Prefer Facebook events and Event.bg-style listings first (stable within ties). */
function preferredAdminSearchRank(url: string): number {
  const u = url.toLowerCase();
  if (u.includes("facebook.com/events")) return 0;
  if (u.includes("eventibg") || u.includes("event.bg")) return 1;
  return 2;
}

function bestTitleSnippetForUrl(url: string, rows: PerplexitySearchResultRow[]): { title: string | null; snippet: string | null } {
  const target = normalizeUrlLoose(url);
  let title: string | null = null;
  let snippet: string | null = null;
  for (const r of rows) {
    if (!r.url) continue;
    const row = normalizeUrlLoose(r.url);
    if (!row || !target) continue;
    if (row === target || target.includes(row) || row.includes(target)) {
      if (!title && r.title) title = r.title;
      if (!snippet && r.snippet) snippet = r.snippet;
      if (title && snippet) break;
    }
  }
  return { title, snippet };
}

/**
 * Perplexity URL discovery only (no HTML merge). Dedupes, normalizes URLs, caps at 8, ranks Facebook/Event.bg first.
 */
export async function adminPerplexityFestivalSearch(query: string): Promise<{
  urls: string[];
  search_results: AdminFestivalSearchHit[];
}> {
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

  let searchResults: PerplexitySearchResultRow[] = [];
  const discoveryPool: string[] = [];

  const first = await fetchPerplexityUrlDiscovery(apiKey, normalizedQuery, context);
  searchResults = first.searchResults;
  discoveryPool.push(...first.modelUrls, ...first.citationUrls);

  if (countUniqueDiscoveryUrls(discoveryPool) < 3) {
    const secondQuery = buildSecondaryDiscoveryQuery(normalizedQuery);
    const second = await fetchPerplexityUrlDiscovery(apiKey, secondQuery, context);
    discoveryPool.push(...second.modelUrls, ...second.citationUrls);
    searchResults = [...searchResults, ...second.searchResults];
  }

  const rankedBase = rankDiscoveryUrls(discoveryPool);
  const sortedForUi = [...rankedBase].sort((a, b) => {
    const d = preferredAdminSearchRank(a) - preferredAdminSearchRank(b);
    if (d !== 0) return d;
    return rankedBase.indexOf(a) - rankedBase.indexOf(b);
  });

  const top = sortedForUi.slice(0, 8);
  const hits: AdminFestivalSearchHit[] = top.map((u) => {
    const canonical = normalizeSourceUrl(u) ?? u;
    const { title, snippet } = bestTitleSnippetForUrl(u, searchResults);
    const blob = collectSnippetTextForTargetUrl(u, searchResults);
    const snippetOut = snippet ?? (blob.trim() ? blob.trim().slice(0, 500) : null);
    const st = classifyResearchSourceType(canonical);
    return {
      url: canonical,
      title,
      snippet: snippetOut,
      source_type: mapResearchSourceToAdminDetected(st),
    };
  });

  return {
    urls: hits.map((h) => h.url),
    search_results: hits,
  };
}

/**
 * Single-page extraction (one URL, no multi-source merge). Reuses HTML / Facebook fallback extractors.
 */
export async function researchFestivalFromSingleUrl(
  rawUrl: string,
  options?: { queryHint?: string; snippetFallback?: string | null },
): Promise<PerplexityFestivalResearchResult> {
  const sanitized = sanitizeUrl(rawUrl);
  if (!sanitized) {
    throw new Error("Invalid URL");
  }

  const queryHint = (options?.queryHint ?? "").trim();
  const context: ExtractionContext = {
    explicitYear: extractExplicitYear(queryHint),
  };
  const normalizedQuery = queryHint || sanitized;
  const snippetBlob = (options?.snippetFallback ?? "").trim();

  const extracted: ExtractedPageSignals[] = [];

  if (isFacebookEventsUrl(sanitized)) {
    const html = (await fetchHtmlForResearch(sanitized)) ?? "";
    const sig = extractSignalsFromFacebookFallback(html, sanitized, snippetBlob, context.explicitYear);
    extracted.push(sig);
  } else {
    const html = await fetchHtmlForResearch(sanitized);
    if (!html) {
      throw new Error("Could not fetch page HTML (blocked, empty, or non-HTML response)");
    }
    extracted.push(extractSignalsFromHtml(html, sanitized, context.explicitYear));
  }

  const withData = extracted.filter((s) => s.had_data);
  const mergeInputs = withData.length > 0 ? withData : extracted;
  const merged = mergePageSignals(mergeInputs);

  const facebookFromUrl = /facebook\.com/i.test(sanitized) ? sanitized : null;
  const websiteCandidate = !/facebook\.com|instagram\.com|tiktok\.com/i.test(sanitized) ? sanitized : null;

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
    facebook_url: facebookFromUrl ? sanitizeUrl(facebookFromUrl) : null,
    instagram_url: null,
    ticket_url: null,
    hero_image: merged.hero_image ? sanitizeUrl(merged.hero_image) : null,
    is_free: null,
    program_draft: null,
    source_urls: cleanSourceUrls([sanitized]),
    confidence: "low",
    missing_fields: [],
    research_report: undefined,
  };

  finalizeResearchResult(result, context, normalizedQuery);
  return result;
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
  const primaryQuery = normalizedQuery;
  let followupQuery: string | null = null;

  const discoveryPool: string[] = [];
  const first = await fetchPerplexityUrlDiscovery(apiKey, normalizedQuery, context);
  perplexityModelTotal += first.modelUrls.length;
  perplexityCitationTotal += first.citationUrls.length;
  searchResults = first.searchResults;
  discoveryPool.push(...first.modelUrls, ...first.citationUrls);

  if (countUniqueDiscoveryUrls(discoveryPool) < 3) {
    followupQueries = 1;
    followupQuery = buildSecondaryDiscoveryQuery(normalizedQuery);
    const second = await fetchPerplexityUrlDiscovery(apiKey, followupQuery, context);
    perplexityModelTotal += second.modelUrls.length;
    perplexityCitationTotal += second.citationUrls.length;
    discoveryPool.push(...second.modelUrls, ...second.citationUrls);
    searchResults = [...searchResults, ...second.searchResults];
    mergeSummaryLines.push(`Discovery follow-up: initial unique URLs < 3 → second query ("${followupQuery}").`);
  }

  const ranked = rankDiscoveryUrls(discoveryPool);

  const extractedForMergeDebug: ExtractedPageSignals[] = [];
  const sourceTraces: Array<{ url: string; source_type: ResearchSourceType; fetch_status: ResearchFetchStatus }> = [];
  const extractions: FestivalResearchReport["extractions"] = [];
  const pipeline_errors: FestivalResearchReport["pipeline_errors"] = [];

  mergeSummaryLines.push(
    `Perplexity URL discovery: ${perplexityModelTotal} JSON URL row(s), ${perplexityCitationTotal} citation URL(s), ${searchResults.length} search snippet row(s); after ranking, ${ranked.length} fetch target(s).`,
  );

  for (let idx = 0; idx < ranked.length; idx++) {
    const url = ranked[idx]!;
    const rank = idx + 1;
    const sourceType = classifyResearchSourceType(url);

    if (isFacebookEventsUrl(url)) {
      const html = (await fetchHtmlForResearch(url)) ?? "";
      const snippetBlob = collectSnippetTextForTargetUrl(url, searchResults);
      if (!html && !snippetBlob.trim()) {
        sourceTraces.push({ url, source_type: sourceType, fetch_status: "blocked" });
        mergeSummaryLines.push(`Facebook event URL: fetch blocked/empty and no Perplexity snippet match — ${url}`);
        pipeline_errors.push({ url, message: "facebook.com blocked or empty fetch (no snippet fallback)" });
        extractions.push({
          url,
          rank,
          source_type: sourceType,
          fetch: "blocked",
          similarity: null,
          title: null,
          start_date: null,
          end_date: null,
          city: null,
          used_in_merge: false,
        });
        continue;
      }
      const sig = extractSignalsFromFacebookFallback(html, url, snippetBlob, context.explicitYear);
      extractedForMergeDebug.push(sig);
      sourceTraces.push({ url, source_type: sourceType, fetch_status: "fallback_used" });
      const overlap = identityOverlapForSignal(normalizedQuery, sig);
      mergeSummaryLines.push(
        sig.had_data
          ? `Facebook fallback (title + snippets, no JSON-LD): ${url}`
          : `Facebook fallback returned no structured fields: ${url}`,
      );
      extractions.push({
        url,
        rank,
        source_type: sourceType,
        fetch: "fallback_used",
        similarity: Number(overlap.toFixed(4)),
        title: sig.title,
        start_date: sig.start_date,
        end_date: sig.end_date,
        city: sig.city,
        used_in_merge: false,
      });
      continue;
    }

    const html = await fetchHtmlForResearch(url);
    if (!html) {
      sourceTraces.push({ url, source_type: sourceType, fetch_status: "blocked" });
      mergeSummaryLines.push(`Fetch failed or empty: ${url}`);
      pipeline_errors.push({ url, message: "Fetch failed, empty body, or non-HTML response" });
      extractions.push({
        url,
        rank,
        source_type: sourceType,
        fetch: "blocked",
        similarity: null,
        title: null,
        start_date: null,
        end_date: null,
        city: null,
        used_in_merge: false,
      });
      continue;
    }

    const sig = extractSignalsFromHtml(html, url, context.explicitYear);
    extractedForMergeDebug.push(sig);
    sourceTraces.push({ url, source_type: sourceType, fetch_status: "success" });
    const overlap = identityOverlapForSignal(normalizedQuery, sig);
    mergeSummaryLines.push(sig.had_data ? `Parsed JSON-LD / text signals: ${url}` : `HTML only (no structured fields): ${url}`);
    extractions.push({
      url,
      rank,
      source_type: sourceType,
      fetch: "success",
      similarity: Number(overlap.toFixed(4)),
      title: sig.title,
      start_date: sig.start_date,
      end_date: sig.end_date,
      city: sig.city,
      used_in_merge: false,
    });
  }

  let mergeInputs = extractedForMergeDebug.filter((sig) => {
    if (!sig.had_data) return false;
    const o = identityOverlapForSignal(normalizedQuery, sig);
    return similarityRejection(o, true) === null;
  });

  let mergeFallbackUsed = false;
  let mergeFallbackNote: string | null = null;
  if (mergeInputs.length === 0) {
    const withData = extractedForMergeDebug.filter((s) => s.had_data);
    if (withData.length > 0) {
      mergeInputs = withData;
      mergeFallbackUsed = true;
      mergeFallbackNote =
        "No page passed identity similarity thresholds (see extractions); merged all sources that returned data.";
      mergeSummaryLines.push(mergeFallbackNote);
    }
  }

  const mergeInputUrls = new Set(mergeInputs.map((s) => s.url));
  for (const row of extractions) {
    if (mergeInputUrls.has(row.url)) row.used_in_merge = true;
  }

  const rejected_sources: FestivalResearchReport["rejected_sources"] = [];
  for (const row of extractions) {
    if (row.fetch === "blocked") {
      rejected_sources.push({
        url: row.url,
        reason: "fetch_failed",
        detail: pipeline_errors.find((e) => e.url === row.url)?.message,
      });
      continue;
    }
    const sig = extractedForMergeDebug.find((s) => s.url === row.url);
    if (!sig) continue;
    if (mergeInputUrls.has(row.url)) continue;
    if (!sig.had_data) {
      rejected_sources.push({
        url: row.url,
        reason: "no_data",
        detail: "No usable title, dates, city, or structured fields after extraction",
      });
      continue;
    }
    const o = row.similarity ?? identityOverlapForSignal(normalizedQuery, sig);
    const sr = similarityRejection(o, true);
    if (sr) {
      rejected_sources.push({
        url: row.url,
        reason: sr,
        detail: `Identity similarity ${o.toFixed(2)} (thresholds: ≥${SIMILARITY_LOW_LT} merge, <${SIMILARITY_NAME_MISMATCH_LT} name mismatch)`,
      });
    }
  }

  const merged = mergePageSignals(mergeInputs);
  for (const line of merged.merge_lock_notes) {
    mergeSummaryLines.push(line);
  }

  const merge_result: FestivalResearchReport["merge_result"] = {
    title: merged.title,
    title_from_urls: urlsContributingTitle(merged.title, mergeInputs),
    start_date: merged.start_date,
    start_date_from_urls: urlsContributingDate(merged.start_date, mergeInputs, "start"),
    end_date: merged.end_date,
    end_date_from_urls: urlsContributingDate(merged.end_date, mergeInputs, "end"),
    city: merged.city,
    city_from_urls: urlsContributingCity(merged.city, mergeInputs),
    merge_fallback_used: mergeFallbackUsed,
    merge_fallback_note: mergeFallbackNote,
    lock_notes: [...merged.merge_lock_notes],
  };

  const discovery: FestivalResearchReport["discovery"] = {
    queries: followupQuery ? [primaryQuery, followupQuery] : [primaryQuery],
    followup_query: followupQuery,
    ranked: ranked.map((u, i) => ({
      url: u,
      source_type: classifyResearchSourceType(u),
      rank: i + 1,
    })),
  };

  const bestSingle = extractedForMergeDebug.length ? Math.max(0, ...extractedForMergeDebug.map(countKeyFieldsFromSignal)) : 0;

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

  const agreementNotes = computeAgreementNotes(mergeInputs);
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

  const withData = extractedForMergeDebug.filter((s) => s.had_data).length;
  const reasoningParts = [
    `Perplexity was used only to discover URLs (${perplexityModelTotal} JSON rows, ${perplexityCitationTotal} citation URLs${followupQueries ? `, ${followupQueries} follow-up quer${followupQueries === 1 ? "y" : "ies"}` : ""}).`,
    `Fetched ${ranked.length} ranked page(s); ${withData} returned extractable fields; ${mergeInputs.length} used in merge.`,
    `Field completeness: merged result ${mergedFieldCount}/6 key fields vs best single source ${bestSingle}/6.`,
    `Base confidence after validation: ${preAgreementConfidence}.`,
  ];
  if (agreementNotes.length > 0) {
    reasoningParts.push(`Agreement boost (2+ sources): ${agreementNotes.join("; ")} → ${result.confidence}.`);
  } else {
    reasoningParts.push("No multi-source agreement on start date or city; confidence not boosted for agreement.");
  }

  const confidence_debug: FestivalResearchReport["confidence_debug"] = {
    level: result.confidence,
    bullets: buildConfidenceDebugBullets({
      result,
      agreementNotes,
      preTier: preAgreementConfidence,
      postTier: result.confidence,
      context,
      mergeInputCount: mergeInputs.length,
      rankedCount: ranked.length,
    }),
  };

  result.research_report = {
    flow: "perplexity_url_discovery_html_merge",
    perplexity_model_urls: perplexityModelTotal,
    perplexity_citation_urls: perplexityCitationTotal,
    perplexity_followup_queries: followupQueries,
    sources_attempted: [...ranked],
    sources_with_extractable_data: extractedForMergeDebug.filter((s) => s.had_data).map((s) => s.url),
    source_traces: sourceTraces,
    merge_summary_lines: mergeSummaryLines,
    agreement_notes: agreementNotes,
    confidence_reasoning: reasoningParts.join(" "),
    completeness: { best_single_source: bestSingle, merged: mergedFieldCount },
    discovery,
    extractions,
    rejected_sources,
    merge_result,
    confidence_debug,
    pipeline_errors,
  };

  return result;
}
