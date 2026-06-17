export function bgWeekdayToIndex(weekday: string | null | undefined): number | null;
export function resolveEventYear(input: {
  day: number;
  month: number;
  weekday?: string | null;
  explicitYear?: number | null;
  today?: Date;
}): { year: number; inferred: boolean; weekdayMatched: boolean };
