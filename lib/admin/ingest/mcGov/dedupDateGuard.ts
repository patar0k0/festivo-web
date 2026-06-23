import type { DuplicateMatch } from "@/lib/admin/research/findDuplicateFestivals";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAY_DIFFERENCE = 2;

function daysBetween(isoA: string, isoB: string): number {
  return Math.abs(Date.parse(isoA) - Date.parse(isoB)) / DAY_MS;
}

/**
 * `findDuplicateFestivals` scores title similarity for the admin's
 * interactive duplicate panel, where `same_year` alone is an adequate guard
 * because a human reviews every flagged match. For this unattended script,
 * `same_year` is too weak: village fairs on mc.gov.bg often share a generic
 * title template ("Събор на X") where 2-3 shared words across two different
 * villages can cross the title-score threshold within the same year. These
 * events are tied to a fixed calendar date rather than a recurring annual
 * edition, so an exact-or-near start_date match is a much stronger and
 * simpler disambiguator. Returns the first candidate whose start_date is
 * within `MAX_DAY_DIFFERENCE` days of the scraped event's start_date, or null
 * if none qualify.
 */
export function pickDuplicateWithDateGuard(
  matches: DuplicateMatch[],
  startDate: string | null,
): DuplicateMatch | null {
  if (!startDate) return null;

  for (const match of matches) {
    if (!match.start_date) continue;
    if (daysBetween(match.start_date, startDate) <= MAX_DAY_DIFFERENCE) {
      return match;
    }
  }

  return null;
}
