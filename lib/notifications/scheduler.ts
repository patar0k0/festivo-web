import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, subDays, subHours } from "date-fns";
import { hasRecentWindowDuplicate } from "./dedupe";
import { notificationTypeForJob } from "./notificationTypes";
import { getUsersNotificationRates24hBatch, shouldSkipScheduleForRateLimit } from "./rateLimit";
import type {
  NotificationJobType,
  NotificationPayloadV1,
  NotificationPriority,
  ReminderSubkind,
} from "./types";
import { formatDateBg, formatSofiaDate, getDateAtHmsInTimeZone, getFestivalStartInstant, nowSofia, TZ } from "./time";

function getSofiaHour(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  return Number(parts.find((p) => p.type === "hour")?.value ?? "0");
}

/**
 * If wall-clock time in Europe/Sofia is before 08:00 or from 22:00 onward, snap to 09:00
 * on the same or next Sofia calendar day (so sends stay in a civil daytime window).
 * Uses {@link getDateAtHmsInTimeZone} in Europe/Sofia — no `setHours` (server-local).
 */
export function normalizeToDayHours(date: Date): Date {
  const d = new Date(date.getTime());
  const hour = getSofiaHour(d);

  if (hour >= 8 && hour < 22) {
    return d;
  }

  const anchorNoon = getDateAtHmsInTimeZone(d, TZ, 12, 0, 0);
  if (!anchorNoon) {
    console.warn("[TZ ERROR]", date);
    const sofiaDay = formatSofiaDate(date);
    const [y, m, d] = sofiaDay.split("-").map(Number);
    const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return getDateAtHmsInTimeZone(anchor, TZ, 9, 0, 0) ?? date;
  }

  if (hour < 8) {
    const snapped = getDateAtHmsInTimeZone(d, TZ, 9, 0, 0);
    return snapped ?? d;
  }

  if (hour >= 22) {
    const nextAnchor = addDays(anchorNoon, 1);
    const snapped = getDateAtHmsInTimeZone(nextAnchor, TZ, 9, 0, 0);
    return snapped ?? d;
  }

  return d;
}

function reminderPriorityFromFestivalStart(payload: Record<string, unknown>): NotificationPriority | null {
  const raw = payload.reminder_festival_start_at;
  if (typeof raw !== "string") return null;
  const start = new Date(raw);
  if (Number.isNaN(start.getTime())) return null;
  const daysUntilStart = (start.getTime() - nowSofia().getTime()) / (1000 * 60 * 60 * 24);
  return daysUntilStart <= 2 ? "high" : "normal";
}

export function buildDeepLink(slug: string): string {
  const s = slug.trim();
  return `festivo://festival/${encodeURIComponent(s)}`;
}

export function priorityForJobType(jobType: NotificationJobType): NotificationPriority {
  if (jobType === "reminder" || jobType === "update") {
    return "high";
  }
  return "normal";
}

export function buildReminderPayload(args: {
  festival: {
    id: string;
    slug: string;
    title: string | null;
    city: string | null;
  };
  subkind: ReminderSubkind;
  festivalStartAt: Date;
}): NotificationPayloadV1 {
  const title = args.festival.title?.trim() || "Събитие в България";
  const cityLine = (args.festival.city ?? "").trim() || "България";
  const hasCity = cityLine && cityLine !== "България";
  const cityPart = hasCity ? ` • ${cityLine}` : "";
  const festivalStartAt = args.festivalStartAt;
  const is2h = args.subkind === "2h";

  const now = nowSofia().getTime();
  const nowDate = new Date(now);
  const today = formatSofiaDate(nowDate);
  const tomorrow = formatSofiaDate(addDays(nowDate, 1));
  const eventDay = formatSofiaDate(festivalStartAt);

  let body: string;
  if (eventDay === today) {
    const diffMs = festivalStartAt.getTime() - now;
    const diffMin = Math.max(0, Math.round(diffMs / (1000 * 60)));
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    if (h > 0) {
      body = `След ${h} ч${m ? ` ${m} мин` : ""}${cityPart}`;
    } else {
      body = `След ${m} мин${cityPart}`;
    }
  } else if (eventDay === tomorrow) {
    body = `Утре${cityPart}`;
  } else {
    const dateLabel = formatDateBg(eventDay);
    const datePart = dateLabel === "—" ? "" : dateLabel;
    body = `${datePart}${cityPart}`;
  }
  const deep = buildDeepLink(args.festival.slug);
  const pr = priorityForJobType("reminder");
  return {
    type: "festival_reminder",
    festival_id: args.festival.id,
    slug: args.festival.slug.trim(),
    deep_link: deep,
    title,
    body,
    source: "push",
    notification_type: is2h ? "saved_festival_reminder_2h" : "saved_festival_reminder_24h",
    priority: pr,
    reminder_festival_start_at: args.festivalStartAt.toISOString(),
  };
}

export function buildUpdatePayload(args: { slug: string; festivalId: string; title: string; summary: string }): NotificationPayloadV1 {
  const pr = priorityForJobType("update");
  return {
    type: "festival_updated",
    festival_id: args.festivalId,
    slug: args.slug.trim(),
    deep_link: buildDeepLink(args.slug),
    title: args.title,
    body: args.summary,
    source: "push",
    notification_type: "festival_updated",
    priority: pr,
  };
}

export function buildWeekendPayload(args: {
  slug: string;
  festivalId: string;
  title: string;
  body: string;
}): NotificationPayloadV1 {
  const pr = priorityForJobType("weekend");
  return {
    type: "weekend_nearby",
    festival_id: args.festivalId,
    slug: args.slug.trim(),
    deep_link: buildDeepLink(args.slug),
    title: args.title,
    body: args.body,
    source: "push",
    notification_type: "weekend_nearby",
    priority: pr,
  };
}

export function buildNewInCityPayload(args: { slug: string; festivalId: string; title: string; cityLabel: string }): NotificationPayloadV1 {
  const pr = priorityForJobType("new_city");
  return {
    type: "new_festival_in_city",
    festival_id: args.festivalId,
    slug: args.slug.trim(),
    deep_link: buildDeepLink(args.slug),
    title: "Нов фестивал",
    body: `${args.title} в ${args.cityLabel}`,
    source: "push",
    notification_type: "new_festival",
    priority: pr,
  };
}

export function buildFollowedOrganizerPayload(args: {
  slug: string;
  festivalId: string;
  festivalTitle: string;
  organizerName: string;
  organizerId: string;
}): NotificationPayloadV1 {
  const pr = priorityForJobType("followed_organizer");
  return {
    type: "followed_organizer_new_festival",
    festival_id: args.festivalId,
    slug: args.slug.trim(),
    deep_link: buildDeepLink(args.slug),
    title: `Нов фестивал от ${args.organizerName}`,
    body: args.festivalTitle,
    source: "push",
    notification_type: "followed_organizer_new_festival",
    priority: pr,
    organizer_id: args.organizerId,
    scope_key: `organizer:${args.organizerId}`,
  };
}

export function buildTrendingPayload(args: {
  slug: string;
  festivalId: string;
  cityLabel: string | null;
  teaser: string;
}): NotificationPayloadV1 {
  const pr = priorityForJobType("trending");
  const cityPart = args.cityLabel ? ` в ${args.cityLabel}` : "";
  return {
    type: "trending_festival",
    festival_id: args.festivalId,
    slug: args.slug.trim(),
    deep_link: buildDeepLink(args.slug),
    title: `Популярен фестивал${cityPart}`,
    body: args.teaser,
    source: "push",
    notification_type: "trending_festival",
    priority: pr,
  };
}

export type InsertJob = {
  user_id: string;
  festival_id: string | null;
  job_type: NotificationJobType;
  scheduled_for: string;
  dedupe_key: string;
  payload_json: NotificationPayloadV1 & Record<string, unknown>;
  priority?: NotificationPriority;
};

function enrichPayload(row: InsertJob): InsertJob["payload_json"] {
  const pr = row.priority ?? priorityForJobType(row.job_type);
  const nt = notificationTypeForJob(row.job_type, row.payload_json as Record<string, unknown>);
  return {
    ...row.payload_json,
    source: "push",
    notification_type: nt,
    priority: pr,
  };
}

export function makeDedupeKey(parts: string[]): string {
  return parts.map((p) => p.replaceAll("|", "_")).join("|");
}

export async function insertNotificationJobs(
  supabase: SupabaseClient,
  rows: InsertJob[],
  options?: { skipSafetyChecks?: boolean },
): Promise<{
  inserted: number;
  error: string | null;
  skippedRateLimit: number;
  skippedDedupe: number;
}> {
  if (!rows.length) {
    return { inserted: 0, error: null, skippedRateLimit: 0, skippedDedupe: 0 };
  }

  let skippedRateLimit = 0;
  let skippedDedupe = 0;
  const filtered: InsertJob[] = [];

  if (!options?.skipSafetyChecks) {
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const ratesMap = await getUsersNotificationRates24hBatch(supabase, userIds);

    for (const row of rows) {
      const rates = ratesMap.get(row.user_id) ?? { totalSent: 0, promoSent: 0 };
      if (shouldSkipScheduleForRateLimit(row.job_type, rates)) {
        skippedRateLimit += 1;
        continue;
      }

      const scopeKey =
        row.job_type === "followed_organizer"
          ? typeof row.payload_json.scope_key === "string"
            ? row.payload_json.scope_key
            : null
          : null;
      if (
        await hasRecentWindowDuplicate(supabase, {
          user_id: row.user_id,
          festival_id: row.festival_id,
          job_type: row.job_type,
          scope_key: scopeKey,
        })
      ) {
        skippedDedupe += 1;
        continue;
      }

      let priority = row.priority ?? priorityForJobType(row.job_type);
      if (row.job_type === "reminder") {
        const fromStart = reminderPriorityFromFestivalStart(row.payload_json as Record<string, unknown>);
        if (fromStart) {
          priority = fromStart;
        }
      }
      filtered.push({
        ...row,
        priority,
        payload_json: enrichPayload({ ...row, priority }),
      });
    }
  } else {
    for (const row of rows) {
      let priority = row.priority ?? priorityForJobType(row.job_type);
      if (row.job_type === "reminder") {
        const fromStart = reminderPriorityFromFestivalStart(row.payload_json as Record<string, unknown>);
        if (fromStart) {
          priority = fromStart;
        }
      }
      filtered.push({
        ...row,
        priority,
        payload_json: enrichPayload({ ...row, priority }),
      });
    }
  }

  if (!filtered.length) {
    return { inserted: 0, error: null, skippedRateLimit, skippedDedupe };
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("notification_jobs")
    .upsert(
      filtered.map((r) => ({
        user_id: r.user_id,
        festival_id: r.festival_id,
        job_type: r.job_type,
        scheduled_for: r.scheduled_for,
        dedupe_key: r.dedupe_key,
        payload_json: r.payload_json,
        priority: r.priority ?? priorityForJobType(r.job_type),
        status: "pending",
        retry_count: 0,
        updated_at: now,
      })),
      {
        onConflict: "dedupe_key",
        ignoreDuplicates: true,
      },
    )
    .select("id");

  if (error) {
    return { inserted: 0, error: error.message, skippedRateLimit, skippedDedupe };
  }

  const inserted = data?.length ?? 0;
  if (inserted > 0 && data) {
    console.log("[REMINDER INSERT]", { count: data.length });
  }

  return { inserted, error: null, skippedRateLimit, skippedDedupe };
}

/** Reminder times: 24h and 2h before festival start; snaps into 08:00–22:00 Sofia; skips past and times at/after start. */
export function computeSavedFestivalReminderTimes(
  startDate: string | null,
  now: Date,
  startTime?: string | null,
): { subkind: ReminderSubkind; scheduled_for: Date }[] {
  const start = getFestivalStartInstant(startDate, startTime ?? null);
  if (!start || Number.isNaN(start.getTime())) {
    console.warn("[REMINDER INVALID START]", start);
    return [];
  }

  if (start.getTime() <= now.getTime()) {
    return [];
  }

  const t24 = subDays(start, 1);
  const t2 = subHours(start, 2);
  const raw: { subkind: ReminderSubkind; scheduled_for: Date }[] = [];

  if (t24 > now) {
    raw.push({ subkind: "24h", scheduled_for: t24 });
  }
  if (t2 > now) {
    raw.push({ subkind: "2h", scheduled_for: t2 });
  }

  const normalized = raw.map((slot) => ({
    ...slot,
    scheduled_for: normalizeToDayHours(slot.scheduled_for),
  }));

  const uniqueMap = new Map<string, { subkind: ReminderSubkind; scheduled_for: Date }>();
  for (const slot of normalized) {
    const key = slot.scheduled_for.toISOString();

    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, slot);
    } else {
      const existing = uniqueMap.get(key)!;
      if (slot.scheduled_for < existing.scheduled_for) {
        uniqueMap.set(key, slot);
      } else if (
        slot.scheduled_for.getTime() === existing.scheduled_for.getTime() &&
        slot.subkind === "2h"
      ) {
        uniqueMap.set(key, slot);
      }
    }
  }
  let uniqueSlots = Array.from(uniqueMap.values());

  uniqueSlots.sort((a, b) => a.scheduled_for.getTime() - b.scheduled_for.getTime());

  if (uniqueSlots.length > 2) {
    uniqueSlots = uniqueSlots.slice(0, 2);
  }

  return uniqueSlots.filter(
    (s) =>
      s.scheduled_for.getTime() > now.getTime() && s.scheduled_for.getTime() < start.getTime(),
  );
}
