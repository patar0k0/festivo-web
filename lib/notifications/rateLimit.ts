import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationJobType } from "./types";

export type UserNotificationRates24h = {
  totalSent: number;
  promoSent: number;
};

const WINDOW_MS = 24 * 60 * 60 * 1000;

/** Counts sent notification_logs in last 24h; promo = weekend + new_city jobs. */
export async function getUserNotificationRates24h(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserNotificationRates24h> {
  const m = await getUsersNotificationRates24hBatch(supabase, [userId]);
  return m.get(userId) ?? { totalSent: 0, promoSent: 0 };
}

/** Batch: returns map userId -> rates (defaults zeros). */
export async function getUsersNotificationRates24hBatch(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, UserNotificationRates24h>> {
  const map = new Map<string, UserNotificationRates24h>();
  for (const id of userIds) {
    map.set(id, { totalSent: 0, promoSent: 0 });
  }
  if (!userIds.length) {
    return map;
  }

  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { data: logs, error } = await supabase
    .from("notification_logs")
    .select("user_id, job_id")
    .in("user_id", userIds)
    .eq("status", "sent")
    .gte("created_at", since);

  if (error || !logs?.length) {
    return map;
  }

  const jobIds = [...new Set(logs.map((l: { job_id: string }) => l.job_id).filter(Boolean))];
  const jobTypeById = new Map<string, string>();

  if (jobIds.length) {
    const { data: jobs, error: jErr } = await supabase.from("notification_jobs").select("id, job_type").in("id", jobIds);

    if (!jErr && jobs) {
      for (const j of jobs as { id: string; job_type: string }[]) {
        jobTypeById.set(j.id, j.job_type);
      }
    }
  }

  const totals = new Map<string, number>();
  const promos = new Map<string, number>();

  for (const row of logs as { user_id: string; job_id: string }[]) {
    const uid = row.user_id;
    totals.set(uid, (totals.get(uid) ?? 0) + 1);
    const jt = jobTypeById.get(row.job_id);
    if (jt === "weekend" || jt === "new_city") {
      promos.set(uid, (promos.get(uid) ?? 0) + 1);
    }
  }

  for (const id of userIds) {
    map.set(id, {
      totalSent: totals.get(id) ?? 0,
      promoSent: promos.get(id) ?? 0,
    });
  }

  return map;
}

/** Reminders are exempt. Promo (weekend, new_city) also capped at 1 per 24h. */
export function shouldSkipScheduleForRateLimit(
  jobType: NotificationJobType,
  rates: UserNotificationRates24h,
): boolean {
  if (jobType === "reminder") {
    return false;
  }
  if (rates.totalSent >= 2) {
    return true;
  }
  if ((jobType === "weekend" || jobType === "new_city") && rates.promoSent >= 1) {
    return true;
  }
  return false;
}
