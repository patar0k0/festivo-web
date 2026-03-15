import { buildResearchQueries } from "@/lib/admin/research/query-builder";
import { assessSourceQuality, dedupeAndRankSources } from "@/lib/admin/research/source-ranking";
import { decodeHtmlEntities, extractDomain, fetchSourceDocument, normalizeUrl } from "@/lib/admin/research/source-extract";
import type { ExtractedSourceDocument } from "@/lib/admin/research/source-extract";
import type {
  ResearchCandidates,
  ResearchConfidenceLevel,
  ResearchDateCandidate,
  ResearchFestivalResult,
  ResearchFieldCandidate,
  ResearchLanguageSignal,
  ResearchSource,
} from "@/lib/admin/research/types";
import type { SourceAuthorityTier, SourceQualityClass } from "@/lib/admin/research/source-ranking";
import {
  estimateLlmPromptSizeChars,
  getLlmExtractionDiagnostics,
  isLlmAbortError,
  isLlmTimeoutError,
  runLlmFieldExtraction,
} from "@/lib/admin/research/llm-extract";

type SearchItem = {
  url: string;
  title: string;
};

type SearchPayloadRoot = {
  results?: unknown;
  items?: unknown;
  data?: unknown;
  response?: unknown;
};

type AssessedDocument = ExtractedSourceDocument & {
  qualityClass: SourceQualityClass;
  qualityScore: number;
  authorityTier: SourceAuthorityTier;
  isStrong: boolean;
  languageSignal: LanguageSignal;
  authorityReason: string;
};

type LlmSourceRejection = {
  sourceUrl: string;
  domain: string;
  tier: SourceAuthorityTier;
  reason: string;
};

type PreparedLlmSources = {
  eligible: Array<{
    source_url: string;
    domain: string;
    source_title: string;
    tier: SourceAuthorityTier;
    language: LanguageSignal;
    text_excerpt: string;
    metadata: {
      description: string | null;
      date_hints: string[];
    };
  }>;
  rejected: LlmSourceRejection[];
};

const SEARCH_TIMEOUT_MS = 7000;
const LLM_MAX_SOURCES = 3;
const LLM_MIN_EXCERPT_LENGTH = 140;
const LLM_MAX_EXCERPT_CHARS_PER_SOURCE = 900;
const LLM_MAX_SEGMENT_CHARS = 280;
const BG_TAG_MAP: Record<string, string> = {
  festival: "фестивал",
  carnival: "карнавал",
  masquerade: "маскарад",
  folklore: "фолклор",
  music: "музика",
  art: "изкуство",
  culture: "култура",
  tourism: "туризъм",
};

type LanguageSignal = ResearchLanguageSignal;

type ScoredCandidate = {
  value: string;
  sourceUrl: string;
  tier: SourceAuthorityTier;
  languageSignal: LanguageSignal;
  score: number;
  reason?: string;
};

type CandidateSelection = {
  value: string | null;
  sourceUrl: string | null;
  tier: SourceAuthorityTier | null;
  languageSignal: LanguageSignal | null;
  reason: string;
};

type CityAliasEntry = { canonical: string; aliases: string[] };

const BULGARIAN_CITY_ALIASES: CityAliasEntry[] = [
  { canonical: "Казанлък", aliases: ["казанлък", "kazanlak", "kazanluk"] },
  { canonical: "София", aliases: ["софия", "sofia", "sofiya"] },
  { canonical: "Пловдив", aliases: ["пловдив", "plovdiv"] },
  { canonical: "Варна", aliases: ["варна", "varna"] },
  { canonical: "Бургас", aliases: ["бургас", "burgas"] },
  { canonical: "Русе", aliases: ["русе", "ruse", "rousse"] },
  { canonical: "Перник", aliases: ["перник", "pernik"] },
  { canonical: "Стара Загора", aliases: ["стара загора", "stara zagora", "st. zagora"] },
  { canonical: "Велико Търново", aliases: ["велико търново", "veliko tarnovo", "veliko turnovo"] },
];

const BG_MONTH_MAP: Record<string, number> = {
  януари: 1,
  февруари: 2,
  март: 3,
  април: 4,
  май: 5,
  юни: 6,
  юли: 7,
  август: 8,
  септември: 9,
  октомври: 10,
  ноември: 11,
  декември: 12,
};

const ORGANIZER_ENTITY_HINT =
  /\b(община|municipality|кметств|министер|комитет|committee|фондац|foundation|асоциац|association|сдружени|организатор|организира|читалище|дружество|съюз)\b/iu;
const LOCATION_VENUE_HINT =
  /\b(площад|парк|стадион|читалище|дом\s+на\s+културата|културен\s+дом|амфитеат|venue|hall|square|park|center|centre|градина|езеро|комплекс)\b/iu;


const NOISY_UI_TEXT_HINT = /\b(print|switch|menu|share|cookie|accept|decline|login|sign\s*in|register|subscribe|прочети|виж\s+още|навигац|меню|сподели|вход|регистрация)\b/iu;
const CTA_SNIPPET_HINT = /\b(book\s*now|buy\s*tickets?|learn\s*more|join\s*us|read\s*more|reserve|вземи\s*билет|купи\s*билет|запази|резервирай|научи\s*повече|заповядайте)\b/iu;
const GARBAGE_FRAGMENT_HINT = /[|]{2,}|\s[-–—]\s(home|начало|menu|меню|blog|guide)\b|\b(home|начало)\s*[>»]/iu;
const LOW_AUTHORITY_DOMAIN_HINT = /\b(codanec|newwave|tripadvisor|eventbrite|allevents|10times|booking|offers?|package|blog|guide|listing)\b/iu;

function isBulgarianQuery(query: string): boolean {
  return /[\u0400-\u04FF]/u.test(query) || /\b(фестивал|събор|празник|карнавал|сурва)\b/iu.test(query);
}

function detectLanguageSignal(value: string): LanguageSignal {
  const normalized = value.toLocaleLowerCase("bg-BG");
  const cyrillic = (normalized.match(/[\u0400-\u04FF]/g) ?? []).length;
  const latin = (normalized.match(/[a-z]/g) ?? []).length;

  if (cyrillic > 0 && cyrillic >= latin) return "bg";
  if (cyrillic > 0) return "mixed";
  return "non_bg";
}

function candidateScore(tier: SourceAuthorityTier, signal: LanguageSignal, bgQuery: boolean, base = 0): number {
  const tierWeight: Record<SourceAuthorityTier, number> = {
    tier1_official: 100,
    tier2_reputable: 72,
    tier3_reference: 38,
    tier4_commercial: 10,
    tier5_weak: 0,
  };

  const languageWeight = bgQuery
    ? signal === "bg"
      ? 36
      : signal === "mixed"
        ? 12
        : -22
    : signal === "bg"
      ? 6
      : 0;

  return tierWeight[tier] + languageWeight + base;
}

function canonicalPriorityBucket(candidate: ScoredCandidate): number {
  const bgLike = candidate.languageSignal === "bg" || candidate.languageSignal === "mixed";
  if (bgLike && isAuthoritativeTier(candidate.tier)) return 1;
  if (bgLike && candidate.tier === "tier3_reference") return 2;
  if (!bgLike && isAuthoritativeTier(candidate.tier)) return 3;
  if (!bgLike && candidate.tier === "tier3_reference") return 4;
  return 99;
}

function pickBestCandidate(candidates: ScoredCandidate[]): CandidateSelection {
  if (candidates.length === 0) {
    return { value: null, sourceUrl: null, tier: null, languageSignal: null, reason: "No valid candidates after quality filters." };
  }

  const best = [...candidates].sort((a, b) => canonicalPriorityBucket(a) - canonicalPriorityBucket(b) || b.score - a.score)[0];
  return {
    value: best.value,
    sourceUrl: best.sourceUrl,
    tier: best.tier,
    languageSignal: best.languageSignal,
    reason: best.reason ?? `Selected via priority bucket ${canonicalPriorityBucket(best)} and highest score in bucket.`,
  };
}


function normalizeQuery(query: string): string {
  return query.trim().toLocaleLowerCase("bg-BG");
}

function decodeResearchText(value: string | null | undefined): string {
  if (!value) return "";
  return decodeHtmlEntities(value).replace(/\s+/g, " ").trim();
}

function toBulgarianTitleCase(value: string): string {
  if (!value) return value;
  return value.charAt(0).toLocaleUpperCase("bg-BG") + value.slice(1);
}

function normalizeCityMatchSpace(value: string): string {
  return value
    .toLocaleLowerCase("bg-BG")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeAliasPattern(alias: string): RegExp {
  const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^\\p{L}\\p{N}])(${escapedAlias})(?=$|[^\\p{L}\\p{N}])`, "iu");
}

function matchBulgarianCityAlias(value: string): { canonical: string; alias: string } | null {
  const normalized = normalizeCityMatchSpace(value);
  if (!normalized) return null;

  for (const entry of BULGARIAN_CITY_ALIASES) {
    for (const alias of entry.aliases) {
      if (makeAliasPattern(alias).test(normalized)) {
        return { canonical: entry.canonical, alias };
      }
    }
  }

  return null;
}

function normalizeBulgarianCityAlias(value: string): string {
  const normalized = value.trim().toLocaleLowerCase("bg-BG");
  if (!normalized) return "";

  const latinAliasMap: Array<{ pattern: RegExp; canonical: string }> = [
    { pattern: /^(st\.?\s*zagora|stara\s+zagora)$/iu, canonical: "Стара Загора" },
    { pattern: /^(veliko\s+tarnovo|veliko\s+turnovo)$/iu, canonical: "Велико Търново" },
    { pattern: /^plovdiv$/iu, canonical: "Пловдив" },
    { pattern: /^sofia$/iu, canonical: "София" },
    { pattern: /^varna$/iu, canonical: "Варна" },
    { pattern: /^burgas$/iu, canonical: "Бургас" },
    { pattern: /^ruse$/iu, canonical: "Русе" },
    { pattern: /^pernik$/iu, canonical: "Перник" },
    { pattern: /^kazanlak$/iu, canonical: "Казанлък" },
  ];

  for (const entry of latinAliasMap) {
    if (entry.pattern.test(normalized)) return entry.canonical;
  }

  const matched = matchBulgarianCityAlias(normalized);
  if (matched) return matched.canonical;

  return toBulgarianTitleCase(normalized);
}

function parseSearchItems(payload: unknown): SearchItem[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];

  const root = payload as SearchPayloadRoot;
  const dataObj = root.data && typeof root.data === "object" && !Array.isArray(root.data) ? (root.data as Record<string, unknown>) : null;
  const responseObj =
    root.response && typeof root.response === "object" && !Array.isArray(root.response) ? (root.response as Record<string, unknown>) : null;

  const candidate = Array.isArray(root.results)
    ? root.results
    : Array.isArray(root.items)
      ? root.items
      : Array.isArray(root.data)
        ? root.data
        : Array.isArray(dataObj?.results)
          ? dataObj.results
          : Array.isArray(dataObj?.items)
            ? dataObj.items
            : Array.isArray(responseObj?.results)
              ? responseObj.results
              : Array.isArray(responseObj?.items)
                ? responseObj.items
                : [];

  return candidate
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
      const item = entry as {
        url?: unknown;
        link?: unknown;
        href?: unknown;
        title?: unknown;
        snippet?: unknown;
        description?: unknown;
        content?: unknown;
      };
      const normalizedUrl =
        typeof item.url === "string" && item.url.trim()
          ? item.url.trim()
          : typeof item.link === "string" && item.link.trim()
            ? item.link.trim()
            : typeof item.href === "string"
              ? item.href.trim()
              : "";

      if (!normalizedUrl) return null;

      const title =
        typeof item.title === "string" && item.title.trim()
          ? item.title.trim()
          : typeof item.snippet === "string" && item.snippet.trim()
            ? item.snippet.trim()
            : typeof item.description === "string" && item.description.trim()
              ? item.description.trim()
              : typeof item.content === "string" && item.content.trim()
                ? item.content.trim().slice(0, 180)
                : normalizedUrl;

      return { url: normalizeUrl(normalizedUrl), title: decodeResearchText(title) };
    })
    .filter((item): item is SearchItem => item !== null);
}

function countRawResults(payload: unknown): number {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return 0;
  const root = payload as SearchPayloadRoot;

  if (Array.isArray(root.results)) return root.results.length;
  if (Array.isArray(root.items)) return root.items.length;
  if (Array.isArray(root.data)) return root.data.length;

  const dataObj = root.data && typeof root.data === "object" && !Array.isArray(root.data) ? (root.data as Record<string, unknown>) : null;
  if (Array.isArray(dataObj?.results)) return dataObj.results.length;
  if (Array.isArray(dataObj?.items)) return dataObj.items.length;

  const responseObj =
    root.response && typeof root.response === "object" && !Array.isArray(root.response) ? (root.response as Record<string, unknown>) : null;
  if (Array.isArray(responseObj?.results)) return responseObj.results.length;
  if (Array.isArray(responseObj?.items)) return responseObj.items.length;

  return 0;
}

function getTopLevelKeys(payload: unknown): string[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  return Object.keys(payload as Record<string, unknown>);
}

function logSearchDiagnostics(params: {
  query: string;
  endpoint: string;
  status?: number;
  jsonParsed: boolean;
  responseKeys: string[];
  rawResultsCount: number;
  normalizedSourcesCount: number;
}): void {
  console.info("[research:web-provider] search diagnostics", params);
}

function logRankingDiagnostics(docs: AssessedDocument[]): void {
  const topDomains = docs.slice(0, 5).map((doc) => ({
    domain: doc.domain,
    tier: doc.authorityTier,
    score: doc.qualityScore,
    language: doc.languageSignal,
    is_official: doc.isOfficial,
    authority_reason: doc.authorityReason,
  }));
  console.info("[research:web-provider] ranked source diagnostics", { top_domains: topDomains });
}

function logFieldSelectionDiagnostics(details: {
  titleValue: string | null;
  titleSource: string | null;
  titleTier: SourceAuthorityTier | null;
  titleLanguage: LanguageSignal | null;
  titleReason: string;
  dateSource: string | null;
  dateTier: SourceAuthorityTier | null;
  cityValue: string | null;
  citySource: string | null;
  cityTier: SourceAuthorityTier | null;
  cityLanguage: LanguageSignal | null;
  cityReason: string;
  locationValue: string | null;
  locationSource: string | null;
  locationTier: SourceAuthorityTier | null;
  locationLanguage: LanguageSignal | null;
  locationReason: string;
  organizerValue: string | null;
  organizerSource: string | null;
  organizerTier: SourceAuthorityTier | null;
  organizerLanguage: LanguageSignal | null;
  organizerReason: string;
  sourceUrl: string | null;
  sourceUrlTier: SourceAuthorityTier | null;
  sourceLanguage: LanguageSignal | null;
}): void {
  console.info("[research:web-provider] canonical field selection", details);
}


function logCandidateRejection(field: "title" | "city" | "location" | "organizer", value: string, reason: string, sourceUrl: string, tier: SourceAuthorityTier): void {
  console.info("[research:web-provider] candidate rejected", {
    field,
    value_preview: decodeResearchText(value).slice(0, 120),
    reason,
    source_url: sourceUrl,
    source_tier: tier,
  });
}

function isNoisyTextCandidate(value: string): string | null {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "empty_or_whitespace";
  if (NOISY_UI_TEXT_HINT.test(normalized)) return "ui_navigation_text_detected";
  if (CTA_SNIPPET_HINT.test(normalized)) return "cta_snippet_detected";
  if (GARBAGE_FRAGMENT_HINT.test(normalized)) return "broken_or_branded_fragment";
  if (/[{}<>]/.test(normalized) || /\bundefined|null\b/iu.test(normalized)) return "garbage_tokens";
  if ((normalized.match(/[,:;|]/g) ?? []).length >= 4) return "mixed_garbage_phrase";
  return null;
}

function isTavilyEndpoint(endpoint: string): boolean {
  try {
    const parsed = new URL(endpoint);
    return parsed.hostname.toLocaleLowerCase("en-US").includes("tavily.com");
  } catch {
    return endpoint.toLocaleLowerCase("en-US").includes("tavily");
  }
}

function pickConfidence(score: number): ResearchConfidenceLevel {
  if (score >= 72) return "high";
  if (score >= 45) return "medium";
  return "low";
}
const TIER_RANK: Record<SourceAuthorityTier, number> = {
  tier1_official: 1,
  tier2_reputable: 2,
  tier3_reference: 3,
  tier4_commercial: 4,
  tier5_weak: 5,
};

function isAuthoritativeTier(tier: SourceAuthorityTier): boolean {
  return tier === "tier1_official" || tier === "tier2_reputable";
}

function pickDocsByTier(docs: AssessedDocument[]): {
  authoritative: AssessedDocument[];
  fallback: AssessedDocument[];
  weakOnly: boolean;
} {
  const sorted = [...docs].sort((a, b) => TIER_RANK[a.authorityTier] - TIER_RANK[b.authorityTier] || b.qualityScore - a.qualityScore);
  const authoritative = sorted.filter((doc) => isAuthoritativeTier(doc.authorityTier));
  const reference = sorted.filter((doc) => doc.authorityTier === "tier3_reference");
  const fallback = authoritative.length > 0 ? authoritative : reference;
  const weakOnly = fallback.length === 0;
  return { authoritative, fallback, weakOnly };
}

function normalizeDateToken(value: string): string | null {
  const iso = value.match(/^((?:19|20)\d{2})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;

  const eu = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.]((?:19|20)\d{2})$/);
  if (eu) return `${eu[3]}-${eu[2].padStart(2, "0")}-${eu[1].padStart(2, "0")}`;

  return null;
}

function pickFieldValue(values: string[]): string | null {
  const filtered = values.map((value) => value.trim()).filter((value) => value.length > 0);
  if (filtered.length === 0) return null;

  const counts = new Map<string, number>();
  for (const value of filtered) {
    const key = value.toLocaleLowerCase("bg-BG");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const [bestKey] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return filtered.find((value) => value.toLocaleLowerCase("bg-BG") === bestKey) ?? filtered[0] ?? null;
}

function cleanLocationCandidate(value: string): string | null {
  const cleaned = value.replace(/\s+/g, " ").replace(/[.;]+$/g, "").trim();
  if (!cleaned) return null;
  if (cleaned.length > 80) return null;
  const sentenceParts = cleaned.split(/[.!?]/).filter((part) => part.trim().length > 0);
  if (sentenceParts.length > 1) return null;
  if (/,/.test(cleaned) && cleaned.split(",").length > 3) return null;
  if (!/[\p{L}]/u.test(cleaned)) return null;
  if (/\d{4}\s+[\p{L}\s]+,\s*(ул\.?|бул\.?|street)/iu.test(cleaned)) return null;
  if (/[,\-]\s*(ул\.?|бул\.?|street|кв\.?|жк\.?)\s*$/iu.test(cleaned)) return null;
  if (!LOCATION_VENUE_HINT.test(cleaned) && cleaned.split(/\s+/).length > 6) return null;
  if (isNoisyTextCandidate(cleaned)) return null;
  return cleaned;
}

function stripSiteBrandTail(value: string): string {
  return value
    .replace(/\s+[|·•]\s+[^|·•]{2,120}$/u, "")
    .replace(/\s+[-–—]\s+(официален\s+сайт|official\s+site|home|начало|tripadvisor|facebook)\b.*$/iu, "")
    .trim();
}

function isWeakTitle(value: string): boolean {
  const title = value.toLocaleLowerCase("bg-BG");
  return /(tripadvisor|couchsurfing|things to do|booking|events? in|directory|listing|profile|group|page)\b/iu.test(title);
}

function isPageBrandFormatting(value: string): boolean {
  const title = value.toLocaleLowerCase("bg-BG");
  return /\b(home|начало|официален\s+сайт|official\s+site|tripadvisor|facebook)\b/iu.test(title) || /^[^\p{L}\d]*$/u.test(value);
}

function isLikelyEventTitle(value: string): boolean {
  const title = value.toLocaleLowerCase("bg-BG");
  if (title.length < 8) return false;
  if (isWeakTitle(title)) return false;
  return /\b(фестивал|festival|carnival|маскарад|празник|събор|surva)\b/iu.test(title);
}

function extractEventLikeBulgarianTitle(value: string): { title: string | null; pattern: string } {
  const decoded = decodeResearchText(value);
  const explicitDateEventMatch = decoded.match(/\b(?:датите\s+на|дните\s+на|програма(?:та)?\s+за)\s+([\p{Lu}][^|–—-]{4,120}?\b(?:фестивал|празник|събор|карнавал|маскарад)\b[^|–—-]{0,60}\b(?:19|20)\d{2})/iu);
  if (explicitDateEventMatch?.[1]) {
    return { title: explicitDateEventMatch[1].replace(/[\s,;:.!\-–—]+$/u, "").trim(), pattern: "bg_dates_of_event_phrase" };
  }

  const eventMatch = decoded.match(/([\p{Lu}][^|]{4,180}?\b(?:фестивал|празник|събор|карнавал|маскарад)\b[^|]{0,120})/iu);
  if (!eventMatch?.[1]) return { title: null, pattern: "no_event_pattern_match" };

  const extracted = eventMatch[1]
    .replace(/[\s,;:.!\-–—]+$/u, "")
    .replace(/\s+\b(официален\s+сайт|official\s+site|посети\s+[\p{L}\s]+|visit\s+[\p{L}\s]+)$/iu, "")
    .replace(/^\s*(кулминационните\s+дни\s+на|кулминация(?:та)?\s+на|дните\s+на)\s+/iu, "")
    .replace(/\s+(?:в|на)\s+[\p{Lu}][\p{L}\s-]{2,40}\s+през\s+(19|20)\d{2}\s*г\.?/iu, "")
    .replace(/\s+през\s+(19|20)\d{2}\s*г\.?/iu, "")
    .trim();

  return { title: extracted, pattern: "bg_event_segment_from_headline" };
}

function cleanTitleCandidate(value: string): { cleaned: string | null; acceptanceReason: string | null; decoded: string; stripped: string; pattern: string } {
  const decoded = decodeResearchText(value);
  const stripped = stripSiteBrandTail(decoded);

  if (!stripped) return { cleaned: null, acceptanceReason: null, decoded, stripped, pattern: "empty_after_brand_strip" };

  const noisyReason = isNoisyTextCandidate(stripped);
  if (noisyReason) return { cleaned: null, acceptanceReason: null, decoded, stripped, pattern: noisyReason };

  if (isLikelyEventTitle(stripped) && !isPageBrandFormatting(stripped)) {
    return { cleaned: toBulgarianTitleCase(stripped), acceptanceReason: "direct_event_title", decoded, stripped, pattern: "direct_event_title" };
  }

  const extracted = extractEventLikeBulgarianTitle(stripped);
  if (extracted.title && isLikelyEventTitle(extracted.title)) {
    return {
      cleaned: toBulgarianTitleCase(extracted.title),
      acceptanceReason: "event_subtitle_extracted_from_bulgarian_authoritative_headline",
      decoded,
      stripped,
      pattern: extracted.pattern,
    };
  }

  return { cleaned: null, acceptanceReason: null, decoded, stripped, pattern: extracted.pattern };
}

function pickTitleWithSource(
  docs: AssessedDocument[],
  bgQuery: boolean,
): CandidateSelection {
  const candidates: ScoredCandidate[] = [];

  for (const doc of docs) {
    const sourceUrl = normalizeUrl(doc.canonicalUrl ?? doc.url);
    if (!isAuthoritativeTier(doc.authorityTier) && doc.authorityTier !== "tier3_reference") continue;
    if (!isAuthoritativeTier(doc.authorityTier) && bgQuery) {
      logCandidateRejection("title", doc.title, "non_authoritative_source_for_canonical_bg_title", sourceUrl, doc.authorityTier);
      continue;
    }
    const titleCandidate = cleanTitleCandidate(doc.title);
    console.info("[research:web-provider] title candidate normalization", {
      source_url: sourceUrl,
      decoded_before_cleaning: titleCandidate.decoded.slice(0, 180),
      after_cleaning: titleCandidate.cleaned,
      extraction_pattern: titleCandidate.pattern,
      tier: doc.authorityTier,
    });

    if (!titleCandidate.cleaned) {
      const noisyReason = titleCandidate.stripped ? isNoisyTextCandidate(titleCandidate.stripped) : "empty_after_brand_strip";
      logCandidateRejection("title", doc.title, noisyReason ?? "not_likely_event_title_or_brand_tail", sourceUrl, doc.authorityTier);
      continue;
    }

    const signal = detectLanguageSignal(titleCandidate.cleaned);
    const compactNameBonus = signal === "bg" ? Math.max(0, 16 - Math.floor(titleCandidate.cleaned.length / 4)) : 0;
    candidates.push({
      value: titleCandidate.cleaned,
      sourceUrl: normalizeUrl(doc.canonicalUrl ?? doc.url),
      tier: doc.authorityTier,
      languageSignal: signal,
      score: candidateScore(doc.authorityTier, signal, bgQuery, doc.qualityScore + compactNameBonus),
      reason:
        signal === "bg"
          ? titleCandidate.acceptanceReason === "event_subtitle_extracted_from_bulgarian_authoritative_headline"
            ? "Accepted Bulgarian authoritative headline after stripping branded tail and preserving event segment."
            : "Bulgarian event title from authoritative/reputable source; shorter canonical event name preferred."
          : "Fallback non-Bulgarian title because no stronger Bulgarian title candidate won.",
    });
  }

  return pickBestCandidate(candidates);
}


function fallbackBulgarianTitleFromQuery(query: string, docs: AssessedDocument[], bgQuery: boolean): CandidateSelection {
  if (!bgQuery) return { value: null, sourceUrl: null, tier: null, languageSignal: null, reason: "Not a Bulgarian query." };
  const authoritativeBgDoc = docs.find((doc) => isAuthoritativeTier(doc.authorityTier) && (doc.languageSignal === "bg" || doc.languageSignal === "mixed"));
  if (!authoritativeBgDoc) {
    return { value: null, sourceUrl: null, tier: null, languageSignal: null, reason: "No authoritative Bulgarian source for conservative title fallback." };
  }

  const normalized = query
    .replace(/\s+/g, " ")
    .replace(/\b(официален|official|програма|program|202\d|19\d\d)\b/giu, "")
    .trim();

  const baseTitle = /\bфестивал\b/iu.test(normalized) ? normalized : `${normalized} фестивал`;
  const cleanedCandidate =
    cleanTitleCandidate(baseTitle).cleaned
      ?.replace(/\s+/g, " ")
      .replace(/(^|\s)(на|в)\s*$/iu, "")
      .trim() ?? null;

  if (!cleanedCandidate || !isLikelyEventTitle(cleanedCandidate)) {
    return { value: null, sourceUrl: null, tier: null, languageSignal: null, reason: "Query fallback did not form a safe Bulgarian festival title." };
  }

  return {
    value: toBulgarianTitleCase(cleanedCandidate),
    sourceUrl: normalizeUrl(authoritativeBgDoc.canonicalUrl ?? authoritativeBgDoc.url),
    tier: authoritativeBgDoc.authorityTier,
    languageSignal: "bg",
    reason: "Conservative Bulgarian title fallback from query, gated by authoritative Bulgarian source evidence.",
  };
}

function toIsoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function extractBgDateRanges(value: string, fallbackYear: number | null): Array<{ startDate: string; endDate: string; evidence: string }> {
  const normalized = decodeResearchText(value).toLocaleLowerCase("bg-BG");
  const out: Array<{ startDate: string; endDate: string; evidence: string }> = [];
  const year = Number((normalized.match(/\b((?:19|20)\d{2})\s*г?\.?\b/u)?.[1] ?? fallbackYear ?? 0));
  if (!year) return out;

  for (const [monthText, monthNum] of Object.entries(BG_MONTH_MAP)) {
    const listPattern = new RegExp(`\\b(\\d{1,2})\\s*,\\s*(\\d{1,2})\\s*и\\s*(\\d{1,2})\\s+${monthText}\\b`, "giu");
    for (const match of normalized.matchAll(listPattern)) {
      const days = [Number(match[1]), Number(match[2]), Number(match[3])].sort((a, b) => a - b);
      const startDate = toIsoDate(year, monthNum, days[0]);
      const endDate = toIsoDate(year, monthNum, days[2]);
      if (startDate && endDate) out.push({ startDate, endDate, evidence: match[0] });
    }

    const rangePattern = new RegExp(`\\b(\\d{1,2})\\s*[–—-]\\s*(\\d{1,2})\\s+${monthText}(?:\\s+((?:19|20)\\d{2}))?\\b`, "giu");
    for (const match of normalized.matchAll(rangePattern)) {
      const rangeYear = Number(match[3] ?? year);
      const startDate = toIsoDate(rangeYear, monthNum, Number(match[1]));
      const endDate = toIsoDate(rangeYear, monthNum, Number(match[2]));
      if (startDate && endDate) out.push({ startDate, endDate, evidence: match[0] });
    }
  }

  return out;
}

function pickDateRangeFromStrongSources(docs: AssessedDocument[]): {
  startDate: string | null;
  endDate: string | null;
  warning: string | null;
  sourceUrl: string | null;
  tier: SourceAuthorityTier | null;
  candidates: Array<{ startDate: string; endDate: string; sourceUrl: string; tier: SourceAuthorityTier; languageSignal: LanguageSignal }>;
} {
  if (docs.length === 0) {
    return { startDate: null, endDate: null, warning: "No authoritative/reputable sources available for reliable date extraction.", sourceUrl: null, tier: null, candidates: [] };
  }

  const tokenOwners: Array<{ startDate: string; endDate: string; sourceUrl: string; tier: SourceAuthorityTier; evidence: string }> = [];
  for (const doc of docs) {
    if (!isAuthoritativeTier(doc.authorityTier)) continue;
    const sourceUrl = normalizeUrl(doc.canonicalUrl ?? doc.url);
    const docYear = Number((`${doc.title} ${doc.snippet}`.match(/\b((?:19|20)\d{2})\b/u)?.[1] ?? 0));
    const explicitRanges = [
      ...extractBgDateRanges(doc.title, docYear || null),
      ...extractBgDateRanges(doc.snippet.slice(0, 460), docYear || null),
    ];
    for (const range of explicitRanges) {
      tokenOwners.push({ ...range, sourceUrl, tier: doc.authorityTier, evidence: range.evidence });
    }

    for (const token of doc.dateLike) {
      const normalized = normalizeDateToken(token);
      if (!normalized) continue;
      tokenOwners.push({ startDate: normalized, endDate: normalized, sourceUrl, tier: doc.authorityTier, evidence: token });
    }
  }

  console.info("[research:web-provider] date extraction candidates", {
    candidates: tokenOwners.slice(0, 12).map((item) => ({
      start_date: item.startDate,
      end_date: item.endDate,
      source_url: item.sourceUrl,
      tier: item.tier,
      evidence: item.evidence.slice(0, 120),
    })),
  });

  const rangeVotes = new Map<string, { count: number; sample: typeof tokenOwners[number] }>();
  for (const item of tokenOwners) {
    const key = `${item.startDate}..${item.endDate}`;
    const existing = rangeVotes.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      rangeVotes.set(key, { count: 1, sample: item });
    }
  }
  const rankedRanges = [...rangeVotes.entries()].sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]));

  if (rankedRanges.length === 0) {
    return { startDate: null, endDate: null, warning: "No reliable date-like pattern found in authoritative/reputable sources.", sourceUrl: null, tier: null, candidates: [] };
  }

  if (rankedRanges.length > 1 && rankedRanges[0][1].count === rankedRanges[1][1].count) {
    return { startDate: null, endDate: null, warning: "Date candidates are conflicting across authoritative/reputable sources.", sourceUrl: null, tier: null, candidates: rankedRanges.map((entry) => ({ startDate: entry[1].sample.startDate, endDate: entry[1].sample.endDate, sourceUrl: entry[1].sample.sourceUrl, tier: entry[1].sample.tier, languageSignal: detectLanguageSignal(entry[1].sample.evidence) })) };
  }

  const winner = rankedRanges[0][1].sample;
  const startDate = winner.startDate;
  const endDate = winner.endDate;

  if (startDate && endDate && endDate < startDate) {
    return { startDate: null, endDate: null, warning: "Date candidates conflict in ordering across authoritative/reputable sources.", sourceUrl: null, tier: null, candidates: rankedRanges.map((entry) => ({ startDate: entry[1].sample.startDate, endDate: entry[1].sample.endDate, sourceUrl: entry[1].sample.sourceUrl, tier: entry[1].sample.tier, languageSignal: detectLanguageSignal(entry[1].sample.evidence) })) };
  }

  return { startDate, endDate, warning: null, sourceUrl: winner.sourceUrl, tier: winner.tier, candidates: rankedRanges.map((entry) => ({ startDate: entry[1].sample.startDate, endDate: entry[1].sample.endDate, sourceUrl: entry[1].sample.sourceUrl, tier: entry[1].sample.tier, languageSignal: detectLanguageSignal(entry[1].sample.evidence) })) };
}

function pickLocationWithSource(
  docs: AssessedDocument[],
  bgQuery: boolean,
): CandidateSelection {
  const candidates: ScoredCandidate[] = [];
  for (const doc of docs) {
    const sourceUrl = normalizeUrl(doc.canonicalUrl ?? doc.url);
    if (!isAuthoritativeTier(doc.authorityTier) && doc.authorityTier !== "tier3_reference") continue;
    if (!isAuthoritativeTier(doc.authorityTier) && bgQuery) {
      logCandidateRejection("location", doc.locationLike.join(" | "), "non_authoritative_source_for_canonical_bg_location", sourceUrl, doc.authorityTier);
      continue;
    }

    const cleaned = doc.locationLike.map((value) => cleanLocationCandidate(decodeResearchText(value))).filter((value): value is string => Boolean(value));
    const value = pickFieldValue(cleaned.filter((item) => !/^\d{4}\s+/u.test(item)));
    if (!value) {
      logCandidateRejection("location", doc.locationLike.join(" | "), "location_fragments_rejected_by_cleaner", sourceUrl, doc.authorityTier);
      continue;
    }

    if (!LOCATION_VENUE_HINT.test(value) && /(ул\.?|бул\.?|жк\.?|кв\.?)/iu.test(value)) {
      logCandidateRejection("location", value, "partial_address_without_venue_context", sourceUrl, doc.authorityTier);
      continue;
    }

    const signal = detectLanguageSignal(value);
    candidates.push({
      value,
      sourceUrl,
      tier: doc.authorityTier,
      languageSignal: signal,
      score: candidateScore(doc.authorityTier, signal, bgQuery, doc.qualityScore),
      reason: "Venue/place-like location from higher-authority source after fragment filtering.",
    });
  }

  return pickBestCandidate(candidates);
}

function pickOrganizerWithSource(
  docs: AssessedDocument[],
  bgQuery: boolean,
): CandidateSelection {
  const candidates: ScoredCandidate[] = [];

  const cleanOrganizerCandidate = (value: string): string | null => {
    const cleaned = value.replace(/\s+/g, " ").replace(/[.;]+$/g, "").trim();
    if (LOW_AUTHORITY_DOMAIN_HINT.test(cleaned)) return null;
    if (isNoisyTextCandidate(cleaned)) return null;
    if (!cleaned || cleaned.length < 3 || cleaned.length > 90) return null;
    if (/[!?]/.test(cleaned)) return null;
    if ((cleaned.match(/[,.;:]/g) ?? []).length > 2) return null;
    if (/\b(ще|представя|заповядайте|очаква|can join|join us|learn more|прочетете)\b/iu.test(cleaned)) return null;
    if (!ORGANIZER_ENTITY_HINT.test(cleaned) && cleaned.split(/\s+/).length > 6) return null;
    return cleaned;
  };

  for (const doc of docs) {
    const sourceUrl = normalizeUrl(doc.canonicalUrl ?? doc.url);
    if (!isAuthoritativeTier(doc.authorityTier) && doc.authorityTier !== "tier3_reference") continue;
    if (!isAuthoritativeTier(doc.authorityTier) && bgQuery) {
      logCandidateRejection("organizer", doc.organizerLike.join(" | "), "non_authoritative_source_for_canonical_bg_organizer", sourceUrl, doc.authorityTier);
      continue;
    }
    const value = pickFieldValue(doc.organizerLike.map((item) => cleanOrganizerCandidate(decodeResearchText(item))).filter((item): item is string => Boolean(item)));
    if (!value) {
      logCandidateRejection("organizer", doc.organizerLike.join(" | "), "organizer_fragments_rejected_by_cleaner", sourceUrl, doc.authorityTier);
      continue;
    }
    if (!ORGANIZER_ENTITY_HINT.test(value) && value.split(/\s+/).length < 2) {
      logCandidateRejection("organizer", value, "missing_organizer_entity_structure", sourceUrl, doc.authorityTier);
      continue;
    }
    const signal = detectLanguageSignal(value);
    candidates.push({
      value,
      sourceUrl,
      tier: doc.authorityTier,
      languageSignal: signal,
      score: candidateScore(doc.authorityTier, signal, bgQuery, doc.qualityScore),
      reason: "Organizer candidate looks like an entity (institution/association/committee), not prose.",
    });
  }
  return pickBestCandidate(candidates);
}

function pickCityFromDocs(
  docs: AssessedDocument[],
  bgQuery: boolean,
  query: string,
): CandidateSelection {
  const candidates: ScoredCandidate[] = [];

  const findCity = (value: string): { city: string; alias: string } | null => {
    const decoded = decodeResearchText(value);
    const directMatch = matchBulgarianCityAlias(decoded);
    if (directMatch) return { city: directMatch.canonical, alias: directMatch.alias };

    const explicitMatches = decoded.match(/\b(?:гр\.?\s*)?[\p{Lu}][\p{L}]+(?:\s+[\p{Lu}][\p{L}]+)?\b/gu) ?? [];
    for (const explicitMatch of explicitMatches) {
      const cleaned = explicitMatch.replace(/^\s*гр\.?\s*/iu, "").trim();
      const matchedAlias = matchBulgarianCityAlias(cleaned);
      if (matchedAlias) return { city: matchedAlias.canonical, alias: matchedAlias.alias };
    }

    return null;
  };

  const queryCityRaw = findCity(query);
  const queryCity = queryCityRaw ? normalizeBulgarianCityAlias(queryCityRaw.city) : null;
  console.info("[research:web-provider] detected query city", {
    normalized_query: normalizeQuery(query),
    matched_alias: queryCityRaw?.alias ?? null,
    query_city: queryCity,
  });
  const authoritativeCityVotes = new Map<string, number>();

  for (const doc of docs) {
    const sourceUrl = normalizeUrl(doc.canonicalUrl ?? doc.url);
    if (!isAuthoritativeTier(doc.authorityTier) && doc.authorityTier !== "tier3_reference") continue;
    if (!isAuthoritativeTier(doc.authorityTier) && bgQuery) {
      logCandidateRejection("city", doc.title, "non_authoritative_source_for_canonical_bg_city", sourceUrl, doc.authorityTier);
      continue;
    }
    const pool = [...doc.locationLike, doc.title, doc.snippet.slice(0, 380)].map((item) => decodeResearchText(item));
    const city = pickFieldValue(
      pool
        .map((item) => findCity(item))
        .filter((item): item is { city: string; alias: string } => Boolean(item))
        .map((item) => normalizeBulgarianCityAlias(item.city)),
    );
    if (!city) {
      logCandidateRejection("city", doc.title, "no_city_detected_from_document_pool", sourceUrl, doc.authorityTier);
      continue;
    }
    if (isAuthoritativeTier(doc.authorityTier)) {
      authoritativeCityVotes.set(city, (authoritativeCityVotes.get(city) ?? 0) + 1);
    }
    const signal = detectLanguageSignal(city);
    candidates.push({
      value: city,
      sourceUrl: normalizeUrl(doc.canonicalUrl ?? doc.url),
      tier: doc.authorityTier,
      languageSignal: signal,
      score: candidateScore(doc.authorityTier, signal, bgQuery, doc.qualityScore),
      reason: "City normalized from Bulgarian authoritative location/title/snippet signals.",
    });
  }

  if (queryCity) {
    const votes = authoritativeCityVotes.get(queryCity) ?? 0;
    const hasAuthoritativeBgEvidence = candidates.some((item) => isAuthoritativeTier(item.tier) && item.languageSignal !== "non_bg");
    if (votes >= 1 || hasAuthoritativeBgEvidence) {
      console.info("[research:web-provider] city extraction reason", {
        reason: votes >= 1 ? "query_city_confirmed_by_authoritative_bg_sources" : "query_city_supported_by_authoritative_bg_candidates",
        query_city: queryCity,
        authoritative_votes: votes,
      });
      const matched = candidates.find((item) => item.value === queryCity) ?? null;
      return {
        value: queryCity,
        sourceUrl: matched?.sourceUrl ?? null,
        tier: matched?.tier ?? null,
        languageSignal: "bg",
        reason: "Query city confirmed by authoritative Bulgarian source evidence.",
      };
    }
  }

  const selection = pickBestCandidate(candidates);
  console.info("[research:web-provider] city extraction reason", {
    reason: selection.reason,
    selected_city: selection.value,
    query_city: queryCity,
    candidate_count: candidates.length,
  });
  return selection;
}


function dedupeFieldCandidates(candidates: ResearchFieldCandidate[]): ResearchFieldCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((item) => {
    const key = `${item.value.toLocaleLowerCase("bg-BG")}::${item.source_url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildFieldCandidates(selection: CandidateSelection, extras: ScoredCandidate[] = []): ResearchFieldCandidate[] {
  const merged: ResearchFieldCandidate[] = [];
  if (selection.value && selection.sourceUrl) {
    merged.push({
      value: selection.value,
      source_url: normalizeUrl(selection.sourceUrl),
      tier: selection.tier,
      language: selection.languageSignal,
      reason: selection.reason,
    });
  }

  for (const item of extras) {
    merged.push({
      value: item.value,
      source_url: normalizeUrl(item.sourceUrl),
      tier: item.tier,
      language: item.languageSignal,
      reason: item.reason ?? "Alternative candidate collected from source text.",
    });
  }

  return dedupeFieldCandidates(
    merged.sort((a, b) => (TIER_RANK[a.tier ?? "tier5_weak"] - TIER_RANK[b.tier ?? "tier5_weak"]) || a.value.localeCompare(b.value, "bg")),
  );
}

function collectCandidatesFromDocs(docs: AssessedDocument[], picker: (doc: AssessedDocument) => string | null): ScoredCandidate[] {
  const out: ScoredCandidate[] = [];
  for (const doc of docs) {
    const value = picker(doc);
    if (!value) continue;
    const sourceUrl = normalizeUrl(doc.canonicalUrl ?? doc.url);
    const signal = detectLanguageSignal(value);
    out.push({
      value,
      sourceUrl,
      tier: doc.authorityTier,
      languageSignal: signal,
      score: candidateScore(doc.authorityTier, signal, true, doc.qualityScore),
      reason: "Collected as alternative candidate from extracted source.",
    });
  }
  return out.sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier] || b.score - a.score);
}

function normalizeExcerptSegment(segment: string): string {
  return decodeResearchText(segment).replace(/\s+/g, " ").trim();
}

function isLowValueExcerptSegment(segment: string): boolean {
  if (segment.length < 24) return true;
  if (NOISY_UI_TEXT_HINT.test(segment)) return true;
  if (CTA_SNIPPET_HINT.test(segment)) return true;
  if (GARBAGE_FRAGMENT_HINT.test(segment)) return true;
  return false;
}

function buildLlmTextExcerpt(doc: AssessedDocument): string {
  const rawSegments = [
    doc.title,
    doc.description ?? "",
    ...(doc.dateLike ?? []),
    ...(doc.locationLike ?? []),
    ...(doc.organizerLike ?? []),
    doc.snippet,
  ];

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const rawSegment of rawSegments) {
    const segment = normalizeExcerptSegment(rawSegment);
    if (!segment || isLowValueExcerptSegment(segment)) continue;

    const clipped = segment.slice(0, LLM_MAX_SEGMENT_CHARS);
    const dedupeKey = clipped.toLocaleLowerCase("bg-BG");
    if (seen.has(dedupeKey)) continue;

    seen.add(dedupeKey);
    deduped.push(clipped);

    const currentLength = deduped.join("\n").length;
    if (currentLength >= LLM_MAX_EXCERPT_CHARS_PER_SOURCE) break;
  }

  return deduped.join("\n").slice(0, LLM_MAX_EXCERPT_CHARS_PER_SOURCE).trim();
}

function prepareLlmSourcesForExtraction(docs: AssessedDocument[]): PreparedLlmSources {
  const rejected: LlmSourceRejection[] = [];

  const eligibleDocs = docs.filter((doc) => {
    const sourceUrl = normalizeUrl(doc.canonicalUrl ?? doc.url);
    const bestExcerpt = buildLlmTextExcerpt(doc);

    if (doc.authorityTier === "tier5_weak") {
      rejected.push({ sourceUrl, domain: doc.domain, tier: doc.authorityTier, reason: "authority_tier_too_weak" });
      return false;
    }

    if (bestExcerpt.length < LLM_MIN_EXCERPT_LENGTH) {
      rejected.push({ sourceUrl, domain: doc.domain, tier: doc.authorityTier, reason: "insufficient_extracted_text" });
      return false;
    }

    return true;
  });

  const selectedDocs = [...eligibleDocs]
    .sort((a, b) => {
      const tierDelta = TIER_RANK[a.authorityTier] - TIER_RANK[b.authorityTier];
      if (tierDelta !== 0) return tierDelta;
      if (a.languageSignal !== b.languageSignal) {
        const aBg = a.languageSignal === "bg" || a.languageSignal === "mixed";
        const bBg = b.languageSignal === "bg" || b.languageSignal === "mixed";
        if (aBg !== bBg) return aBg ? -1 : 1;
      }
      return b.qualityScore - a.qualityScore;
    })
    .slice(0, LLM_MAX_SOURCES);

  return {
    eligible: selectedDocs.map((doc) => ({
      source_url: normalizeUrl(doc.canonicalUrl ?? doc.url),
      domain: doc.domain,
      source_title: doc.title,
      tier: doc.authorityTier,
      language: doc.languageSignal,
      text_excerpt: buildLlmTextExcerpt(doc),
      metadata: {
        description: doc.description ? decodeResearchText(doc.description).slice(0, 220) : null,
        date_hints: doc.dateLike.slice(0, 4),
      },
    })),
    rejected,
  };
}

function applyReasonToFieldCandidates(candidates: ResearchFieldCandidate[], reason: string): ResearchFieldCandidate[] {
  return candidates.map((candidate) => ({ ...candidate, reason: candidate.reason ?? reason }));
}

function applyReasonToDateCandidates(candidates: ResearchDateCandidate[], reason: string): ResearchDateCandidate[] {
  return candidates.map((candidate) => ({ ...candidate, reason: candidate.reason ?? reason }));
}

function buildLowConfidenceResult(query: string, warning: string): ResearchFestivalResult {
  return {
    query,
    normalized_query: normalizeQuery(query),
    best_guess: {
      title: null,
      start_date: null,
      end_date: null,
      city: null,
      location: null,
      description: null,
      organizer: null,
      hero_image: null,
      tags: [],
    },
    candidates: {
      titles: [],
      dates: [],
      cities: [],
      locations: [],
      organizers: [],
    },
    sources: [],
    confidence: {
      overall: "low",
      title: "low",
      dates: "low",
      city: "low",
      location: "low",
      description: "low",
      organizer: "low",
      hero_image: "low",
    },
    warnings: [warning],
    evidence: [],
    metadata: {
      provider: "web",
      mode: "real_web",
      source_count: 0,
    },
  };
}

async function searchWebQuery(query: string): Promise<ResearchSource[]> {
  const endpoint = process.env.WEB_RESEARCH_SEARCH_URL;
  const apiKey = process.env.WEB_RESEARCH_API_KEY;

  if (!endpoint || !apiKey) {
    return [];
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const limit = Number(process.env.WEB_RESEARCH_SEARCH_LIMIT ?? "10");
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 20) : 10;
    const useTavily = isTavilyEndpoint(endpoint);

    const requestInit: RequestInit = useTavily
      ? {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            api_key: apiKey,
            query,
            max_results: safeLimit,
            search_depth: "advanced",
            include_answer: false,
            include_raw_content: false,
          }),
          cache: "no-store",
        }
      : {
          method: "GET",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
          },
          cache: "no-store",
        };

    const requestUrl = new URL(endpoint);
    if (!useTavily) {
      requestUrl.searchParams.set("q", query);
      requestUrl.searchParams.set("limit", String(safeLimit));
    }

    const response = await fetch(requestUrl, requestInit);

    if (!response.ok) {
      logSearchDiagnostics({
        query,
        endpoint: requestUrl.toString(),
        status: response.status,
        jsonParsed: false,
        responseKeys: [],
        rawResultsCount: 0,
        normalizedSourcesCount: 0,
      });
      return [];
    }

    let jsonParsed = false;
    const payload = (await response
      .json()
      .then((data) => {
        jsonParsed = true;
        return data;
      })
      .catch(() => null)) as unknown;
    const items = parseSearchItems(payload);
    const normalizedSources = items.map((item) => ({
      url: item.url,
      title: item.title,
      domain: extractDomain(item.url),
      is_official: false,
    }));

    logSearchDiagnostics({
      query,
      endpoint: requestUrl.toString(),
      status: response.status,
      jsonParsed,
      responseKeys: getTopLevelKeys(payload),
      rawResultsCount: countRawResults(payload),
      normalizedSourcesCount: normalizedSources.length,
    });

    return normalizedSources;
  } catch {
    logSearchDiagnostics({
      query,
      endpoint,
      jsonParsed: false,
      responseKeys: [],
      rawResultsCount: 0,
      normalizedSourcesCount: 0,
    });
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function runWebResearch(query: string): Promise<ResearchFestivalResult> {
  const warnings: string[] = [];
  const bgQuery = isBulgarianQuery(query);
  const expandedQueries = buildResearchQueries(query);

  if (expandedQueries.length === 0) {
    return buildLowConfidenceResult(query, "Query is empty after normalization.");
  }

  const rawSources = (await Promise.all(expandedQueries.map((item) => searchWebQuery(item)))).flat();
  if (rawSources.length === 0) {
    return buildLowConfidenceResult(query, "Real web provider returned no sources.");
  }

  const rankedSources = dedupeAndRankSources(rawSources, query, 10);
  const extractedDocs = (await Promise.all(rankedSources.slice(0, 6).map((source) => fetchSourceDocument(source)))).filter(
    (item): item is ExtractedSourceDocument => item !== null,
  );

  if (extractedDocs.length === 0) {
    return { ...buildLowConfidenceResult(query, "Unable to extract content from ranked sources."), sources: rankedSources };
  }

  const assessedDocs: AssessedDocument[] = extractedDocs
    .map((doc) => {
      const assessment = assessSourceQuality(
        {
          url: doc.url,
          domain: doc.domain,
          title: doc.title,
          is_official: doc.isOfficial,
        },
        query,
      );

      const isStrong = assessment.qualityClass === "strong";
      return {
        ...doc,
        qualityClass: assessment.qualityClass,
        qualityScore: assessment.score,
        authorityTier: assessment.authorityTier,
        isStrong,
        languageSignal: assessment.languageSignal,
        authorityReason: assessment.authorityReason,
      };
    })
    .sort((a, b) => TIER_RANK[a.authorityTier] - TIER_RANK[b.authorityTier] || b.qualityScore - a.qualityScore);

  logRankingDiagnostics(assessedDocs);

  const { authoritative, fallback, weakOnly } = pickDocsByTier(assessedDocs);

  const titleSelection = pickTitleWithSource(fallback, bgQuery);
  const dateRange = pickDateRangeFromStrongSources(fallback);
  const citySelection = pickCityFromDocs(fallback, bgQuery, query);
  const locationSelection = pickLocationWithSource(fallback, bgQuery);
  const organizerSelection = pickOrganizerWithSource(fallback, bgQuery);

  if (dateRange.warning) warnings.push(dateRange.warning);

  const preferredDoc =
    bgQuery
      ? fallback.find((doc) => detectLanguageSignal(`${doc.title} ${doc.snippet}`) !== "non_bg") ?? fallback[0] ?? null
      : fallback[0] ?? null;
  const sourceUrl = preferredDoc ? normalizeUrl(preferredDoc.canonicalUrl ?? preferredDoc.url) : null;

  const fallbackTitleSelection = titleSelection.value ? titleSelection : fallbackBulgarianTitleFromQuery(query, fallback, bgQuery);
  const title = weakOnly ? null : (titleSelection.value ?? fallbackTitleSelection.value);
  const startDate = weakOnly ? null : dateRange.startDate;
  const endDate = weakOnly ? null : dateRange.endDate;
  const cityCandidate = weakOnly ? null : citySelection.value;
  const location = weakOnly ? null : locationSelection.value;
  const organizer = weakOnly ? null : organizerSelection.value;
  const description =
    preferredDoc?.description ??
    (preferredDoc && preferredDoc.snippet.length > 120 ? `${preferredDoc.snippet.slice(0, 220)}...` : null);
  const heroImage = preferredDoc?.ogImage ?? null;

  if (!title) warnings.push("No reliable event title found in authoritative/reputable sources.");
  if (!startDate) warnings.push("No reliable start date found in authoritative/reputable sources.");
  if (!cityCandidate) warnings.push("City could not be confirmed from authoritative/reputable sources.");
  if (!organizer) warnings.push("Organizer set to null: only low-quality/prose organizer candidates were found.");
  if (!location) warnings.push("Location set to null: only partial address or low-quality location candidates were found.");
  if (bgQuery && titleSelection.languageSignal === "non_bg" && (authoritative.some((doc) => doc.languageSignal === "bg" || doc.languageSignal === "mixed") || fallback.some((doc) => doc.languageSignal === "bg" || doc.languageSignal === "mixed"))) {
    warnings.push("Title remained non-Bulgarian despite Bulgarian authoritative/reputable sources; confidence reduced.");
  } else if (bgQuery && titleSelection.languageSignal === "non_bg") {
    warnings.push("Title remained non-Bulgarian because authoritative Bulgarian evidence was not confirmed.");
  }
  if (bgQuery && locationSelection.languageSignal === "non_bg") warnings.push("Location remained non-Bulgarian because authoritative Bulgarian evidence was not confirmed.");

  if (weakOnly) {
    warnings.push("Only commercial or weak sources were found; canonical fields intentionally left null/low-confidence.");
  }

  logFieldSelectionDiagnostics({
    titleValue: title,
    titleSource: (titleSelection.sourceUrl ?? fallbackTitleSelection.sourceUrl),
    titleTier: (titleSelection.tier ?? fallbackTitleSelection.tier),
    titleLanguage: (titleSelection.languageSignal ?? fallbackTitleSelection.languageSignal),
    titleReason: titleSelection.value ? titleSelection.reason : fallbackTitleSelection.reason,
    dateSource: dateRange.sourceUrl,
    dateTier: dateRange.tier,
    cityValue: cityCandidate,
    citySource: citySelection.sourceUrl,
    cityTier: citySelection.tier,
    cityLanguage: citySelection.languageSignal,
    cityReason: citySelection.reason,
    locationValue: location,
    locationSource: locationSelection.sourceUrl,
    locationTier: locationSelection.tier,
    locationLanguage: locationSelection.languageSignal,
    locationReason: locationSelection.reason,
    organizerValue: organizer,
    organizerSource: organizerSelection.sourceUrl,
    organizerTier: organizerSelection.tier,
    organizerLanguage: organizerSelection.languageSignal,
    organizerReason: organizerSelection.reason,
    sourceUrl,
    sourceUrlTier: preferredDoc?.authorityTier ?? null,
    sourceLanguage: preferredDoc ? detectLanguageSignal(`${preferredDoc.title} ${preferredDoc.snippet}`) : null,
  });

  const authoritativeCount = assessedDocs.filter((doc) => isAuthoritativeTier(doc.authorityTier)).length;
  const officialCount = assessedDocs.filter((doc) => doc.authorityTier === "tier1_official").length;
  const score = Math.max(
    0,
    Math.min(
      100,
      officialCount * 22 + authoritativeCount * 14 + (title ? 12 : 0) + (startDate ? 14 : 0) + (cityCandidate ? 10 : 0) + assessedDocs.length * 2 - warnings.length * 8,
    ),
  );

  const hasStrongBulgarianDocs = authoritative.some((doc) => doc.languageSignal === "bg" || doc.languageSignal === "mixed");
  const titleIsNonBgWithStrongBgDocs = bgQuery && titleSelection.languageSignal === "non_bg" && hasStrongBulgarianDocs;
  const adjustedScore = titleIsNonBgWithStrongBgDocs ? Math.max(0, score - 18) : score;

  const canonicalBackedByAuthority =
    !!titleSelection.tier &&
    !!dateRange.tier &&
    !!citySelection.tier &&
    !!locationSelection.tier &&
    isAuthoritativeTier(titleSelection.tier) &&
    isAuthoritativeTier(dateRange.tier) &&
    isAuthoritativeTier(citySelection.tier) &&
    isAuthoritativeTier(locationSelection.tier);

  const overallConfidence: ResearchConfidenceLevel =
    weakOnly || authoritative.length === 0 ? "low" : canonicalBackedByAuthority ? pickConfidence(adjustedScore) : "medium";

  const tags = query
    .split(/\s+/)
    .map((part) => part.trim().toLocaleLowerCase("bg-BG"))
    .filter((part) => part.length > 2 && !/^(19|20)\d{2}$/.test(part))
    .map((part) => (bgQuery ? BG_TAG_MAP[part] ?? part : part))
    .slice(0, 5);

  const titleAlternatives = collectCandidatesFromDocs(fallback, (doc) => cleanTitleCandidate(doc.title).cleaned);
  const cityAlternatives = collectCandidatesFromDocs(fallback, (doc) => {
    const matched = matchBulgarianCityAlias(`${doc.title} ${doc.snippet}`);
    return matched ? matched.canonical : null;
  });
  const locationAlternatives = collectCandidatesFromDocs(fallback, (doc) => pickFieldValue(doc.locationLike.map((entry) => cleanLocationCandidate(entry)).filter((entry): entry is string => Boolean(entry))));
  const organizerAlternatives = collectCandidatesFromDocs(fallback, (doc) => pickFieldValue(doc.organizerLike.map((entry) => decodeResearchText(entry))));

  const heuristicCandidates: ResearchCandidates = {
    titles: buildFieldCandidates(titleSelection.value ? titleSelection : fallbackTitleSelection, titleAlternatives),
    dates: dateRange.candidates.map<ResearchDateCandidate>((item) => ({
      start_date: item.startDate,
      end_date: item.endDate,
      source_url: normalizeUrl(item.sourceUrl),
      tier: item.tier,
      language: item.languageSignal,
      reason: "Extracted via deterministic date pattern matching from source text.",
      label: item.startDate === item.endDate ? item.startDate : `${item.startDate} → ${item.endDate}`,
    })),
    cities: buildFieldCandidates(citySelection, cityAlternatives),
    locations: buildFieldCandidates(locationSelection, locationAlternatives),
    organizers: buildFieldCandidates(organizerSelection, organizerAlternatives),
  };

  const normalizedQuery = normalizeQuery(query);

  const llmDiagnostics = getLlmExtractionDiagnostics();
  const preparedLlmSources = prepareLlmSourcesForExtraction(fallback);
  const llmSources = preparedLlmSources.eligible;

  let llmWarnings: string[] = [];
  let llmBestGuess: {
    title: string | null;
    start_date: string | null;
    end_date: string | null;
    city: string | null;
    location: string | null;
    organizer: string | null;
    tags: string[];
  } | null = null;
  let llmCandidates: ResearchCandidates | null = null;

  console.info("[research:web] LLM extraction diagnostics", {
    query,
    llm_enabled: llmDiagnostics.enabled,
    llm_missing_prerequisites: llmDiagnostics.missingPrerequisites,
    llm_prerequisites_present: llmDiagnostics.prerequisites,
    llm_config: {
      endpoint: llmDiagnostics.resolvedConfig.endpoint,
      model: llmDiagnostics.resolvedConfig.model,
      timeout_ms: llmDiagnostics.resolvedConfig.timeoutMs,
      auth_mode: llmDiagnostics.resolvedConfig.authMode,
    },
    ranked_source_count: fallback.length,
    llm_eligible_source_count: llmSources.length,
    llm_rejected_source_count: preparedLlmSources.rejected.length,
    llm_rejected_sources_sample: preparedLlmSources.rejected.slice(0, 5),
  });

  if (!llmDiagnostics.enabled) {
    warnings.push(
      `LLM extraction disabled by missing prerequisites (${llmDiagnostics.missingPrerequisites.join(", ")}); using deterministic source-backed extraction.`,
    );
  } else if (llmSources.length === 0) {
    const sampleReasons = preparedLlmSources.rejected
      .slice(0, 3)
      .map((item) => `${item.domain}: ${item.reason}`)
      .join("; ");
    warnings.push(
      `LLM extraction skipped because no eligible source text was extracted${sampleReasons ? ` (${sampleReasons})` : ""}; using deterministic source-backed extraction.`,
    );
  } else {
    const llmInput = {
      query,
      normalized_query: normalizedQuery,
      sources: llmSources,
    };
    const llmPromptSizeChars = estimateLlmPromptSizeChars(llmInput);
    const llmSourcePayloadChars = llmSources.reduce((total, source) => total + source.text_excerpt.length, 0);
    const llmInputPayloadBytesEstimate = Buffer.byteLength(JSON.stringify(llmInput), "utf8");

    console.info("[research:web] attempting LLM extraction", {
      query,
      llm_timeout_ms: llmDiagnostics.resolvedConfig.timeoutMs,
      llm_eligible_source_count: llmSources.length,
      llm_source_urls: llmSources.map((source) => source.source_url),
      llm_prompt_size_chars: llmPromptSizeChars,
      llm_source_payload_chars: llmSourcePayloadChars,
      llm_input_payload_bytes_estimate: llmInputPayloadBytesEstimate,
    });

    try {
      const llm = await runLlmFieldExtraction(llmInput);

      llmBestGuess = llm.best_guess;
      llmCandidates = {
        titles: llm.candidates.titles,
        dates: llm.candidates.dates,
        cities: llm.candidates.cities,
        locations: llm.candidates.locations,
        organizers: llm.candidates.organizers,
      };
      llmWarnings = llm.warnings;

      const accepted =
        Boolean(llmBestGuess?.title || llmBestGuess?.start_date || llmBestGuess?.city || llmBestGuess?.location || llmBestGuess?.organizer) ||
        Boolean(llmBestGuess?.tags?.length) ||
        Boolean(
          llmCandidates.titles.length ||
            llmCandidates.dates.length ||
            llmCandidates.cities.length ||
            llmCandidates.locations.length ||
            llmCandidates.organizers.length,
        );

      console.info("[research:web] LLM extraction response", {
        query,
        llm_response_accepted: accepted,
        candidate_counts: {
          titles: llmCandidates.titles.length,
          dates: llmCandidates.dates.length,
          cities: llmCandidates.cities.length,
          locations: llmCandidates.locations.length,
          organizers: llmCandidates.organizers.length,
        },
        warning_count: llmWarnings.length,
      });

      if (!accepted) {
        warnings.push("LLM extraction returned no usable candidates; using deterministic source-backed extraction.");
        llmBestGuess = null;
        llmCandidates = null;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      const timeoutAbort = isLlmTimeoutError(error);
      const nonTimeoutAbort = isLlmAbortError(error);

      console.warn("[research:web] LLM extraction failed", {
        query,
        error: message,
        failure_type: timeoutAbort ? "timeout_abort" : nonTimeoutAbort ? "abort_non_timeout" : "runtime_error",
        llm_timeout_ms: llmDiagnostics.resolvedConfig.timeoutMs,
      });

      if (timeoutAbort) {
        warnings.push(`LLM extraction timed out (${message}); using deterministic source-backed extraction.`);
      } else if (nonTimeoutAbort) {
        warnings.push(`LLM extraction aborted before completion (${message}); using deterministic source-backed extraction.`);
      } else {
        warnings.push(`LLM extraction failed at runtime (${message}); using deterministic source-backed extraction.`);
      }
    }
  }

  const finalCandidates: ResearchCandidates = {
    titles: llmCandidates?.titles.length ? llmCandidates.titles : applyReasonToFieldCandidates(heuristicCandidates.titles, "Deterministic fallback extraction."),
    dates: llmCandidates?.dates.length ? llmCandidates.dates : applyReasonToDateCandidates(heuristicCandidates.dates, "Deterministic fallback extraction."),
    cities: llmCandidates?.cities.length ? llmCandidates.cities : applyReasonToFieldCandidates(heuristicCandidates.cities, "Deterministic fallback extraction."),
    locations: llmCandidates?.locations.length ? llmCandidates.locations : applyReasonToFieldCandidates(heuristicCandidates.locations, "Deterministic fallback extraction."),
    organizers: llmCandidates?.organizers.length ? llmCandidates.organizers : applyReasonToFieldCandidates(heuristicCandidates.organizers, "Deterministic fallback extraction."),
  };

  const finalBestGuess = {
    title: llmBestGuess?.title ?? title,
    start_date: llmBestGuess?.start_date ?? startDate,
    end_date: llmBestGuess?.end_date ?? endDate,
    city: llmBestGuess?.city ?? cityCandidate,
    location: llmBestGuess?.location ?? location,
    description,
    organizer: llmBestGuess?.organizer ?? organizer,
    hero_image: heroImage,
    tags: llmBestGuess?.tags?.length ? llmBestGuess.tags : tags,
  };

  warnings.push(...llmWarnings);

  return {
    query,
    normalized_query: normalizeQuery(query),
    best_guess: finalBestGuess,
    candidates: finalCandidates,
    sources: rankedSources.map((source) => ({ ...source, url: normalizeUrl(source.url) })),
    confidence: {
      overall: overallConfidence,
      title: finalBestGuess.title && titleSelection.tier && isAuthoritativeTier(titleSelection.tier) ? pickConfidence(adjustedScore) : "low",
      dates: finalBestGuess.start_date && dateRange.tier && isAuthoritativeTier(dateRange.tier) ? pickConfidence(adjustedScore) : "low",
      city: finalBestGuess.city && citySelection.tier && isAuthoritativeTier(citySelection.tier) ? pickConfidence(adjustedScore - 8) : "low",
      location: finalBestGuess.location && locationSelection.tier && isAuthoritativeTier(locationSelection.tier) ? pickConfidence(adjustedScore - 12) : "low",
      description: description && preferredDoc && isAuthoritativeTier(preferredDoc.authorityTier) ? pickConfidence(adjustedScore - 10) : "low",
      organizer: finalBestGuess.organizer && organizerSelection.tier && isAuthoritativeTier(organizerSelection.tier) ? pickConfidence(adjustedScore - 8) : "low",
      hero_image: heroImage && preferredDoc && isAuthoritativeTier(preferredDoc.authorityTier) ? pickConfidence(adjustedScore - 14) : "low",
    },
    warnings,
    evidence: [
      finalBestGuess.title && (titleSelection.sourceUrl ?? fallbackTitleSelection.sourceUrl)
        ? {
            field: "title",
            value: finalBestGuess.title,
            source_url: normalizeUrl((titleSelection.sourceUrl ?? fallbackTitleSelection.sourceUrl)!),
          }
        : null,
      finalBestGuess.start_date && dateRange.sourceUrl
        ? {
            field: "dates",
            value: finalBestGuess.end_date && finalBestGuess.end_date !== finalBestGuess.start_date ? `${finalBestGuess.start_date} to ${finalBestGuess.end_date}` : finalBestGuess.start_date,
            source_url: normalizeUrl(dateRange.sourceUrl),
          }
        : null,
      finalBestGuess.city && citySelection.sourceUrl
        ? {
            field: "city",
            value: finalBestGuess.city,
            source_url: normalizeUrl(citySelection.sourceUrl),
          }
        : null,
      finalBestGuess.location && locationSelection.sourceUrl
        ? {
            field: "location",
            value: finalBestGuess.location,
            source_url: normalizeUrl(locationSelection.sourceUrl),
          }
        : null,
      finalBestGuess.organizer && organizerSelection.sourceUrl
        ? {
            field: "organizer",
            value: finalBestGuess.organizer,
            source_url: normalizeUrl(organizerSelection.sourceUrl),
          }
        : null,
    ].filter((item): item is NonNullable<typeof item> => item !== null),
    metadata: {
      provider: "web",
      mode: "real_web",
      source_count: rankedSources.length,
    },
  };
}
