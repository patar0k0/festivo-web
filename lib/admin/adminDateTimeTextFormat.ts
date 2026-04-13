import {
  formatIsoYyyyMmDdToDdMmYyyyDots,
  formatTypingMaskEuropeanDots,
  parseFlexibleDateToIso,
} from "@/lib/dates/euDateFormat";

/** Masks typing to HH:mm (24h) with a colon after hours. */
export function formatTime(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return digits.slice(0, 2) + ":" + digits.slice(2);
}

export const isValidTime = (v: string) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);

/** Masks typing to DD.MM.YYYY with dots (re-exported name for admin call sites). */
export const formatDate = formatTypingMaskEuropeanDots;

export { formatIsoYyyyMmDdToDdMmYyyyDots };

export function splitDatetimeLocalValue(v: string | null | undefined): { date: string; time: string } {
  if (!v?.trim()) return { date: "", time: "" };
  const s = v.trim();
  const tIdx = s.indexOf("T");
  if (tIdx === -1) return { date: formatIsoYyyyMmDdToDdMmYyyyDots(s), time: "" };
  const datePart = s.slice(0, tIdx);
  const timePart = s.slice(tIdx + 1);
  const hm = formatTime(timePart.replace(/\D/g, "").slice(0, 4));
  return { date: formatIsoYyyyMmDdToDdMmYyyyDots(datePart), time: hm };
}

/** Builds `YYYY-MM-DDTHH:mm` for API / form state when both parts are valid. */
export function joinLocalDatetime(dateDdMmYyyy: string, timeHm: string): string {
  const iso = parseFlexibleDateToIso(dateDdMmYyyy.trim());
  if (!iso || !isValidTime(timeHm.trim())) return "";
  return `${iso}T${timeHm.trim()}`;
}
