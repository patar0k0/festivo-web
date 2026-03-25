import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationJobType, NotificationPayloadV1, ReminderSubkind } from "./types";
import { getFestivalStartInstant } from "./time";

export function buildDeepLink(slug: string): string {
  const s = slug.trim();
  return `festivo://festival/${encodeURIComponent(s)}`;
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
  return {
    type: "festival_reminder",
    festival_id: args.festivalId,
    slug: args.slug.trim(),
    deep_link: deep,
    title: args.title,
    body: is24 ? "Фестивалът започва след 24 часа." : "Фестивалът започва след 2 часа.",
  };
}

export function buildUpdatePayload(args: { slug: string; festivalId: string; title: string; summary: string }): NotificationPayloadV1 {
  return {
    type: "festival_updated",
    festival_id: args.festivalId,
    slug: args.slug.trim(),
    deep_link: buildDeepLink(args.slug),
    title: args.title,
    body: args.summary,
  };
}

export function buildWeekendPayload(args: {
  slug: string;
  festivalId: string;
  title: string;
  body: string;
}): NotificationPayloadV1 {
  return {
    type: "weekend_nearby",
    festival_id: args.festivalId,
    slug: args.slug.trim(),
    deep_link: buildDeepLink(args.slug),
    title: args.title,
    body: args.body,
  };
}

export function buildNewInCityPayload(args: { slug: string; festivalId: string; title: string; cityLabel: string }): NotificationPayloadV1 {
  return {
    type: "new_festival_in_city",
    festival_id: args.festivalId,
    slug: args.slug.trim(),
    deep_link: buildDeepLink(args.slug),
    title: "Нов фестивал",
    body: `${args.title} в ${args.cityLabel}`,
  };
}

export type InsertJob = {
  user_id: string;
  festival_id: string | null;
  job_type: NotificationJobType;
  scheduled_for: string;
  dedupe_key: string;
  payload_json: NotificationPayloadV1 & Record<string, unknown>;
};

export function makeDedupeKey(parts: string[]): string {
  return parts.map((p) => p.replaceAll("|", "_")).join("|");
}

export async function insertNotificationJobs(
  supabase: SupabaseClient,
  rows: InsertJob[],
): Promise<{ inserted: number; error: string | null }> {
  if (!rows.length) {
    return { inserted: 0, error: null };
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("notification_jobs")
    .upsert(
      rows.map((r) => ({
        ...r,
        status: "pending",
        updated_at: now,
      })),
      {
        onConflict: "dedupe_key",
        ignoreDuplicates: true,
      },
    )
    .select("id");

  if (error) {
    return { inserted: 0, error: error.message };
  }

  return { inserted: data?.length ?? 0, error: null };
}

/** Reminder times: 24h and 2h before festival start; skips past. */
export function computeSavedFestivalReminderTimes(startDate: string | null, now: Date): { subkind: ReminderSubkind; scheduled_for: Date }[] {
  const start = getFestivalStartInstant(startDate);
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
