import { format, parseISO } from "date-fns";
import { bg } from "date-fns/locale";
import { normalizeOccurrenceDatesInput } from "@/lib/festival/occurrenceDates";

/** Minimal fields for date display (published festival, admin row, etc.). */
export type FestivalDateFields = {
  start_date?: string | null;
  end_date?: string | null;
  occurrence_dates?: unknown;
};

/** First calendar day for badges / sorting (discrete list or start_date). */
export function primaryFestivalDate(festival: FestivalDateFields): string | null {
  const occ = normalizeOccurrenceDatesInput(festival.occurrence_dates);
  if (occ?.length) return occ[0] ?? null;
  return festival.start_date ?? null;
}

function formatRangeLine(start?: string | null, end?: string | null): string {
  if (!start) return "Dates TBA";
  const startDate = parseISO(start);
  if (!end || end === start) {
    return format(startDate, "d MMM yyyy");
  }
  return `${format(startDate, "d MMM")} - ${format(parseISO(end), "d MMM yyyy")}`;
}

/** Short line for cards (Latin month like existing grid). */
export function formatFestivalDateLineShort(festival: FestivalDateFields): string {
  const occ = normalizeOccurrenceDatesInput(festival.occurrence_dates);
  if (occ && occ.length > 1) {
    return occ.map((iso) => format(parseISO(iso), "d MMM yyyy")).join(" · ");
  }
  if (occ?.length === 1) {
    return format(parseISO(occ[0]), "d MMM yyyy");
  }
  return formatRangeLine(festival.start_date, festival.end_date);
}

/** Detail hero: Bulgarian long month names. */
export function formatFestivalDateLineLongBg(festival: FestivalDateFields): string {
  const occ = normalizeOccurrenceDatesInput(festival.occurrence_dates);
  const one = (iso: string) => format(parseISO(iso), "d MMMM yyyy", { locale: bg });
  if (occ && occ.length > 1) {
    return occ.map(one).join(" · ");
  }
  if (occ?.length === 1) {
    return one(occ[0]);
  }
  const start = festival.start_date;
  if (!start) return "Дата предстои";
  const startDate = parseISO(start);
  const end = festival.end_date;
  if (!end || end === start) {
    return format(startDate, "d MMMM yyyy", { locale: bg });
  }
  return `${format(startDate, "d MMMM", { locale: bg })} – ${format(parseISO(end), "d MMMM yyyy", { locale: bg })}`;
}
