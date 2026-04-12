import { endOfMonth, format, nextSaturday, nextSunday, startOfMonth } from "date-fns";
import { calendarYmdToUtcNoon, sofiaWallClockNow } from "@/lib/festival/temporal";

/** Calendar bounds used by home quick chips and `/festivals` listing (Sofia wall clock). */
export function festivalDiscoveryCalendarBounds(nowYmd?: string) {
  const today = nowYmd ?? sofiaWallClockNow().ymd;
  const anchor = calendarYmdToUtcNoon(today);
  return {
    today,
    weekendStart: format(nextSaturday(anchor), "yyyy-MM-dd"),
    weekendEnd: format(nextSunday(anchor), "yyyy-MM-dd"),
    monthStart: format(startOfMonth(anchor), "yyyy-MM-dd"),
    monthEnd: format(endOfMonth(anchor), "yyyy-MM-dd"),
  };
}
