import { compareAsc, format, isWithinInterval, parseISO } from "date-fns";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse DB jsonb / API value into sorted unique yyyy-MM-dd strings, or null if not using discrete days. */
export function normalizeOccurrenceDatesInput(raw: unknown): string[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const t = item.trim();
    if (ISO_DATE.test(t)) out.push(t);
  }
  const unique = [...new Set(out)].sort(compareIsoStrings);
  return unique.length > 0 ? unique : null;
}

function compareIsoStrings(a: string, b: string): number {
  return compareAsc(parseISO(a), parseISO(b));
}

export function minIsoDate(dates: string[]): string | null {
  if (!dates.length) return null;
  return [...dates].sort(compareIsoStrings)[0] ?? null;
}

export function maxIsoDate(dates: string[]): string | null {
  if (!dates.length) return null;
  return [...dates].sort(compareIsoStrings)[dates.length - 1] ?? null;
}

/**
 * If discrete days are set: DB stores jsonb array + start/end = min/max.
 * If cleared: occurrence_dates null, keep start/end from the form.
 */
export function mergeOccurrenceDatesWithRange(input: {
  occurrence_days: unknown;
  start_date: string | null;
  end_date: string | null;
}): {
  occurrence_dates: string[] | null;
  start_date: string | null;
  end_date: string | null;
} {
  const discrete = normalizeOccurrenceDatesInput(input.occurrence_days);
  if (discrete?.length) {
    const lo = minIsoDate(discrete);
    const hi = maxIsoDate(discrete);
    return {
      occurrence_dates: discrete,
      start_date: lo,
      end_date: hi ?? lo,
    };
  }
  return {
    occurrence_dates: null,
    start_date: input.start_date?.trim() || null,
    end_date: input.end_date?.trim() || null,
  };
}

/** Calendar month: which day keys (yyyy-MM-dd) should show this festival inside [monthStart, monthEnd] inclusive. */
export function festivalDayKeysInMonth(
  festival: { start_date?: string | null; end_date?: string | null; occurrence_dates?: unknown },
  monthStart: Date,
  monthEnd: Date,
): string[] {
  const occ = normalizeOccurrenceDatesInput(festival.occurrence_dates);
  if (occ?.length) {
    const keys: string[] = [];
    for (const raw of occ) {
      const d = parseISO(raw);
      if (!isWithinInterval(d, { start: monthStart, end: monthEnd })) continue;
      keys.push(format(d, "yyyy-MM-dd"));
    }
    return keys;
  }
  if (!festival.start_date) return [];
  const start = parseISO(festival.start_date);
  const end = festival.end_date ? parseISO(festival.end_date) : start;
  const keys: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    if (isWithinInterval(cursor, { start: monthStart, end: monthEnd })) {
      keys.push(format(cursor, "yyyy-MM-dd"));
    }
    cursor = new Date(cursor.getTime() + 86400000);
  }
  return keys;
}

/** Human-readable list when discrete days exist; otherwise null (caller uses start/end range). */
export function formatOccurrenceDatesLabel(
  formatOne: (iso: string) => string,
  occurrence_dates: unknown,
): string | null {
  const occ = normalizeOccurrenceDatesInput(occurrence_dates);
  if (occ?.length) {
    if (occ.length === 1) return formatOne(occ[0]);
    return occ.map(formatOne).join(" · ");
  }
  return null;
}
