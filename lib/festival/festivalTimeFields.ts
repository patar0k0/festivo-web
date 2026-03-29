/**
 * Wall-clock times for festival days (Postgres `time without time zone`).
 * Display and notifications use Europe/Sofia with the calendar date.
 */

/** Parse user/API input (HH:mm or HH:mm:ss) to Postgres time string HH:MM:SS, or null if invalid. */
export function parseHmInputToDbTime(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t) return null;
  const m = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const sec = m[3] !== undefined ? Number(m[3]) : 0;
  if (!Number.isInteger(h) || h < 0 || h > 23) return null;
  if (!Number.isInteger(min) || min < 0 || min > 59) return null;
  if (!Number.isInteger(sec) || sec < 0 || sec > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** Input value for HTML time inputs from DB/ISO strings. */
export function dbTimeToHmInput(db: string | null | undefined): string {
  if (!db || typeof db !== "string") return "";
  const m = db.trim().match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  return m ? `${m[1]}:${m[2]}` : "";
}

function minutesSinceMidnightHms(hms: string): number | null {
  const m = hms.match(/^(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * When both times exist, requires end >= start; invalid pairs become nulls.
 * Single start without end is allowed.
 */
export function normalizeFestivalTimePair(
  start: string | null,
  end: string | null,
): { start_time: string | null; end_time: string | null } {
  if (!start && !end) return { start_time: null, end_time: null };
  if (!start) return { start_time: null, end_time: null };
  if (!end) return { start_time: start, end_time: null };
  const sm = minutesSinceMidnightHms(start);
  const em = minutesSinceMidnightHms(end);
  if (sm === null || em === null) return { start_time: null, end_time: null };
  if (em < sm) return { start_time: null, end_time: null };
  return { start_time: start, end_time: end };
}
