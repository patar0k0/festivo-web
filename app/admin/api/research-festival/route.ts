import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { fetchSourceDocument } from "@/lib/admin/research/source-extract";
import { rankSourcesAuthorityFirst } from "@/lib/admin/research/source-ranking";
import { normalizeResearchResult, validateDateRangeOrError } from "@/lib/admin/research/normalize";
import { extractFestivalWithOpenAi } from "@/lib/admin/research/openai-extract";
import type { ResearchFestivalResult, ResearchSource } from "@/lib/admin/research/types";

function isValidationError(message: string): boolean {
  return (
    message.includes("end_date cannot be before start_date") ||
    message.includes("must be a valid date in YYYY-MM-DD format") ||
    message.includes("query is required")
  );
}

async function searchWebSources(query: string): Promise<ResearchSource[]> {
  const endpoint = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      "User-Agent": "festivo-research-bot/4.0",
      Accept: "text/html",
    },
    signal: AbortSignal.timeout(12_000),
  }).catch(() => null);

  if (!response?.ok) return [];
  const html = await response.text().catch(() => "");
  if (!html) return [];

  const matches = [...html.matchAll(/<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gim)];
  const maybeSources: Array<ResearchSource | null> = matches.map((match) => {
      const url = match[1]?.trim();
      if (!url || !url.startsWith("http")) return null;
      const title = match[2]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || url;
      let domain = "";
      try {
        domain = new URL(url).hostname.replace(/^www\./, "").toLocaleLowerCase("en-US");
      } catch {
        return null;
      }
      return { url, title, domain, is_official: false } satisfies ResearchSource;
    });

  return maybeSources.filter((source): source is ResearchSource => source !== null);
}

function lowConfidenceFallback(query: string, sources: ResearchSource[], warning: string, diagnostics: Partial<ResearchFestivalResult["metadata"]>): ResearchFestivalResult {
  const topSource = sources[0] ?? null;
  return {
    query,
    normalized_query: query.trim().toLocaleLowerCase("bg-BG"),
    best_guess: {
      title: topSource?.title ?? null,
      description: null,
      city: null,
      start_date: null,
      end_date: null,
      location: null,
      organizer: null,
      hero_image: null,
      tags: [],
      is_free: null,
    },
    candidates: {
      titles: topSource
        ? [{ value: topSource.title, source_url: topSource.url, source_title: topSource.title, tier: topSource.tier ?? null, language: topSource.language ?? null, confidence: "low" }]
        : [],
      dates: [],
      cities: [],
      locations: [],
      organizers: [],
    },
    sources,
    confidence: {
      overall: "low",
      title: "low",
      dates: "low",
      city: "low",
      location: "low",
      description: "low",
      organizer: "low",
      hero_image: "low",
      is_free: "low",
    },
    warnings: [warning],
    evidence: [],
    metadata: {
      provider: "openai_web",
      mode: "fallback_minimal",
      source_count: sources.length,
      openai_attempted: diagnostics.openai_attempted ?? false,
      openai_json_parsed: diagnostics.openai_json_parsed ?? false,
      fallback_used: true,
      model: diagnostics.model,
    },
    title: topSource?.title ?? null,
    description: null,
    city: null,
    start_date: null,
    end_date: null,
    location: null,
    organizer: null,
    hero_image: null,
    tags: [],
    is_free: null,
  };
}

export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { query?: unknown } | null;
  const query = typeof body?.query === "string" ? body.query.trim() : "";

  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  try {
    const found = await searchWebSources(query);
    const ranked = rankSourcesAuthorityFirst(found).slice(0, 3);

    const extracted = await Promise.all(
      ranked.map(async (source) => {
        const doc = await fetchSourceDocument(source.url);
        if (!doc?.excerpt) return null;
        return {
          source_url: source.url,
          domain: source.domain,
          title: source.title,
          tier: source.tier ?? null,
          language: source.language ?? doc.language ?? null,
          excerpt: doc.excerpt,
        };
      }),
    );

    const preparedSources = extracted.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
    if (preparedSources.length === 0) {
      const fallback = lowConfidenceFallback(query, ranked, "No extractable source text was found.", {
        openai_attempted: false,
        openai_json_parsed: false,
      });
      return NextResponse.json({ ok: true, result: fallback });
    }

    try {
      const { result, diagnostics } = await extractFestivalWithOpenAi({ query, sources: preparedSources });
      const normalized = normalizeResearchResult(result);
      const dateRangeError = validateDateRangeOrError(normalized);

      if (dateRangeError) {
        const fallback = lowConfidenceFallback(query, normalized.sources, dateRangeError, {
          model: diagnostics.model,
          openai_attempted: diagnostics.attempted,
          openai_json_parsed: diagnostics.jsonParsed,
        });
        return NextResponse.json({ ok: true, result: fallback });
      }

      console.info("[research:api] diagnostics", {
        query,
        attempted: diagnostics.attempted,
        model: diagnostics.model,
        source_count_sent: preparedSources.length,
        json_parsed: diagnostics.jsonParsed,
        accepted: diagnostics.accepted,
      });

      return NextResponse.json({ ok: true, result: normalized });
    } catch (openAiError) {
      const message = openAiError instanceof Error ? openAiError.message : "OpenAI extraction failed";
      console.warn("[research:api] extraction failed", {
        query,
        attempted: true,
        source_count_sent: preparedSources.length,
        accepted: false,
      });
      const fallback = lowConfidenceFallback(query, ranked, `OpenAI extraction failed: ${message}`, {
        openai_attempted: true,
        openai_json_parsed: false,
        model: process.env.WEB_RESEARCH_LLM_MODEL?.trim() || "gpt-4o-mini",
      });
      return NextResponse.json({ ok: true, result: fallback });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected research error";
    return NextResponse.json({ error: message }, { status: isValidationError(message) ? 400 : 500 });
  }
}
