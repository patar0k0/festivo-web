import { endOfMonth, format, isSaturday, isSunday, nextSaturday, nextSunday, previousSaturday, startOfMonth } from "date-fns";
import { calendarYmdToUtcNoon, sofiaWallClockNow } from "@/lib/festival/temporal";

/**
 * Returns the start (Saturday) and end (Sunday) of the current or upcoming weekend.
 * If today IS Saturday or Sunday, returns the current weekend (not the next one).
 */
function currentOrNextWeekendBounds(anchor: Date): { weekendStart: string; weekendEnd: string } {
  if (isSaturday(anchor)) {
    // Today is Saturday — include this whole weekend
    return {
      weekendStart: format(anchor, "yyyy-MM-dd"),
      weekendEnd: format(nextSunday(anchor), "yyyy-MM-dd"),
    };
  }
  if (isSunday(anchor)) {
    // Today is Sunday — include yesterday (Sat) and today
    return {
      weekendStart: format(previousSaturday(anchor), "yyyy-MM-dd"),
      weekendEnd: format(anchor, "yyyy-MM-dd"),
    };
  }
  // Weekday — next upcoming Saturday/Sunday
  const sat = nextSaturday(anchor);
  return {
    weekendStart: format(sat, "yyyy-MM-dd"),
    weekendEnd: format(nextSunday(sat), "yyyy-MM-dd"),
  };
}

/** Calendar bounds used by home quick chips and `/festivals` listing (Sofia wall clock). */
export function festivalDiscoveryCalendarBounds(nowYmd?: string) {
  const today = nowYmd ?? sofiaWallClockNow().ymd;
  const anchor = calendarYmdToUtcNoon(today);
  const { weekendStart, weekendEnd } = currentOrNextWeekendBounds(anchor);
  return {
    today,
    weekendStart,
    weekendEnd,
    monthStart: format(startOfMonth(anchor), "yyyy-MM-dd"),
    monthEnd: format(endOfMonth(anchor), "yyyy-MM-dd"),
  };
}
