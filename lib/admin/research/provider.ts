import { runMockResearch } from "@/lib/admin/research/mock";
import { normalizeResearchResult, validateDateFieldsOrErrors, validateDateRangeOrError } from "@/lib/admin/research/normalize";
import type { ResearchFestivalResult } from "@/lib/admin/research/types";

export async function researchFestival(query: string): Promise<ResearchFestivalResult> {
  const rawResult = await runMockResearch(query);
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
