import { maxIsoDate, minIsoDate, normalizeOccurrenceDatesInput } from "@/lib/festival/occurrenceDates";
import type { FestivalDateFields } from "@/lib/festival/listingDates";

export type FestivalTemporalState = "upcoming" | "ongoing" | "past";

export type FestivalTemporalInput = FestivalDateFields;

const END_OF_DAY_MINUTES = 23 * 60 + 59;

type WallPoint = { ymd: string; minutes: number };

/** Calendar date + minute-of-day in Europe/Sofia (wall clock). */
export function sofiaWallClockNow(reference: Date = new Date()): WallPoint {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Sofia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(reference);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "0";
  const y = get("year");
  const mo = get("month");
  const da = get("day");
  const h = get("hour");
  const mi = get("minute");
  return { ymd: `${y}-${mo}-${da}`, minutes: Number(h) * 60 + Number(mi) };
}

/**
 * Noon UTC on a civil yyyy-MM-dd. Safe anchor for date-fns weekday/month helpers when the
 * process TZ is UTC (e.g. Vercel): the local calendar day matches y-m-d.
 */
export function calendarYmdToUtcNoon(ymd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return new Date();
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
}

function hmsToMinutes(hms: string | null | undefined): number | null {
  if (hms == null || typeof hms !== "string") return null;
  const m = hms.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || hh < 0 || hh > 23 || !Number.isFinite(mm) || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function compareWall(a: WallPoint, b: WallPoint): number {
  const c = a.ymd.localeCompare(b.ymd);
  if (c !== 0) return c;
  return a.minutes - b.minutes;
}

/** First/last calendar day for the festival span (discrete days or start–end range). */
export function festivalEffectiveCalendarBounds(f: FestivalTemporalInput): { startYmd: string; endYmd: string } | null {
  const occ = normalizeOccurrenceDatesInput(f.occurrence_dates);
  if (occ?.length) {
    const lo = minIsoDate(occ);
    const hi = maxIsoDate(occ);
    if (!lo) return null;
    return { startYmd: lo, endYmd: hi ?? lo };
  }
  const sd = f.start_date?.trim() || null;
  if (!sd) return null;
  const ed = f.end_date?.trim() || null;
  return { startYmd: sd, endYmd: ed || sd };
}

function startBoundary(f: FestivalTemporalInput, bounds: { startYmd: string; endYmd: string }): WallPoint {
  const m = hmsToMinutes(f.start_time) ?? 0;
  return { ymd: bounds.startYmd, minutes: m };
}

function endBoundary(f: FestivalTemporalInput, bounds: { startYmd: string; endYmd: string }): WallPoint {
  const m = hmsToMinutes(f.end_time) ?? END_OF_DAY_MINUTES;
  return { ymd: bounds.endYmd, minutes: m };
}

/**
 * Derived lifecycle state from calendar dates and optional wall times (Europe/Sofia).
 * Missing dates → `upcoming` (unknown / TBA — never treated as past).
 */
export function getFestivalTemporalState(f: FestivalTemporalInput, now?: Date): FestivalTemporalState {
  const bounds = festivalEffectiveCalendarBounds(f);
  if (!bounds) return "upcoming";

  const ref = now ?? new Date();
  const nowWall = sofiaWallClockNow(ref);
  const start = startBoundary(f, bounds);
  let end = endBoundary(f, bounds);
  if (compareWall(end, start) < 0) {
    end = start;
  }

  if (compareWall(nowWall, start) < 0) return "upcoming";
  if (compareWall(nowWall, end) > 0) return "past";
  return "ongoing";
}

export function isFestivalUpcoming(f: FestivalTemporalInput, now?: Date): boolean {
  return getFestivalTemporalState(f, now) === "upcoming";
}

export function isFestivalOngoing(f: FestivalTemporalInput, now?: Date): boolean {
  return getFestivalTemporalState(f, now) === "ongoing";
}

export function isFestivalPast(f: FestivalTemporalInput, now?: Date): boolean {
  return getFestivalTemporalState(f, now) === "past";
}

export function temporalListingRank(state: FestivalTemporalState): number {
  switch (state) {
    case "ongoing":
      return 0;
    case "upcoming":
      return 1;
    case "past":
      return 2;
  }
}

/** Lexicographic key: earlier start sorts first. */
export function festivalSortStartKey(f: FestivalTemporalInput): string {
  const bounds = festivalEffectiveCalendarBounds(f);
  if (!bounds) return "9999-12-31";
  const m = hmsToMinutes(f.start_time) ?? 0;
  return `${bounds.startYmd}:${String(m).padStart(5, "0")}`;
}

/** Lexicographic key: earlier end sorts first. */
export function festivalSortEndKey(f: FestivalTemporalInput): string {
  const bounds = festivalEffectiveCalendarBounds(f);
  if (!bounds) return "0000-00-00";
  const m = hmsToMinutes(f.end_time) ?? END_OF_DAY_MINUTES;
  return `${bounds.endYmd}:${String(m).padStart(5, "0")}`;
}
