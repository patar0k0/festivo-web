// Deterministic festival-year resolution. LLMs are unreliable at day-of-week
// arithmetic, so the vision model returns date components + an optional printed
// weekday, and the YEAR is computed here against a real calendar.

const BG_WEEKDAYS = {
  "неделя": 0,
  "понеделник": 1,
  "вторник": 2,
  "сряда": 3,
  "четвъртък": 4,
  "петък": 5,
  "събота": 6,
};

export function bgWeekdayToIndex(weekday) {
  if (typeof weekday !== "string") return null;
  const key = weekday.trim().toLowerCase().replace(/\.$/, "");
  return key in BG_WEEKDAYS ? BG_WEEKDAYS[key] : null;
}

function utcDate(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day));
}

function isRealDate(year, month, day) {
  const d = utcDate(year, month, day);
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

/**
 * @param {{day:number, month:number, weekday?:string|null, explicitYear?:number|null, today?:Date}} input
 * @returns {{year:number, inferred:boolean, weekdayMatched:boolean}}
 */
export function resolveEventYear(input) {
  const { day, month } = input;
  const today = input.today instanceof Date ? input.today : new Date();
  const todayUtc = utcDate(today.getUTCFullYear(), today.getUTCMonth() + 1, today.getUTCDate());

  if (typeof input.explicitYear === "number" && Number.isFinite(input.explicitYear)) {
    return { year: input.explicitYear, inferred: false, weekdayMatched: false };
  }

  const wantWeekday = bgWeekdayToIndex(input.weekday ?? null);
  const baseYear = today.getUTCFullYear();
  // Search a small window around now.
  const years = [];
  for (let y = baseYear - 1; y <= baseYear + 5; y += 1) years.push(y);

  const valid = years.filter((y) => isRealDate(y, month, day));

  if (wantWeekday !== null) {
    const matching = valid.filter((y) => utcDate(y, month, day).getUTCDay() === wantWeekday);
    const future = matching.filter((y) => utcDate(y, month, day) >= todayUtc);
    if (future.length > 0) return { year: future[0], inferred: true, weekdayMatched: true };
    if (matching.length > 0) return { year: matching[matching.length - 1], inferred: true, weekdayMatched: true };
    // Printed weekday matched no nearby year → fall through, flag mismatch.
  }

  const future = valid.filter((y) => utcDate(y, month, day) >= todayUtc);
  const year = future.length > 0 ? future[0] : baseYear;
  return { year, inferred: true, weekdayMatched: false };
}
