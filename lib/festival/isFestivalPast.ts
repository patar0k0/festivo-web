import type { FestivalDateFields } from "@/lib/festival/listingDates";
import { isFestivalPast as isFestivalPastTemporal } from "@/lib/festival/temporal";

/**
 * Whether the festival has fully ended, evaluated in Europe/Sofia wall-clock time.
 *
 * Delegates to the temporal state machine (`getFestivalTemporalState`), which anchors
 * "now" to Sofia time via `sofiaWallClockNow`. The result is therefore identical on the
 * server (Vercel = UTC) and the client (any timezone), so it can't cause a hydration
 * mismatch. It also respects `occurrence_dates` and `start_time`/`end_time`: a festival
 * counts as past only after the end of its end-date day in Sofia (or after `end_time`
 * when present) — not from 00:00 UTC of that day, which previously marked a festival
 * "past" during the very day it was still running.
 */
export function isFestivalPast(festival: FestivalDateFields): boolean {
  return isFestivalPastTemporal(festival);
}
