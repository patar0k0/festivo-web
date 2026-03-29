import { addDays, format, parseISO } from "date-fns";
import { festivalCityLabel } from "@/lib/settlements/formatDisplayName";
import { Festival } from "@/lib/types";
import { getBaseUrl } from "@/lib/seo";
import { normalizeOccurrenceDatesInput } from "@/lib/festival/occurrenceDates";
import { getFestivalStartInstant } from "@/lib/notifications/time";

function utcIcsTimestamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function buildFestivalIcs(festival: Festival) {
  const dtstamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");

  const occ = normalizeOccurrenceDatesInput(festival.occurrence_dates);
  const days =
    occ?.length && occ.length > 0
      ? occ
      : festival.start_date
        ? [festival.start_date]
        : [format(new Date(), "yyyy-MM-dd")];

  const useTimedSingleDay =
    Boolean(festival.start_time) && days.length === 1 && Boolean(festival.start_date);

  if (useTimedSingleDay) {
    const startInst = getFestivalStartInstant(festival.start_date!, festival.start_time ?? null);
    if (startInst) {
      const endDay = festival.end_date ?? festival.start_date!;
      const endInst = festival.end_time
        ? getFestivalStartInstant(endDay, festival.end_time)
        : new Date(startInst.getTime() + 2 * 60 * 60 * 1000);
      const end = endInst ?? new Date(startInst.getTime() + 2 * 60 * 60 * 1000);
      return [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Festivo//Festival Calendar//EN",
        "CALSCALE:GREGORIAN",
        [
          "BEGIN:VEVENT",
          `UID:festivo-${festival.slug}-timed`,
          `DTSTAMP:${dtstamp}`,
          `DTSTART:${utcIcsTimestamp(startInst)}`,
          `DTEND:${utcIcsTimestamp(end)}`,
          `SUMMARY:${escapeText(festival.title)}`,
          `LOCATION:${escapeText([festival.address, festivalCityLabel(festival, "")].filter(Boolean).join(", "))}`,
          `URL:${getBaseUrl()}/festivals/${festival.slug}`,
          "END:VEVENT",
        ].join("\r\n"),
        "END:VCALENDAR",
      ].join("\r\n");
    }
  }

  const events = days.map((dayIso) => {
    const start = parseISO(dayIso);
    const endExclusive = addDays(start, 1);
    const uidSuffix = occ && occ.length > 1 ? `-${dayIso.replace(/-/g, "")}` : "";
    return [
      "BEGIN:VEVENT",
      `UID:festivo-${festival.slug}${uidSuffix}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${format(start, "yyyyMMdd")}`,
      `DTEND;VALUE=DATE:${format(endExclusive, "yyyyMMdd")}`,
      `SUMMARY:${escapeText(festival.title)}`,
      `LOCATION:${escapeText([festival.address, festivalCityLabel(festival, "")].filter(Boolean).join(", "))}`,
      `URL:${getBaseUrl()}/festivals/${festival.slug}`,
      "END:VEVENT",
    ].join("\r\n");
  });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Festivo//Festival Calendar//EN",
    "CALSCALE:GREGORIAN",
    events.join("\r\n"),
    "END:VCALENDAR",
  ].join("\r\n");
}

function escapeText(value: string) {
  return value.replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, " ");
}
