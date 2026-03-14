import { buildResearchQueries } from "@/lib/admin/research/query-builder";
import { dedupeAndRankSources } from "@/lib/admin/research/source-ranking";
import { extractDomain, fetchSourceDocument } from "@/lib/admin/research/source-extract";
import type { ExtractedSourceDocument } from "@/lib/admin/research/source-extract";
import type { ResearchConfidenceLevel, ResearchFestivalResult, ResearchSource } from "@/lib/admin/research/types";

type SearchItem = {
  url: string;
  title: string;
};

const SEARCH_TIMEOUT_MS = 7000;

function normalizeQuery(query: string): string {
  return query.trim().toLocaleLowerCase("bg-BG");
}

function parseSearchItems(payload: unknown): SearchItem[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];

  const root = payload as {
    results?: unknown;
    items?: unknown;
    data?: { results?: unknown; items?: unknown };
  };

  const candidate = Array.isArray(root.results)
    ? root.results
    : Array.isArray(root.items)
      ? root.items
      : Array.isArray(root.data?.results)
        ? root.data.results
        : Array.isArray(root.data?.items)
          ? root.data.items
          : [];

  return candidate
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
      const item = entry as { url?: unknown; link?: unknown; title?: unknown; snippet?: unknown; description?: unknown };
      const url = typeof item.url === "string" ? item.url.trim() : typeof item.link === "string" ? item.link.trim() : "";
      if (!url) return null;

      const title =
        typeof item.title === "string" && item.title.trim()
          ? item.title.trim()
          : typeof item.snippet === "string" && item.snippet.trim()
            ? item.snippet.trim()
            : typeof item.description === "string"
              ? item.description.trim()
              : url;

      return { url, title };
    })
    .filter((item): item is SearchItem => item !== null);
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

function selectPreferredDocument(docs: ExtractedSourceDocument[]): ExtractedSourceDocument {
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
    const requestUrl = new URL(endpoint);
    requestUrl.searchParams.set("q", query);
    requestUrl.searchParams.set("limit", process.env.WEB_RESEARCH_SEARCH_LIMIT ?? "10");

    const response = await fetch(requestUrl, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) return [];

    const payload = (await response.json().catch(() => null)) as unknown;
    const items = parseSearchItems(payload);

    return items.map((item) => ({
      url: item.url,
      title: item.title,
      domain: extractDomain(item.url),
      is_official: false,
    }));
  } catch {
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
  const extractedDocs = (await Promise.all(rankedSources.slice(0, 5).map((source) => fetchSourceDocument(source)))).filter(
    (item): item is ExtractedSourceDocument => item !== null,
  );

  if (extractedDocs.length === 0) {
    return { ...buildLowConfidenceResult(query, "Unable to extract content from ranked sources."), sources: rankedSources };
  }

  const preferredDoc = selectPreferredDocument(extractedDocs);
  const title = preferredDoc.title || query.trim() || null;

  const allDateTokens = extractedDocs.flatMap((doc) => doc.dateLike.map((token) => normalizeDateToken(token)).filter((item): item is string => Boolean(item)));
  const uniqueDates = [...new Set(allDateTokens)].sort();

  let startDate: string | null = uniqueDates[0] ?? null;
  let endDate: string | null = uniqueDates[1] ?? (uniqueDates[0] ?? null);

  if (uniqueDates.length > 2) {
    warnings.push("Multiple conflicting date candidates detected.");
  }

  if (startDate && endDate && endDate < startDate) {
    warnings.push("Date candidates conflict in ordering.");
    const temp = startDate;
    startDate = endDate;
    endDate = temp;
  }

  const cityCandidate = pickFieldValue(
    extractedDocs
      .flatMap((doc) => doc.locationLike)
      .filter((value) => /\b(?:гр\.?|city|перник|софия|пловдив|варна|бургас|русе|stara zagora)\b/iu.test(value)),
  );

  const location = pickFieldValue(extractedDocs.flatMap((doc) => doc.locationLike));
  const organizer = pickFieldValue(extractedDocs.flatMap((doc) => doc.organizerLike));
  const description = preferredDoc.description ?? (preferredDoc.snippet.length > 120 ? `${preferredDoc.snippet.slice(0, 220)}...` : null);
  const heroImage = preferredDoc.ogImage;

  if (!startDate) warnings.push("No reliable start date found.");
  if (!cityCandidate) warnings.push("City could not be confirmed from sources.");
  if (!organizer) warnings.push("Organizer could not be confirmed from sources.");

  const officialCount = rankedSources.filter((source) => source.is_official).length;
  const docsFromOfficial = extractedDocs.filter((doc) => doc.isOfficial).length;
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
      dates: pickConfidence(startDate ? score - (uniqueDates.length > 2 ? 20 : 0) : 18),
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
