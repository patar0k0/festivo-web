import { buildResearchQueries } from "@/lib/admin/research/query-builder";
import { assessSourceQuality, dedupeAndRankSources } from "@/lib/admin/research/source-ranking";
import { extractDomain, fetchSourceDocument } from "@/lib/admin/research/source-extract";
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
};

const SEARCH_TIMEOUT_MS = 7000;

function normalizeQuery(query: string): string {
  return query.trim().toLocaleLowerCase("bg-BG");
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

      return { url: normalizedUrl, title };
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
  const topDomains = docs.slice(0, 5).map((doc) => ({ domain: doc.domain, tier: doc.authorityTier, score: doc.qualityScore }));
  console.info("[research:web-provider] ranked source diagnostics", { top_domains: topDomains });
}

function logFieldSelectionDiagnostics(details: {
  titleSource: string | null;
  titleTier: SourceAuthorityTier | null;
  dateSource: string | null;
  dateTier: SourceAuthorityTier | null;
  locationSource: string | null;
  locationTier: SourceAuthorityTier | null;
  sourceUrl: string | null;
  sourceUrlTier: SourceAuthorityTier | null;
}): void {
  console.info("[research:web-provider] canonical field selection", details);
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
  return cleaned;
}

function stripSiteBrandTail(value: string): string {
  return value
    .replace(/\s+[\-|–|—|·|•]\s+(official\s+site|официален\s+сайт|home|начало|tripadvisor|couchsurfing|facebook)\b.*$/iu, "")
    .replace(/\s+\|\s+[^|]{2,40}$/u, "")
    .trim();
}

function isWeakTitle(value: string): boolean {
  const title = value.toLocaleLowerCase("bg-BG");
  return /(tripadvisor|couchsurfing|things to do|booking|events? in|directory|listing|profile|group|page)\b/iu.test(title);
}

function isLikelyEventTitle(value: string): boolean {
  const title = value.toLocaleLowerCase("bg-BG");
  if (title.length < 8) return false;
  if (isWeakTitle(title)) return false;
  return /\b(фестивал|festival|carnival|маскарад|празник|събор|surva)\b/iu.test(title);
}

function pickTitleWithSource(docs: AssessedDocument[]): { value: string | null; sourceUrl: string | null; tier: SourceAuthorityTier | null } {

  for (const doc of docs) {
    const cleaned = stripSiteBrandTail(doc.title);
    if (cleaned && isLikelyEventTitle(cleaned)) {
      return { value: cleaned, sourceUrl: doc.canonicalUrl ?? doc.url, tier: doc.authorityTier };
    }
  }

  return { value: null, sourceUrl: null, tier: null };
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
      tokenOwners.push({ date: normalized, sourceUrl: doc.canonicalUrl ?? doc.url, tier: doc.authorityTier });
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

function pickLocationWithSource(docs: AssessedDocument[]): { value: string | null; sourceUrl: string | null; tier: SourceAuthorityTier | null } {
  for (const doc of docs) {
    const cleaned = doc.locationLike.map((value) => cleanLocationCandidate(value)).filter((value): value is string => Boolean(value));
    const value = pickFieldValue(cleaned);
    if (value) return { value, sourceUrl: doc.canonicalUrl ?? doc.url, tier: doc.authorityTier };
  }
  return { value: null, sourceUrl: null, tier: null };
}

function pickOrganizerWithSource(docs: AssessedDocument[]): { value: string | null; sourceUrl: string | null; tier: SourceAuthorityTier | null } {
  for (const doc of docs) {
    const value = pickFieldValue(doc.organizerLike);
    if (value) return { value, sourceUrl: doc.canonicalUrl ?? doc.url, tier: doc.authorityTier };
  }
  return { value: null, sourceUrl: null, tier: null };
}

function pickCityFromDocs(docs: AssessedDocument[]): { value: string | null; sourceUrl: string | null; tier: SourceAuthorityTier | null } {
  const cityRegex = /\b(?:гр\.?|city|перник|софия|пловдив|варна|бургас|русе|stara zagora)\b/iu;
  for (const doc of docs) {
    const value = pickFieldValue(doc.locationLike.filter((item) => cityRegex.test(item)));
    if (value) return { value, sourceUrl: doc.canonicalUrl ?? doc.url, tier: doc.authorityTier };
  }
  return { value: null, sourceUrl: null, tier: null };
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
      };
    })
    .sort((a, b) => TIER_RANK[a.authorityTier] - TIER_RANK[b.authorityTier] || b.qualityScore - a.qualityScore);

  logRankingDiagnostics(assessedDocs);

  const { authoritative, fallback, weakOnly } = pickDocsByTier(assessedDocs);

  const titleSelection = pickTitleWithSource(fallback);
  const dateRange = pickDateRangeFromStrongSources(fallback);
  const citySelection = pickCityFromDocs(fallback);
  const locationSelection = pickLocationWithSource(fallback);
  const organizerSelection = pickOrganizerWithSource(fallback);

  if (dateRange.warning) warnings.push(dateRange.warning);

  const preferredDoc = fallback[0] ?? null;
  const sourceUrl = preferredDoc ? preferredDoc.canonicalUrl ?? preferredDoc.url : null;

  const title = weakOnly ? null : titleSelection.value;
  const startDate = weakOnly ? null : dateRange.startDate;
  const endDate = weakOnly ? null : dateRange.endDate;
  const cityCandidate = weakOnly ? null : citySelection.value;
  const location = weakOnly ? null : locationSelection.value;
  const organizer = weakOnly ? null : organizerSelection.value;
  const description = preferredDoc?.description ?? (preferredDoc && preferredDoc.snippet.length > 120 ? `${preferredDoc.snippet.slice(0, 220)}...` : null);
  const heroImage = preferredDoc?.ogImage ?? null;

  if (!title) warnings.push("No reliable event title found in authoritative/reputable sources.");
  if (!startDate) warnings.push("No reliable start date found in authoritative/reputable sources.");
  if (!cityCandidate) warnings.push("City could not be confirmed from authoritative/reputable sources.");
  if (!organizer) warnings.push("Organizer could not be confirmed from authoritative/reputable sources.");

  if (weakOnly) {
    warnings.push("Only commercial or weak sources were found; canonical fields intentionally left null/low-confidence.");
  }

  logFieldSelectionDiagnostics({
    titleSource: titleSelection.sourceUrl,
    titleTier: titleSelection.tier,
    dateSource: dateRange.sourceUrl,
    dateTier: dateRange.tier,
    locationSource: locationSelection.sourceUrl,
    locationTier: locationSelection.tier,
    sourceUrl,
    sourceUrlTier: preferredDoc?.authorityTier ?? null,
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
    weakOnly || authoritative.length === 0 ? "low" : canonicalBackedByAuthority ? pickConfidence(score) : "medium";

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
      .slice(0, 5),
    sources: rankedSources,
    confidence: {
      overall: overallConfidence,
      title: title && titleSelection.tier && isAuthoritativeTier(titleSelection.tier) ? pickConfidence(score) : "low",
      dates: startDate && dateRange.tier && isAuthoritativeTier(dateRange.tier) ? pickConfidence(score) : "low",
      city: cityCandidate && citySelection.tier && isAuthoritativeTier(citySelection.tier) ? pickConfidence(score - 8) : "low",
      location: location && locationSelection.tier && isAuthoritativeTier(locationSelection.tier) ? pickConfidence(score - 12) : "low",
      description: description && preferredDoc && isAuthoritativeTier(preferredDoc.authorityTier) ? pickConfidence(score - 10) : "low",
      organizer: organizer && organizerSelection.tier && isAuthoritativeTier(organizerSelection.tier) ? pickConfidence(score - 8) : "low",
      hero_image: heroImage && preferredDoc && isAuthoritativeTier(preferredDoc.authorityTier) ? pickConfidence(score - 14) : "low",
    },
    warnings,
    evidence: [
      title && titleSelection.sourceUrl
        ? {
            field: "title",
            value: title,
            source_url: titleSelection.sourceUrl,
          }
        : null,
      startDate && dateRange.sourceUrl
        ? {
            field: "dates",
            value: endDate && endDate !== startDate ? `${startDate} to ${endDate}` : startDate,
            source_url: dateRange.sourceUrl,
          }
        : null,
      cityCandidate && citySelection.sourceUrl
        ? {
            field: "city",
            value: cityCandidate,
            source_url: citySelection.sourceUrl,
          }
        : null,
      location && locationSelection.sourceUrl
        ? {
            field: "location",
            value: location,
            source_url: locationSelection.sourceUrl,
          }
        : null,
      organizer && organizerSelection.sourceUrl
        ? {
            field: "organizer",
            value: organizer,
            source_url: organizerSelection.sourceUrl,
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
