import type { FestivalDay, FestivalScheduleItem } from "@/lib/types";
import { parseHmInputToDbTime } from "@/lib/festival/festivalTimeFields";
import { getDateAtHmsInTimeZone, TZ } from "@/lib/notifications/time";

/** IANA zone used for interpreting `starts_at` / `ends_at` (wall clock + calendar day). */
export const MOBILE_FESTIVAL_SCHEDULE_TIMEZONE = TZ;

export type MobileScheduleItemDto = {
  id: string;
  day_id: string;
  title: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  all_day: boolean;
  venue: string | null;
  category: string | null;
  tags: string[];
  organizer_name: string | null;
  image_url: string | null;
  is_cancelled: boolean;
  sort_index: number;
};

export type MobileScheduleDayDto = {
  id: string;
  date: string;
  title: string | null;
  items: MobileScheduleItemDto[];
};

export type MobileFestivalScheduleDto = {
  timezone: string | null;
  days: MobileScheduleDayDto[];
};

const NULL_SORT_ORDER_SENTINEL = 9_000_000;

function isoDateOnly(raw: string): string {
  return String(raw).trim().slice(0, 10);
}

function compareItems(a: FestivalScheduleItem, b: FestivalScheduleItem): number {
  const sa = typeof a.sort_order === "number" && Number.isFinite(a.sort_order) ? a.sort_order : null;
  const sb = typeof b.sort_order === "number" && Number.isFinite(b.sort_order) ? b.sort_order : null;
  const va = sa ?? NULL_SORT_ORDER_SENTINEL;
  const vb = sb ?? NULL_SORT_ORDER_SENTINEL;
  if (va !== vb) return va - vb;
  const t = (a.start_time ?? "").localeCompare(b.start_time ?? "");
  if (t !== 0) return t;
  const idc = String(a.id).localeCompare(String(b.id));
  if (idc !== 0) return idc;
  return a.title.localeCompare(b.title);
}

/**
 * Interprets Postgres `time` (or HH:mm) on `ymd` in {@link MOBILE_FESTIVAL_SCHEDULE_TIMEZONE} and returns an ISO-8601 UTC instant.
 */
function wallClockToIsoInstant(ymd: string, raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== "string") return null;
  const norm = parseHmInputToDbTime(raw.trim());
  if (!norm) return null;
  const m = norm.match(/^(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  const ss = Number(m[3]);
  const day = isoDateOnly(ymd);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const anchor = new Date(`${day}T12:00:00`);
  const inst = getDateAtHmsInTimeZone(anchor, TZ, hh, mm, ss);
  return inst ? inst.toISOString() : null;
}

function trimOrNull(s: string | null | undefined): string | null {
  if (s == null || typeof s !== "string") return null;
  const t = s.trim();
  return t.length ? t : null;
}

function toItemDto(
  it: FestivalScheduleItem,
  dayYmd: string,
  sort_index: number,
): MobileScheduleItemDto {
  const starts_at = wallClockToIsoInstant(dayYmd, it.start_time ?? null);
  const ends_at = wallClockToIsoInstant(dayYmd, it.end_time ?? null);
  const all_day = starts_at == null && ends_at == null;
  return {
    id: String(it.id),
    day_id: String(it.day_id),
    title: it.title,
    description: trimOrNull(it.description ?? null),
    starts_at,
    ends_at,
    all_day,
    venue: trimOrNull(it.stage ?? null),
    category: null,
    tags: [],
    organizer_name: null,
    image_url: null,
    is_cancelled: false,
    sort_index,
  };
}

/**
 * Canonical mobile schedule: days ordered by `days` input (caller: ascending `festival_days.date`),
 * items ordered deterministically per day (`sort_order`, then `start_time`, then `id`, then `title`).
 */
export function buildMobileFestivalScheduleDto(
  days: FestivalDay[],
  scheduleItems: FestivalScheduleItem[],
): MobileFestivalScheduleDto {
  const byDay = new Map<string, FestivalScheduleItem[]>();
  for (const it of scheduleItems) {
    const k = String(it.day_id);
    let bucket = byDay.get(k);
    if (!bucket) {
      bucket = [];
      byDay.set(k, bucket);
    }
    bucket.push(it);
  }
  for (const bucket of byDay.values()) {
    bucket.sort(compareItems);
  }

  const outDays: MobileScheduleDayDto[] = days.map((d) => {
    const ymd = isoDateOnly(String(d.date));
    const itemsRaw = byDay.get(String(d.id)) ?? [];
    const items = itemsRaw.map((it, idx) => toItemDto(it, ymd, idx));
    return {
      id: String(d.id),
      date: ymd,
      title: trimOrNull(d.title ?? null),
      items,
    };
  });

  return {
    timezone: MOBILE_FESTIVAL_SCHEDULE_TIMEZONE,
    days: outDays,
  };
}
