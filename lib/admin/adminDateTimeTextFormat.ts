import {
  formatIsoYyyyMmDdToDdMmYyyyDots,
  parseFlexibleDateToIso,
} from "@/lib/dates/euDateFormat";

/** Masks typing to HH:mm (24h);3 digits → 0H:mm, 4 digits → HH:mm. */
export function formatTime(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);

  if (digits.length === 3) {
    return "0" + digits[0] + ":" + digits.slice(1);
  }

  if (digits.length === 4) {
    return digits.slice(0, 2) + ":" + digits.slice(2);
  }

  return digits;
}

/** Pads hours/minutes on blur (e.g. `9:3` → `09:03`). */
export function normalizeTime(v: string) {
  if (!v) return v;
  const [h, m] = v.split(":");
  return `${h.padStart(2, "0")}:${m?.padStart(2, "0") || "00"}`;
}

export const isValidTime = (v: string) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);

/** Masks typing to DD.MM.YYYY with dots (digits only; partial year while typing). */
export function formatDate(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length >= 5) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
  }

  if (digits.length >= 3) {
    return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  }

  return digits;
}

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
