/** Europe/Sofia helpers for scheduling (aligned with /api/jobs/reminders). */

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

/**
 * Canonical "start" instant for a festival row: date-only uses 09:00 local on start_date;
 * timestamptz strings use the parsed instant.
 */
export function getFestivalStartInstant(startDateValue: string | null): Date | null {
  if (!startDateValue) {
    return null;
  }

  const trimmed = startDateValue.trim();
  if (trimmed.includes("T")) {
    const start = new Date(trimmed);
    return Number.isNaN(start.getTime()) ? null : start;
  }

  const dayOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
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
