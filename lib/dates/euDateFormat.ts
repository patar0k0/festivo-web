import { format, isValid, parse, parseISO } from "date-fns";

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parse dd/MM/yyyy, d/M/yyyy, dd.MM.yyyy, d.M.yyyy (optional trailing "г."), or yyyy-MM-dd → ISO date.
 * Returns "" for empty input, null if the text cannot be parsed as a calendar date.
 */
export function parseFlexibleDateToIso(input: string): string | null {
  const trimmed = input.trim().replace(/\s*г\.?\s*$/i, "");
  if (!trimmed) return "";

  if (ISO_DATE_RE.test(trimmed)) {
    const d = parseISO(trimmed);
    return isValid(d) ? trimmed : null;
  }

  const patterns = ["dd/MM/yyyy", "d/M/yyyy", "dd.MM.yyyy", "d.M.yyyy"] as const;
  for (const fmt of patterns) {
    const d = parse(trimmed, fmt, new Date());
    if (isValid(d)) {
      return format(d, "yyyy-MM-dd");
    }
  }

  return null;
}

/**
 * Show dd/MM/yyyy for form fields. Accepts ISO yyyy-MM-dd or other strings parseable by {@link parseFlexibleDateToIso}.
 */
export function formatDateValueAsDdMmYyyy(value: string): string {
  if (!value?.trim()) return "";
  const trimmed = value.trim();
  if (ISO_DATE_RE.test(trimmed)) {
    const d = parseISO(trimmed);
    return isValid(d) ? format(d, "dd/MM/yyyy") : "";
  }
  const iso = parseFlexibleDateToIso(trimmed);
  if (!iso) return "";
  const d = parseISO(iso);
  return isValid(d) ? format(d, "dd/MM/yyyy") : "";
}
