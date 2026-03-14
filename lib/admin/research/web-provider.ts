import { dedupeAndRankSources } from "@/lib/admin/research/source-ranking";
import { extractDomain, fetchSourceDocument } from "@/lib/admin/research/source-extract";
import type { ResearchConfidenceLevel, ResearchFestivalResult, ResearchSource } from "@/lib/admin/research/types";

type SearchItem = {
  url: string;
  title: string;
  snippet: string;
};

const SEARCH_TIMEOUT_MS = 6000;

function normalizeQuery(query: string): string {
  return query.trim().toLocaleLowerCase("bg-BG");
}

function parseSearchItems(payload: unknown): SearchItem[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];

  const root = payload as {
    results?: unknown;
    items?: unknown;
    data?: { results?: unknown };
  };

  const candidate = Array.isArray(root.results)
    ? root.results
    : Array.isArray(root.items)
      ? root.items
      : Array.isArray(root.data?.results)
        ? root.data.results
        : [];

  return candidate
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
      const item = entry as { url?: unknown; link?: unknown; title?: unknown; snippet?: unknown; description?: unknown };
      const url = typeof item.url === "string" ? item.url.trim() : typeof item.link === "string" ? item.link.trim() : "";
      const title = typeof item.title === "string" ? item.title.trim() : "";
      const snippet = typeof item.snippet === "string" ? item.snippet.trim() : typeof item.description === "string" ? item.description.trim() : "";
      if (!url) return null;
      return {
        url,
        title: title || url,
        snippet,
      };
    })
    .filter((item): item is SearchItem => item !== null);
}

function looksOfficial(url: string, title: string, query: string): boolean {
  const domain = extractDomain(url);
  const q = query.toLocaleLowerCase("bg-BG");
  const t = title.toLocaleLowerCase("bg-BG");

  if (t.includes("official") || t.includes("официал")) return true;
  if (domain.includes("festival") || domain.includes("fest")) return true;

  const withoutYear = q.replace(/\b(19|20)\d{2}\b/g, "").trim();
  if (withoutYear && domain.includes(withoutYear.replace(/\s+/g, ""))) return true;

  return false;
}

function pickConfidence(score: number): ResearchConfidenceLevel {
  if (score >= 70) return "high";
  if (score >= 45) return "medium";
  return "low";
}

function parseDateCandidates(text: string): string[] {
  const iso = [...text.matchAll(/\b((?:19|20)\d{2})-(\d{2})-(\d{2})\b/g)].map((m) => m[0]);
  const dotted = [...text.matchAll(/\b(\d{1,2})[./-](\d{1,2})[./-]((?:19|20)\d{2})\b/g)].map((m) => {
    const day = m[1].padStart(2, "0");
    const month = m[2].padStart(2, "0");
    const year = m[3];
    return `${year}-${month}-${day}`;
  });

  return [...iso, ...dotted];
}

function extractFieldByKeyword(snippet: string, keyword: RegExp): string | null {
  const match = snippet.match(keyword);
  if (!match?.[1]) return null;
  const value = match[1].trim().replace(/[.,;]+$/, "");
  return value || null;
}

async function searchWeb(query: string): Promise<ResearchSource[]> {
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
    requestUrl.searchParams.set("limit", "12");

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
      domain: extractDomain(item.url),
      title: item.title,
      is_official: looksOfficial(item.url, item.title, query),
    }));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
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
  };
}

export async function runWebResearch(query: string): Promise<ResearchFestivalResult> {
  const normalizedQuery = normalizeQuery(query);
  const warnings: string[] = [];

  const rawSources = await searchWeb(query);
  if (rawSources.length === 0) {
    return buildLowConfidenceResult(query, "Real web provider returned no sources.");
  }

  const rankedSources = dedupeAndRankSources(rawSources, query, 8);
  const extractedDocs = (await Promise.all(rankedSources.slice(0, 5).map((source) => fetchSourceDocument(source)))).filter(
    (item): item is NonNullable<typeof item> => item !== null,
  );

  if (extractedDocs.length === 0) {
    return {
      ...buildLowConfidenceResult(query, "Unable to extract content from ranked sources."),
      sources: rankedSources,
    };
  }

  const topDoc = extractedDocs[0];
  const fullText = extractedDocs.map((doc) => `${doc.title} ${doc.description ?? ""} ${doc.snippet}`).join(" \n ");

  const dateCandidates = parseDateCandidates(fullText);
  const uniqueDates = [...new Set(dateCandidates)].sort();
  let startDate: string | null = uniqueDates[0] ?? null;
  let endDate: string | null = uniqueDates.length > 1 ? uniqueDates[uniqueDates.length - 1] : uniqueDates[0] ?? null;

  if (uniqueDates.length > 2) {
    warnings.push("Multiple date candidates detected across sources. Date confidence reduced.");
  }

  if (startDate && endDate && endDate < startDate) {
    const swappedStart = endDate;
    const swappedEnd = startDate;
    startDate = swappedStart;
    endDate = swappedEnd;
    warnings.push("Date candidates had reversed order in sources.");
  }

  const city =
    extractFieldByKeyword(fullText, /(?:гр\.|город|city)\s*[:\-]?\s*([\p{L}\-\s]{2,60})/iu) ??
    extractFieldByKeyword(fullText, /(?:в\s+)([А-ЯA-Z][\p{L}\-]{2,40})(?:\s|,|\.)/u) ??
    null;
  const organizer = extractFieldByKeyword(fullText, /(?:организатор|organizer)\s*[:\-]?\s*([\p{L}\d"'\-\s]{3,120})/iu);
  const location = extractFieldByKeyword(fullText, /(?:локац(?:ия)?|location|venue)\s*[:\-]?\s*([\p{L}\d"'\-\s,]{3,140})/iu);

  const titleFromQuery = query.trim();
  const title = topDoc.title || titleFromQuery || null;
  const description = topDoc.description ?? (topDoc.snippet.length > 140 ? `${topDoc.snippet.slice(0, 180)}...` : null);

  const titleEvidence = rankedSources[0];
  const datesEvidence = rankedSources.find((source) => source.url === topDoc.url) ?? rankedSources[0];

  const officialCount = rankedSources.filter((source) => source.is_official).length;
  if (officialCount === 0) {
    warnings.push("No official source detected among top results.");
  }

  if (!startDate) warnings.push("No reliable start date found in extracted sources.");
  if (!city) warnings.push("City is uncertain from available sources.");
  if (!organizer) warnings.push("Organizer is uncertain from available sources.");

  const qualityScore = Math.max(0, Math.min(100, officialCount * 20 + extractedDocs.length * 8 + (startDate ? 20 : 0) + (city ? 10 : 0) + (organizer ? 10 : 0) - warnings.length * 8));
  const fieldConfidence = {
    title: pickConfidence(qualityScore),
    dates: pickConfidence((startDate ? qualityScore : qualityScore - 25) - (uniqueDates.length > 2 ? 15 : 0)),
    city: pickConfidence(city ? qualityScore - 10 : 20),
    location: pickConfidence(location ? qualityScore - 15 : 20),
    description: pickConfidence(description ? qualityScore - 15 : 20),
    organizer: pickConfidence(organizer ? qualityScore - 10 : 20),
    hero_image: pickConfidence(topDoc.ogImage ? qualityScore - 10 : 15),
  } as const;

  return {
    query,
    normalized_query: normalizedQuery,
    title,
    start_date: startDate,
    end_date: endDate,
    city,
    location,
    description,
    organizer,
    hero_image: topDoc.ogImage,
    tags: query
      .split(/\s+/)
      .map((part) => part.trim().toLocaleLowerCase("bg-BG"))
      .filter((part) => part.length > 2 && !/^(19|20)\d{2}$/.test(part))
      .slice(0, 5),
    sources: rankedSources,
    confidence: {
      overall: pickConfidence(qualityScore),
      ...fieldConfidence,
    },
    warnings,
    evidence: [
      title && titleEvidence
        ? {
            field: "title",
            value: title,
            source_url: titleEvidence.url,
          }
        : null,
      startDate && datesEvidence
        ? {
            field: "dates",
            value: endDate && endDate !== startDate ? `${startDate} to ${endDate}` : startDate,
            source_url: datesEvidence.url,
          }
        : null,
      city && datesEvidence
        ? {
            field: "city",
            value: city,
            source_url: datesEvidence.url,
          }
        : null,
    ].filter((item): item is NonNullable<typeof item> => item !== null),
  };
}
