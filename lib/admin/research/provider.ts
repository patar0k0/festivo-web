import { runMockResearch } from "@/lib/admin/research/mock";
import { normalizeResearchResult, validateDateFieldsOrErrors, validateDateRangeOrError } from "@/lib/admin/research/normalize";
import type { ResearchFestivalResult } from "@/lib/admin/research/types";
import { runWebResearch } from "@/lib/admin/research/web-provider";

function shouldUseWebProvider(): boolean {
  return Boolean(process.env.WEB_RESEARCH_SEARCH_URL && process.env.WEB_RESEARCH_API_KEY);
}

async function runProvider(query: string): Promise<ResearchFestivalResult> {
  if (!shouldUseWebProvider()) {
    return runMockResearch(query);
  }

  try {
    const result = await runWebResearch(query);
    if (result.sources.length === 0) {
      const fallback = await runMockResearch(query);
      fallback.warnings = [...fallback.warnings, "Real web provider unavailable. Returned mock research fallback."];
      return fallback;
    }
    return result;
  } catch {
    const fallback = await runMockResearch(query);
    fallback.warnings = [...fallback.warnings, "Real web provider failed. Returned mock research fallback."];
    return fallback;
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

  return normalized;
}
