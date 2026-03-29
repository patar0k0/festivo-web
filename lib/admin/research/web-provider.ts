import { buildResearchQueries } from "@/lib/admin/research/query-builder";
import { runLlmFieldExtraction, type LlmSourcePayload } from "@/lib/admin/research/llm-extract";
import { fetchSourceDocument, normalizeUrl } from "@/lib/admin/research/source-extract";
import { getSourceAuthorityTier, rankSourcesAuthorityFirst } from "@/lib/admin/research/source-ranking";
import type { ResearchConfidenceLevel, ResearchFestivalResult, ResearchSource } from "@/lib/admin/research/types";

type SearchItem = { url: string; title: string };

function normalizeQuery(query: string): string {
  return query.trim().toLocaleLowerCase("bg-BG");
}

function confidenceFromSources(level: number): ResearchConfidenceLevel {
  if (level >= 3) return "high";
  if (level >= 2) return "medium";
  return "low";
}

function maybeObviousCity(query: string, docs: Array<{ excerpt: string }>): string | null {
  const text = `${query} ${docs.map((doc) => doc.excerpt.slice(0, 300)).join(" ")}`;
  const match = text.match(/\b(София|Пловдив|Варна|Бургас|Русе|Перник|Казанлък|Стара\s+Загора|Велико\s+Търново)\b/u);
  return match?.[1] ?? null;
}

async function runSearch(query: string): Promise<SearchItem[]> {
  const endpoint = process.env.WEB_RESEARCH_SEARCH_URL;
  const apiKey = process.env.WEB_RESEARCH_API_KEY;
  if (!endpoint || !apiKey) {
    throw new Error("Web search provider is not configured.");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ q: query, limit: Number(process.env.WEB_RESEARCH_SEARCH_LIMIT ?? "8") }),
    signal: AbortSignal.timeout(7_000),
  });

  if (!response.ok) {
    throw new Error(`Search request failed (${response.status}).`);
  }

  const data = (await response.json()) as { results?: unknown; items?: unknown };
  const rawItems = Array.isArray(data.results) ? data.results : Array.isArray(data.items) ? data.items : [];

  return rawItems
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const url = normalizeUrl((item as { url?: unknown; link?: unknown }).url as string) ?? normalizeUrl((item as { link?: unknown }).link as string);
      const title = typeof (item as { title?: unknown }).title === "string" ? (item as { title: string }).title.trim() : "";
      if (!url) return null;
      return { url, title: title || new URL(url).hostname };
    })
    .filter((item): item is SearchItem => Boolean(item));
}

function toResearchSource(item: SearchItem): ResearchSource {
  const domain = new URL(item.url).hostname.replace(/^www\./, "").toLocaleLowerCase("en-US");
  const tier = getSourceAuthorityTier({ ...item, domain });
  return {
    url: item.url,
    domain,
    title: item.title,
    tier,
    language: null,
    is_official: tier === "tier1_official",
  };
}

function buildMinimalFallback(query: string, sources: ResearchSource[], warnings: string[], city: string | null): ResearchFestivalResult {
  return {
    query,
    normalized_query: normalizeQuery(query),
    best_guess: {
      title: null,
      start_date: null,
      end_date: null,
      city,
      location: null,
      organizers: [],
      organizer: null,
      description: null,
      hero_image: null,
      tags: [],
      start_time: null,
      end_time: null,
    },
    candidates: { titles: [], dates: [], cities: [], locations: [], organizers: [] },
    sources,
    warnings,
    evidence: [],
    confidence: {
      overall: "low",
      title: "low",
      dates: "low",
      city: city ? "low" : "low",
      location: "low",
      description: "low",
      organizer: "low",
      hero_image: "low",
    },
    metadata: { provider: "web", mode: "real_web", source_count: sources.length },
  };
}

export async function runWebResearch(query: string): Promise<ResearchFestivalResult> {
  const generatedQueries = buildResearchQueries(query);
  const collected: SearchItem[] = [];

  for (const searchQuery of generatedQueries.slice(0, 4)) {
    const items = await runSearch(searchQuery).catch(() => []);
    collected.push(...items);
  }

  const ranked = rankSourcesAuthorityFirst(collected.map(toResearchSource));
  const topSources = ranked.slice(0, 3);

  const docs: Array<{ source: ResearchSource; doc: { url: string; domain: string; title: string; language: "bg" | "mixed" | "non_bg"; excerpt: string } }> = [];
  for (const source of topSources) {
    const doc = await fetchSourceDocument(source.url).catch(() => null);
    if (doc) docs.push({ source, doc });
  }

  const llmSources: LlmSourcePayload[] = docs.map(({ source, doc }) => ({
    source_url: source.url,
    domain: source.domain,
    title: doc.title || source.title,
    tier: source.tier ?? "tier3_reference",
    language: doc.language,
    text_excerpt: doc.excerpt,
  }));

  if (llmSources.length === 0) {
    return buildMinimalFallback(query, topSources, ["No usable source text could be extracted from top ranked sources."], maybeObviousCity(query, []));
  }

  try {
    const llm = await runLlmFieldExtraction({
      query,
      normalized_query: normalizeQuery(query),
      sources: llmSources,
    });

    const resolvedSourceCount = docs.length;
    const confidence = confidenceFromSources(resolvedSourceCount);

    return {
      query,
      normalized_query: normalizeQuery(query),
      best_guess: {
        ...llm.best_guess,
        end_date: llm.best_guess.end_date ?? llm.best_guess.start_date,
        start_time: llm.best_guess.start_time ?? null,
        end_time: llm.best_guess.end_time ?? null,
      },
      candidates: llm.candidates,
      sources: docs.map(({ source, doc }) => ({ ...source, language: doc.language })),
      warnings: llm.warnings,
      evidence: llm.evidence,
      confidence: {
        overall: confidence,
        title: llm.best_guess.title ? confidence : "low",
        dates: llm.best_guess.start_date ? confidence : "low",
        city: llm.best_guess.city ? confidence : "low",
        location: llm.best_guess.location ? confidence : "low",
        description: llm.best_guess.description ? "medium" : "low",
        organizer: llm.best_guess.organizer ? confidence : "low",
        hero_image: llm.best_guess.hero_image ? "medium" : "low",
      },
      metadata: {
        provider: "web",
        mode: "real_web",
        source_count: docs.length,
      },
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown LLM extraction error.";
    return buildMinimalFallback(
      query,
      docs.map(({ source, doc }) => ({ ...source, language: doc.language })),
      [`LLM extraction failed; returning minimal reviewable result. (${reason})`],
      maybeObviousCity(query, docs.map(({ doc }) => doc)),
    );
  }
}
