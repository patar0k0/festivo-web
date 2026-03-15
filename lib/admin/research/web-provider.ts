import { buildResearchQueries } from "@/lib/admin/research/query-builder";
import { assessSourceQuality, dedupeAndRankSources } from "@/lib/admin/research/source-ranking";
import { decodeHtmlEntities, extractDomain, fetchSourceDocument, normalizeUrl } from "@/lib/admin/research/source-extract";
import type { ExtractedSourceDocument } from "@/lib/admin/research/source-extract";
import type { ResearchConfidenceLevel, ResearchFestivalResult, ResearchSource } from "@/lib/admin/research/types";
import type { SourceAuthorityTier, SourceQualityClass } from "@/lib/admin/research/source-ranking";

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

const SEARCH_TIMEOUT_MS = 7000;
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

type LanguageSignal = "bg" | "mixed" | "non_bg";

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

const BULGARIAN_CITY_ALIASES: Array<{ pattern: RegExp; canonical: string }> = [
  { pattern: /\b(казанлък|kazanlak)\b/iu, canonical: "Казанлък" },
  { pattern: /\b(софия|sofia)\b/iu, canonical: "София" },
  { pattern: /\b(пловдив|plovdiv)\b/iu, canonical: "Пловдив" },
  { pattern: /\b(варна|varna)\b/iu, canonical: "Варна" },
  { pattern: /\b(бургас|burgas)\b/iu, canonical: "Бургас" },
  { pattern: /\b(русе|ruse)\b/iu, canonical: "Русе" },
  { pattern: /\b(перник|pernik)\b/iu, canonical: "Перник" },
  { pattern: /\b(стара\s+загора|stara\s+zagora)\b/iu, canonical: "Стара Загора" },
  { pattern: /\b(велико\s+търново|veliko\s+tarnovo)\b/iu, canonical: "Велико Търново" },
];

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

  for (const entry of BULGARIAN_CITY_ALIASES) {
    if (entry.pattern.test(normalized)) return entry.canonical;
  }

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

function extractEventLikeBulgarianTitle(value: string): string | null {
  const decoded = decodeResearchText(value);
  const eventMatch = decoded.match(/([\p{Lu}][^|]{4,160}?\b(?:фестивал|празник|събор|карнавал|маскарад)\b[^|–—-]{0,120})/iu);
  if (!eventMatch?.[1]) return null;

  return eventMatch[1]
    .replace(/[\s,;:.!\-–—]+$/u, "")
    .replace(/\s+\b(официален\s+сайт|official\s+site|посети\s+[\p{L}\s]+|visit\s+[\p{L}\s]+)$/iu, "")
    .trim();
}

function cleanTitleCandidate(value: string): { cleaned: string | null; acceptanceReason: string | null; decoded: string; stripped: string } {
  const decoded = decodeResearchText(value);
  const stripped = stripSiteBrandTail(decoded);

  if (!stripped) return { cleaned: null, acceptanceReason: null, decoded, stripped };

  const noisyReason = isNoisyTextCandidate(stripped);
  if (noisyReason) return { cleaned: null, acceptanceReason: null, decoded, stripped };

  if (isLikelyEventTitle(stripped) && !isPageBrandFormatting(stripped)) {
    return { cleaned: toBulgarianTitleCase(stripped), acceptanceReason: "direct_event_title", decoded, stripped };
  }

  const extracted = extractEventLikeBulgarianTitle(stripped);
  if (extracted && isLikelyEventTitle(extracted)) {
    return { cleaned: toBulgarianTitleCase(extracted), acceptanceReason: "event_subtitle_extracted_from_bulgarian_authoritative_headline", decoded, stripped };
  }

  return { cleaned: null, acceptanceReason: null, decoded, stripped };
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

function pickDateRangeFromStrongSources(docs: AssessedDocument[]): {
  startDate: string | null;
  endDate: string | null;
  warning: string | null;
  sourceUrl: string | null;
  tier: SourceAuthorityTier | null;
} {
  if (docs.length === 0) {
    return { startDate: null, endDate: null, warning: "No authoritative/reputable sources available for reliable date extraction.", sourceUrl: null, tier: null };
  }

  const tokenOwners: Array<{ date: string; sourceUrl: string; tier: SourceAuthorityTier }> = [];
  for (const doc of docs) {
    for (const token of doc.dateLike) {
      const normalized = normalizeDateToken(token);
      if (!normalized) continue;
      tokenOwners.push({ date: normalized, sourceUrl: normalizeUrl(doc.canonicalUrl ?? doc.url), tier: doc.authorityTier });
    }
  }

  const uniqueDates = [...new Set(tokenOwners.map((entry) => entry.date))].sort();

  if (uniqueDates.length === 0) {
    return { startDate: null, endDate: null, warning: "No reliable date-like pattern found in authoritative/reputable sources.", sourceUrl: null, tier: null };
  }

  if (uniqueDates.length > 2) {
    return { startDate: null, endDate: null, warning: "Date candidates are conflicting across authoritative/reputable sources.", sourceUrl: null, tier: null };
  }

  const startDate = uniqueDates[0] ?? null;
  const endDate = uniqueDates[1] ?? uniqueDates[0] ?? null;

  if (startDate && endDate && endDate < startDate) {
    return { startDate: null, endDate: null, warning: "Date candidates conflict in ordering across authoritative/reputable sources.", sourceUrl: null, tier: null };
  }

  const owner = tokenOwners.find((entry) => entry.date === startDate) ?? null;
  return { startDate, endDate, warning: null, sourceUrl: owner?.sourceUrl ?? null, tier: owner?.tier ?? null };
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

  const findCity = (value: string): string | null => {
    const decoded = decodeResearchText(value);

    for (const entry of BULGARIAN_CITY_ALIASES) {
      if (entry.pattern.test(decoded)) return entry.canonical;
    }

    const explicitMatches = decoded.match(/\b(?:гр\.?\s*)?[\p{Lu}][\p{L}]+(?:\s+[\p{Lu}][\p{L}]+)?\b/gu) ?? [];
    for (const match of explicitMatches) {
      const cleaned = match.replace(/^\s*гр\.?\s*/iu, "").trim();
      for (const entry of BULGARIAN_CITY_ALIASES) {
        if (entry.pattern.test(cleaned)) return entry.canonical;
      }
    }

    return null;
  };

  const queryCityRaw = findCity(query);
  const queryCity = queryCityRaw ? normalizeBulgarianCityAlias(queryCityRaw) : null;
  console.info("[research:web-provider] detected query city", {
    normalized_query: normalizeQuery(query),
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
        .filter((item): item is string => Boolean(item))
        .map((item) => normalizeBulgarianCityAlias(item)),
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

function buildLowConfidenceResult(query: string, warning: string): ResearchFestivalResult {
  return {
    query,
    normalized_query: normalizeQuery(query),
    title: null,
    start_date: null,
    end_date: null,
    city: null,
    location: null,
    description: null,
    organizer: null,
    hero_image: null,
    tags: [],
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

  return {
    query,
    normalized_query: normalizeQuery(query),
    title,
    start_date: startDate,
    end_date: endDate,
    city: cityCandidate,
    location,
    description,
    organizer,
    hero_image: heroImage,
    tags: query
      .split(/\s+/)
      .map((part) => part.trim().toLocaleLowerCase("bg-BG"))
      .filter((part) => part.length > 2 && !/^(19|20)\d{2}$/.test(part))
      .map((part) => (bgQuery ? BG_TAG_MAP[part] ?? part : part))
      .slice(0, 5),
    sources: rankedSources.map((source) => ({ ...source, url: normalizeUrl(source.url) })),
    confidence: {
      overall: overallConfidence,
      title: title && titleSelection.tier && isAuthoritativeTier(titleSelection.tier) ? pickConfidence(adjustedScore) : "low",
      dates: startDate && dateRange.tier && isAuthoritativeTier(dateRange.tier) ? pickConfidence(adjustedScore) : "low",
      city: cityCandidate && citySelection.tier && isAuthoritativeTier(citySelection.tier) ? pickConfidence(adjustedScore - 8) : "low",
      location: location && locationSelection.tier && isAuthoritativeTier(locationSelection.tier) ? pickConfidence(adjustedScore - 12) : "low",
      description: description && preferredDoc && isAuthoritativeTier(preferredDoc.authorityTier) ? pickConfidence(adjustedScore - 10) : "low",
      organizer: organizer && organizerSelection.tier && isAuthoritativeTier(organizerSelection.tier) ? pickConfidence(adjustedScore - 8) : "low",
      hero_image: heroImage && preferredDoc && isAuthoritativeTier(preferredDoc.authorityTier) ? pickConfidence(adjustedScore - 14) : "low",
    },
    warnings,
    evidence: [
      title && (titleSelection.sourceUrl ?? fallbackTitleSelection.sourceUrl)
        ? {
            field: "title",
            value: title,
            source_url: normalizeUrl((titleSelection.sourceUrl ?? fallbackTitleSelection.sourceUrl)!),
          }
        : null,
      startDate && dateRange.sourceUrl
        ? {
            field: "dates",
            value: endDate && endDate !== startDate ? `${startDate} to ${endDate}` : startDate,
            source_url: normalizeUrl(dateRange.sourceUrl),
          }
        : null,
      cityCandidate && citySelection.sourceUrl
        ? {
            field: "city",
            value: cityCandidate,
            source_url: normalizeUrl(citySelection.sourceUrl),
          }
        : null,
      location && locationSelection.sourceUrl
        ? {
            field: "location",
            value: location,
            source_url: normalizeUrl(locationSelection.sourceUrl),
          }
        : null,
      organizer && organizerSelection.sourceUrl
        ? {
            field: "organizer",
            value: organizer,
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
