import { runMockResearch } from "@/lib/admin/research/mock";
import { normalizeResearchResult, validateDateFieldsOrErrors, validateDateRangeOrError } from "@/lib/admin/research/normalize";
import type { ResearchFestivalResult } from "@/lib/admin/research/types";
import { runWebResearch } from "@/lib/admin/research/web-provider";

function shouldUseWebProvider(): boolean {
  return Boolean(process.env.WEB_RESEARCH_SEARCH_URL && process.env.WEB_RESEARCH_API_KEY);
}

function withFallbackWarning(result: ResearchFestivalResult, warning: string): ResearchFestivalResult {
  return {
    ...result,
    warnings: [...result.warnings, warning],
  };
}

function withMetadata(result: ResearchFestivalResult): ResearchFestivalResult {
  const sourceCount = result.metadata?.source_count ?? result.sources.length;
  const provider = result.metadata?.provider ?? "mock";
  const mode =
    result.metadata?.mode ?? (provider === "web" ? "real_web" : result.sources.length > 0 ? "special_case_mock" : "generic_mock");

  return {
    ...result,
    metadata: {
      provider,
      mode,
      source_count: sourceCount,
    },
  };
}

async function runProvider(query: string): Promise<ResearchFestivalResult> {
  if (!shouldUseWebProvider()) {
    return withMetadata(await runMockResearch(query));
  }

  try {
    const result = withMetadata(await runWebResearch(query));
    console.info("[research:provider] raw provider output metadata", {
      query,
      provider: result.metadata?.provider,
      mode: result.metadata?.mode,
      source_count: result.metadata?.source_count,
      source_urls: result.sources.slice(0, 3).map((source) => source.url),
    });
    return result;
  } catch {
    const fallback = await runMockResearch(query);
    return withMetadata(withFallbackWarning(fallback, "Real web provider failed unexpectedly. Using mock fallback."));
  }
}

export async function researchFestival(query: string): Promise<ResearchFestivalResult> {
  const rawResult = await runProvider(query);
  const dateFieldErrors = validateDateFieldsOrErrors(rawResult);
  if (dateFieldErrors.length > 0) {
    throw new Error(dateFieldErrors[0]);
  }

  const normalized = normalizeResearchResult(rawResult);
  console.info("[research:provider] normalized output metadata", {
    query,
    provider: normalized.metadata?.provider,
    mode: normalized.metadata?.mode,
    source_count: normalized.metadata?.source_count,
  });

  const dateRangeError = validateDateRangeOrError(normalized);

  if (dateRangeError) {
    throw new Error(dateRangeError);
  }

  return withMetadata(normalized);
}
