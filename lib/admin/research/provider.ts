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
  const provider = result.metadata?.provider ?? "mock";
  const mode =
    result.metadata?.mode ?? (provider === "web" ? "real_web" : result.sources.length > 0 ? "special_case_mock" : "generic_mock");

  return {
    ...result,
    metadata: {
      provider,
      mode,
      source_count: result.metadata?.source_count ?? result.sources.length,
    },
  };
}

async function runProvider(query: string): Promise<ResearchFestivalResult> {
  if (!shouldUseWebProvider()) {
    return withMetadata(await runMockResearch(query));
  }

  try {
    // Important: when the web provider is configured and returns any usable response,
    // we return it as-is (even if weak/partial) for transparent behavior.
    return withMetadata(await runWebResearch(query));
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
  const dateRangeError = validateDateRangeOrError(normalized);

  if (dateRangeError) {
    throw new Error(dateRangeError);
  }

  return withMetadata(normalized);
}
