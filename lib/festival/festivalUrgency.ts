import { differenceInCalendarDays, getDay, parseISO, startOfDay } from "date-fns";
import type { FestivalDateFields } from "@/lib/festival/listingDates";
import { primaryFestivalDate } from "@/lib/festival/listingDates";

/**
 * Short status label for the festival detail hero when we have a reliable start day.
 * Returns null when dates are missing, in the past, or too far ahead to label meaningfully.
 */
export function getFestivalUrgencyLabelBg(festival: FestivalDateFields): string | null {
  const primary = primaryFestivalDate(festival);
  if (!primary) return null;

  let start: Date;
  try {
    start = startOfDay(parseISO(primary));
  } catch {
    return null;
  }

  const today = startOfDay(new Date());
  const diff = differenceInCalendarDays(start, today);
  if (diff < 0) return null;
  if (diff > 90) return null;

  if (diff === 0) return "Днес";

  const dow = getDay(start);
  const isWeekendDay = dow === 0 || dow === 6;
  if (isWeekendDay && diff >= 1 && diff <= 6) {
    return "Този уикенд";
  }

  if (diff === 1) return "Започва след 1 ден";
  return `Започва след ${diff} дни`;
}
