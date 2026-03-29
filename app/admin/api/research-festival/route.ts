import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { isGeminiConfigured } from "@/lib/admin/research/gemini-provider";
import { normalizeResearchResult, validateDateRangeOrError } from "@/lib/admin/research/normalize";
import { runGeminiResearchPipeline } from "@/lib/admin/research/research-pipeline";
import type { ResearchFestivalResult, ResearchSource } from "@/lib/admin/research/types";

function isValidationError(message: string): boolean {
  return (
    message.includes("end_date cannot be before start_date") ||
    message.includes("must be a valid date in YYYY-MM-DD format") ||
    message.includes("query is required") ||
    message.includes("GEMINI_API_KEY")
  );
}

function lowConfidenceFallback(query: string, sources: ResearchSource[], warning: string): ResearchFestivalResult {
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
      organizers: [],
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
      provider: "gemini_pipeline",
      mode: "fallback_minimal",
      source_count: sources.length,
      fallback_used: true,
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

  if (!isGeminiConfigured()) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured (or GOOGLE_AI_API_KEY)" }, { status: 503 });
  }

  try {
    const normalized = await runGeminiResearchPipeline(query);
    const dateRangeError = validateDateRangeOrError(normalized);

    if (dateRangeError) {
      const fallback = lowConfidenceFallback(query, normalized.sources, dateRangeError);
      return NextResponse.json({ ok: true, result: normalizeResearchResult(fallback) });
    }

    return NextResponse.json({ ok: true, result: normalized });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected research error";
    return NextResponse.json({ error: message }, { status: isValidationError(message) ? 400 : 500 });
  }
}
