import { buildResearchQueries } from "@/lib/admin/research/query-builder";
import { assessSourceQuality, dedupeAndRankSources } from "@/lib/admin/research/source-ranking";
import { extractDomain, fetchSourceDocument } from "@/lib/admin/research/source-extract";
import type { ExtractedSourceDocument } from "@/lib/admin/research/source-extract";
import type { ResearchConfidenceLevel, ResearchFestivalResult, ResearchSource } from "@/lib/admin/research/types";
import type { SourceQualityClass } from "@/lib/admin/research/source-ranking";

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

function normalizeDateToken(value: string): string | null {
  const iso = value.match(/^((?:19|20)\d{2})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;

  const eu = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.]((?:19|20)\d{2})$/);
  if (eu) return `${eu[3]}-${eu[2].padStart(2, "0")}-${eu[1].padStart(2, "0")}`;

  return null;
}

function selectPreferredDocument(docs: AssessedDocument[]): AssessedDocument {
  const strong = docs.find((doc) => doc.isStrong);
  if (strong) return strong;
  const official = docs.find((doc) => doc.isOfficial);
  return official ?? docs[0];
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
  if (cleaned.length > 90) return null;
  const sentenceParts = cleaned.split(/[.!?]/).filter((part) => part.trim().length > 0);
  if (sentenceParts.length > 1) return null;
  return cleaned;
}

function isLikelyEventTitle(value: string): boolean {
  const title = value.toLocaleLowerCase("bg-BG");
  if (title.length < 8) return false;
  if (/\b(tripadvisor|couchsurfing|things to do|booking|events? in)\b/iu.test(title)) return false;
  return /\b(фестивал|festival|carnival|маскарад|празник|събор|surva)\b/iu.test(title);
}

function pickTitleFromDocuments(strongDocs: AssessedDocument[], allDocs: AssessedDocument[], fallbackQuery: string): string | null {
  const titlePool = strongDocs.length > 0 ? strongDocs : allDocs.filter((doc) => doc.qualityClass !== "weak");
  const candidates = titlePool.map((doc) => doc.title).filter((title) => isLikelyEventTitle(title));
  const picked = pickFieldValue(candidates);
  if (picked) return picked;
  const fallback = fallbackQuery.trim();
  return fallback.length > 0 ? fallback : null;
}

function pickDateRangeFromStrongSources(strongDocs: AssessedDocument[]): {
  startDate: string | null;
  endDate: string | null;
  warning: string | null;
} {
  if (strongDocs.length === 0) {
    return { startDate: null, endDate: null, warning: "No strong sources available for reliable date extraction." };
  }

  const allDateTokens = strongDocs.flatMap((doc) => doc.dateLike.map((token) => normalizeDateToken(token)).filter((item): item is string => Boolean(item)));
  const uniqueDates = [...new Set(allDateTokens)].sort();

  if (uniqueDates.length === 0) {
    return { startDate: null, endDate: null, warning: "No reliable date-like pattern found in strong sources." };
  }

  if (uniqueDates.length > 2) {
    return { startDate: null, endDate: null, warning: "Date candidates are conflicting across strong sources." };
  }

  const startDate = uniqueDates[0] ?? null;
  const endDate = uniqueDates[1] ?? uniqueDates[0] ?? null;

  if (startDate && endDate && endDate < startDate) {
    return { startDate: null, endDate: null, warning: "Date candidates conflict in ordering across strong sources." };
  }

  return { startDate, endDate, warning: null };
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
    const payload = (await response.json().then((data) => {
      jsonParsed = true;
      return data;
    }).catch(() => null)) as unknown;
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

  const assessedDocs: AssessedDocument[] = extractedDocs.map((doc) => {
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
    return { ...doc, qualityClass: assessment.qualityClass, qualityScore: assessment.score, isStrong };
  });

  const strongDocs = assessedDocs.filter((doc) => doc.isStrong);
  const mediumOrStrongDocs = assessedDocs.filter((doc) => doc.qualityClass !== "weak");
  const preferredDoc = selectPreferredDocument(assessedDocs);
  const title = pickTitleFromDocuments(strongDocs, assessedDocs, query);

  const dateRange = pickDateRangeFromStrongSources(strongDocs);
  const startDate = dateRange.startDate;
  const endDate = dateRange.endDate;
  if (dateRange.warning) warnings.push(dateRange.warning);

  const cityCandidate = pickFieldValue(
    mediumOrStrongDocs
      .flatMap((doc) => doc.locationLike)
      .filter((value) => /\b(?:гр\.?|city|перник|софия|пловдив|варна|бургас|русе|stara zagora)\b/iu.test(value)),
  );

  const location = pickFieldValue(mediumOrStrongDocs.flatMap((doc) => doc.locationLike).map((value) => cleanLocationCandidate(value)).filter((value): value is string => Boolean(value)));
  const organizer = pickFieldValue(mediumOrStrongDocs.flatMap((doc) => doc.organizerLike));
  const description = preferredDoc.description ?? (preferredDoc.snippet.length > 120 ? `${preferredDoc.snippet.slice(0, 220)}...` : null);
  const heroImage = preferredDoc.ogImage;

  if (!startDate) warnings.push("No reliable start date found.");
  if (!cityCandidate) warnings.push("City could not be confirmed from sources.");
  if (!organizer) warnings.push("Organizer could not be confirmed from sources.");

  const officialCount = rankedSources.filter((source) => source.is_official).length;
  const docsFromOfficial = assessedDocs.filter((doc) => doc.isOfficial).length;
  const weakSourceMode = officialCount === 0 && docsFromOfficial === 0;
  if (weakSourceMode) {
    warnings.push("Only weak or non-official sources were found.");
  }

  const score = Math.max(
    0,
    Math.min(
      100,
      officialCount * 20 + docsFromOfficial * 12 + (startDate ? 16 : 0) + (cityCandidate ? 10 : 0) + (organizer ? 10 : 0) + extractedDocs.length * 4 - warnings.length * 8,
    ),
  );

  const overallConfidence = weakSourceMode ? pickConfidence(Math.min(score, 58)) : pickConfidence(score);

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
      title: pickConfidence(score),
      dates: pickConfidence(startDate ? score : 18),
      city: pickConfidence(cityCandidate ? score - 8 : 18),
      location: pickConfidence(location ? score - 12 : 18),
      description: pickConfidence(description ? score - 10 : 18),
      organizer: pickConfidence(organizer ? score - 8 : 18),
      hero_image: pickConfidence(heroImage ? score - 14 : 15),
    },
    warnings,
    evidence: [
      title
        ? {
            field: "title",
            value: title,
            source_url: preferredDoc.canonicalUrl ?? preferredDoc.url,
          }
        : null,
      startDate
        ? {
            field: "dates",
            value: endDate && endDate !== startDate ? `${startDate} to ${endDate}` : startDate,
            source_url: preferredDoc.canonicalUrl ?? preferredDoc.url,
          }
        : null,
      cityCandidate
        ? {
            field: "city",
            value: cityCandidate,
            source_url: preferredDoc.canonicalUrl ?? preferredDoc.url,
          }
        : null,
      organizer
        ? {
            field: "organizer",
            value: organizer,
            source_url: preferredDoc.canonicalUrl ?? preferredDoc.url,
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
