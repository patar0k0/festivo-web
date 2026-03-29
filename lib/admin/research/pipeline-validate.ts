import type { ResearchFestivalResult } from "@/lib/admin/research/types";
import { normalizeFestivalTimePair, parseHmInputToDbTime } from "@/lib/festival/festivalTimeFields";

const TITLE_MIN = 2;
const TITLE_MAX = 220;
const CITY_MAX = 80;

function isValidIsoDate(s: string | null | undefined): boolean {
  if (!s || typeof s !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime());
}

/** Deterministic validation + garbage rejection. Returns warnings; may clear fields in-place via returned patch. */
export function validatePipelineResult(result: ResearchFestivalResult): { warnings: string[]; rejected: boolean } {
  const warnings: string[] = [...(result.warnings ?? [])];
  const bg = result.best_guess;

  let rejected = false;

  const title = bg.title?.trim() ?? "";
  if (title && (title.length < TITLE_MIN || title.length > TITLE_MAX)) {
    warnings.push(`title length out of range (${TITLE_MIN}–${TITLE_MAX}); cleared`);
    bg.title = null;
    rejected = true;
  }

  const city = bg.city?.trim() ?? "";
  if (city && city.length > CITY_MAX) {
    warnings.push("city string too long; cleared");
    bg.city = null;
  }

  const sd = bg.start_date;
  const ed = bg.end_date;

  if (sd && !isValidIsoDate(sd)) {
    warnings.push("start_date invalid; cleared");
    bg.start_date = null;
  }
  if (ed && !isValidIsoDate(ed)) {
    warnings.push("end_date invalid; cleared");
    bg.end_date = null;
  }

  if (bg.start_date && bg.end_date && bg.end_date < bg.start_date) {
    warnings.push("end_date before start_date; dates cleared");
    bg.start_date = null;
    bg.end_date = null;
    rejected = true;
  }

  const timePair = normalizeFestivalTimePair(
    parseHmInputToDbTime((bg as { start_time?: unknown }).start_time),
    parseHmInputToDbTime((bg as { end_time?: unknown }).end_time),
  );
  (bg as { start_time?: string | null }).start_time = timePair.start_time;
  (bg as { end_time?: string | null }).end_time = timePair.end_time;

  if (!bg.title && !bg.start_date && !bg.city) {
    warnings.push("Result sparse after validation (no title, dates, or city)");
    rejected = true;
  }

  return { warnings, rejected };
}
