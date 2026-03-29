/** Europe/Sofia helpers for scheduling (aligned with /api/jobs/reminders). */

import { parseHmInputToDbTime } from "@/lib/festival/festivalTimeFields";

export const TZ = "Europe/Sofia";

export function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number | null {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
  });
  const offsetPart = formatter.formatToParts(date).find((part) => part.type === "timeZoneName")?.value;
  if (!offsetPart) {
    return null;
  }

  if (offsetPart === "GMT") {
    return 0;
  }

  const match = offsetPart.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!match) {
    return null;
  }

  const [, sign, hours, minutes = "0"] = match;
  const totalMinutes = Number(hours) * 60 + Number(minutes);
  return sign === "+" ? totalMinutes : -totalMinutes;
}

export function getDateAtHourInTimeZone(date: Date, timeZone: string, hour: number): Date | null {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  const utcGuess = Date.UTC(year, month - 1, day, hour, 0, 0, 0);

  const firstOffsetMinutes = getTimeZoneOffsetMinutes(new Date(utcGuess), timeZone);
  if (firstOffsetMinutes === null) {
    return null;
  }

  const firstPass = utcGuess - firstOffsetMinutes * 60 * 1000;
  const secondOffsetMinutes = getTimeZoneOffsetMinutes(new Date(firstPass), timeZone);
  if (secondOffsetMinutes === null) {
    return null;
  }

  return new Date(utcGuess - secondOffsetMinutes * 60 * 1000);
}

export function getDateAtHmsInTimeZone(date: Date, timeZone: string, hour: number, minute: number, second: number): Date | null {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second, 0);

  const firstOffsetMinutes = getTimeZoneOffsetMinutes(new Date(utcGuess), timeZone);
  if (firstOffsetMinutes === null) {
    return null;
  }

  const firstPass = utcGuess - firstOffsetMinutes * 60 * 1000;
  const secondOffsetMinutes = getTimeZoneOffsetMinutes(new Date(firstPass), timeZone);
  if (secondOffsetMinutes === null) {
    return null;
  }

  return new Date(utcGuess - secondOffsetMinutes * 60 * 1000);
}

/**
 * Canonical "start" instant for a festival row: optional `start_time` (HH:MM:SS) uses that wall clock in Europe/Sofia
 * on start_date; date-only uses 09:00 local; timestamptz strings use the parsed instant.
 */
export function getFestivalStartInstant(startDateValue: string | null, startTimeHmss?: string | null): Date | null {
  if (!startDateValue) {
    return null;
  }

  const trimmed = startDateValue.trim();
  const dayOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);

  const timeNorm = parseHmInputToDbTime(startTimeHmss ?? null);
  if (dayOnly && timeNorm) {
    const parts = timeNorm.match(/^(\d{2}):(\d{2}):(\d{2})$/);
    if (!parts) {
      return null;
    }
    const hh = Number(parts[1]);
    const mm = Number(parts[2]);
    const ss = Number(parts[3]);
    const anchor = new Date(`${trimmed}T12:00:00`);
    return getDateAtHmsInTimeZone(anchor, TZ, hh, mm, ss);
  }

  if (trimmed.includes("T")) {
    const start = new Date(trimmed);
    return Number.isNaN(start.getTime()) ? null : start;
  }

  if (!dayOnly) {
    const start = new Date(trimmed);
    return Number.isNaN(start.getTime()) ? null : start;
  }

  const anchor = new Date(`${trimmed}T12:00:00`);
  return getDateAtHourInTimeZone(anchor, TZ, 9);
}

export function formatSofiaDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

export function isSameSofiaCalendarDay(a: Date, b: Date): boolean {
  return formatSofiaDate(a) === formatSofiaDate(b);
}

/** Returns true if local Sofia time is inside [start, end), supports overnight window. */
export function isInQuietHours(
  now: Date,
  quietStart: string | null | undefined,
  quietEnd: string | null | undefined,
): boolean {
  if (!quietStart || !quietEnd) {
    return false;
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const minutes = hh * 60 + mm;

  const parseHm = (t: string) => {
    const [h, m] = t.split(":").map((x) => Number(x));
    if (Number.isNaN(h) || Number.isNaN(m)) return 0;
    return h * 60 + m;
  };

  const a = parseHm(quietStart);
  const b = parseHm(quietEnd);

  if (a === b) {
    return false;
  }

  if (a < b) {
    return minutes >= a && minutes < b;
  }

  return minutes >= a || minutes < b;
}

/** Advance in 15-minute steps until outside quiet hours (promo reschedule). */
export function nextAllowedSendAfterQuietHours(
  from: Date,
  quietStart: string | null | undefined,
  quietEnd: string | null | undefined,
): Date {
  if (!quietStart || !quietEnd) {
    return from;
  }

  let d = new Date(from.getTime());
  const stepMs = 15 * 60 * 1000;
  const maxSteps = 192;

  for (let i = 0; i < maxSteps; i += 1) {
    if (!isInQuietHours(d, quietStart, quietEnd)) {
      return d;
    }
    d = new Date(d.getTime() + stepMs);
  }

  return new Date(from.getTime() + stepMs);
}
