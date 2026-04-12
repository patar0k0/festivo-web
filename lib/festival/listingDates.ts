import { format } from "date-fns";
import { bg } from "date-fns/locale";
import { normalizeOccurrenceDatesInput } from "@/lib/festival/occurrenceDates";
import { dbTimeToHmInput } from "@/lib/festival/festivalTimeFields";
import { sofiaWallClockNow } from "@/lib/festival/temporal";

/** Minimal fields for date display (published festival, admin row, etc.). */
export type FestivalDateFields = {
  start_date?: string | null;
  end_date?: string | null;
  occurrence_dates?: unknown;
  start_time?: string | null;
  end_time?: string | null;
};

/** Appends " · HH:mm" or " · HH:mm – HH:mm" when wall times exist (skipped for multi-day occurrence lists). */
function festivalClockSuffix(festival: FestivalDateFields, allowTime: boolean): string {
  if (!allowTime) return "";
  const s = dbTimeToHmInput(festival.start_time ?? null);
  const e = dbTimeToHmInput(festival.end_time ?? null);
  if (!s && !e) return "";
  if (s && e) return ` · ${s} – ${e}`;
  if (s) return ` · ${s}`;
  return "";
}

/** First calendar day for badges / sorting (discrete list or start_date). */
export function primaryFestivalDate(festival: FestivalDateFields): string | null {
  const occ = normalizeOccurrenceDatesInput(festival.occurrence_dates);
  if (occ?.length) return occ[0] ?? null;
  return festival.start_date ?? null;
}

const RANGE_EM_DASH = "\u2014";

function parseYmdLocal(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function currentSofiaCalendarYear(reference: Date = new Date()): number {
  return Number(sofiaWallClockNow(reference).ymd.slice(0, 4));
}

/**
 * Continuous start–end range (or single day): Bulgarian month names, em dash between day spans,
 * month written once when shared, year omitted when the whole span is in the current Sofia calendar year.
 */
export function formatContinuousFestivalRangeBg(
  start?: string | null,
  end?: string | null,
  reference: Date = new Date(),
): string {
  const yCur = currentSofiaCalendarYear(reference);
  const s = start?.trim() || null;
  if (!s) return "Дата предстои";
  const ds = parseYmdLocal(s);
  if (!ds) return "Дата предстои";

  const eRaw = end?.trim() || null;
  const ed = eRaw && eRaw !== s ? parseYmdLocal(eRaw) : null;

  if (!ed) {
    const y = ds.getFullYear();
    const withYear = y !== yCur;
    return format(ds, withYear ? "d MMMM yyyy" : "d MMMM", { locale: bg });
  }

  const yS = ds.getFullYear();
  const yE = ed.getFullYear();
  const mS = ds.getMonth();
  const mE = ed.getMonth();
  const dS = ds.getDate();
  const dE = ed.getDate();

  if (yS !== yE) {
    return `${format(ds, "d MMMM yyyy", { locale: bg })}${RANGE_EM_DASH}${format(ed, "d MMMM yyyy", { locale: bg })}`;
  }

  const yearSuffix = yS === yCur ? "" : ` ${yS}`;

  if (mS === mE) {
    return `${dS}${RANGE_EM_DASH}${dE} ${format(ds, "MMMM", { locale: bg })}${yearSuffix}`;
  }

  return `${format(ds, "d MMMM", { locale: bg })}${RANGE_EM_DASH}${format(ed, "d MMMM", { locale: bg })}${yearSuffix}`;
}

/** Short line for cards (Bulgarian months; same range rules as {@link formatContinuousFestivalRangeBg}). */
export function formatFestivalDateLineShort(festival: FestivalDateFields): string {
  const occ = normalizeOccurrenceDatesInput(festival.occurrence_dates);
  if (occ && occ.length > 1) {
    return occ.map((iso) => formatContinuousFestivalRangeBg(iso, iso)).join(" · ");
  }
  if (occ?.length === 1) {
    return formatContinuousFestivalRangeBg(occ[0], occ[0]) + festivalClockSuffix(festival, true);
  }
  return formatContinuousFestivalRangeBg(festival.start_date, festival.end_date) + festivalClockSuffix(festival, true);
}

/** Detail hero: Bulgarian long month names. */
export function formatFestivalDateLineLongBg(festival: FestivalDateFields): string {
  const occ = normalizeOccurrenceDatesInput(festival.occurrence_dates);
  if (occ && occ.length > 1) {
    return occ.map((iso) => formatContinuousFestivalRangeBg(iso, iso)).join(" · ");
  }
  if (occ?.length === 1) {
    return formatContinuousFestivalRangeBg(occ[0], occ[0]) + festivalClockSuffix(festival, true);
  }
  if (!festival.start_date?.trim()) return "Дата предстои";
  return formatContinuousFestivalRangeBg(festival.start_date, festival.end_date) + festivalClockSuffix(festival, true);
}
