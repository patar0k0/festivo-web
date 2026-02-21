import { addDays, format, parseISO } from "date-fns";
import { Festival } from "@/lib/types";
import { getBaseUrl } from "@/lib/seo";

export function buildFestivalIcs(festival: Festival) {
  const start = festival.start_date ? parseISO(festival.start_date) : new Date();
  const end = festival.end_date ? parseISO(festival.end_date) : start;
  const endExclusive = addDays(end, 1);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Festivo//Festival Calendar//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:festivo-${festival.slug}`,
    `DTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss'Z'")}`,
    `DTSTART;VALUE=DATE:${format(start, "yyyyMMdd")}`,
    `DTEND;VALUE=DATE:${format(endExclusive, "yyyyMMdd")}`,
    `SUMMARY:${escapeText(festival.title)}`,
    `LOCATION:${escapeText([festival.address, festival.city].filter(Boolean).join(", "))}`,
    `URL:${getBaseUrl()}/festival/${festival.slug}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n");
}

function escapeText(value: string) {
  return value.replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, " ");
}
