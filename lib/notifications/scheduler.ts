import type { SupabaseClient } from "@supabase/supabase-js";
import { hasRecentWindowDuplicate } from "./dedupe";
import { notificationTypeForJob } from "./notificationTypes";
import { getUsersNotificationRates24hBatch, shouldSkipScheduleForRateLimit } from "./rateLimit";
import type {
  NotificationJobType,
  NotificationPayloadV1,
  NotificationPriority,
  ReminderSubkind,
} from "./types";
import { getFestivalStartInstant } from "./time";

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

export function buildReminderPayload(
  args: {
    slug: string;
    festivalId: string;
    title: string;
    subkind: ReminderSubkind;
  },
): NotificationPayloadV1 {
  const deep = buildDeepLink(args.slug);
  const is24 = args.subkind === "24h";
  const pr = priorityForJobType("reminder");
  return {
    type: "festival_reminder",
    festival_id: args.festivalId,
    slug: args.slug.trim(),
    deep_link: deep,
    title: args.title,
    body: is24 ? "Фестивалът започва след 24 часа." : "Фестивалът започва след 2 часа.",
    source: "push",
    notification_type: is24 ? "saved_festival_reminder_24h" : "saved_festival_reminder_2h",
    priority: pr,
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

      if (await hasRecentWindowDuplicate(supabase, { user_id: row.user_id, festival_id: row.festival_id, job_type: row.job_type })) {
        skippedDedupe += 1;
        continue;
      }

      const priority = row.priority ?? priorityForJobType(row.job_type);
      filtered.push({
        ...row,
        priority,
        payload_json: enrichPayload({ ...row, priority }),
      });
    }
  } else {
    for (const row of rows) {
      const priority = row.priority ?? priorityForJobType(row.job_type);
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

  return { inserted: data?.length ?? 0, error: null, skippedRateLimit, skippedDedupe };
}

/** Reminder times: 24h and 2h before festival start; skips past. */
export function computeSavedFestivalReminderTimes(
  startDate: string | null,
  now: Date,
  startTime?: string | null,
): { subkind: ReminderSubkind; scheduled_for: Date }[] {
  const start = getFestivalStartInstant(startDate, startTime ?? null);
  if (!start) {
    return [];
  }

  if (start <= now) {
    return [];
  }

  const t24 = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  const t2 = new Date(start.getTime() - 2 * 60 * 60 * 1000);
  const out: { subkind: ReminderSubkind; scheduled_for: Date }[] = [];

  if (t24 > now) {
    out.push({ subkind: "24h", scheduled_for: t24 });
  }
  if (t2 > now) {
    out.push({ subkind: "2h", scheduled_for: t2 });
  }

  return out;
}
