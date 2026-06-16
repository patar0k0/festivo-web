import { differenceInCalendarDays, getDay } from "date-fns";
import type { FestivalDateFields } from "@/lib/festival/listingDates";
import { primaryFestivalDate } from "@/lib/festival/listingDates";
import { calendarYmdToUtcNoon, sofiaWallClockNow } from "@/lib/festival/temporal";

/**
 * Short status label for the festival detail hero when we have a reliable start day.
 * Returns null when dates are missing, in the past, or too far ahead to label meaningfully.
 *
 * Both `start` and `today` are anchored to UTC-noon of their Europe/Sofia civil day so the
 * calendar-day diff is identical whether this runs on the server (Vercel = UTC) or on the
 * client (Europe/Sofia, or any other timezone). Using a raw `new Date()` here produced a
 * one-day discrepancy near midnight — the SSR (UTC) and hydration (local) labels diverged
 * and triggered a hydration mismatch (Sentry FESTIVO-WEB-2). It also makes the label
 * semantically correct: relative to Bulgarian time, not the server's UTC clock.
 */
export function getFestivalUrgencyLabelBg(festival: FestivalDateFields): string | null {
  const primary = primaryFestivalDate(festival);
  if (!primary) return null;

  const startYmd = primary.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startYmd)) return null;

  const start = calendarYmdToUtcNoon(startYmd);
  const today = calendarYmdToUtcNoon(sofiaWallClockNow().ymd);
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
