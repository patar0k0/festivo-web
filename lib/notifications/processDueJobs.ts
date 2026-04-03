import type { SupabaseClient } from "@supabase/supabase-js";

import {
  enqueueSavedFestivalReminderEmailFromJob,
  loadFestivalsForReminderEmails,
} from "@/lib/email/enqueueSavedFestivalReminderEmail";
import { loadEmailPreferencesMapForReminderUsers } from "@/lib/email/emailPreferences";

import { getFcmServerKey, invalidateDeadTokens, MAX_RETRIES, sendFcmToTokens } from "./send";
import { notificationTypeForJob } from "./notificationTypes";
import type { NotificationJobRow, NotificationPayloadV1 } from "./types";
import { isInQuietHours, nextAllowedSendAfterQuietHours } from "./time";

const BACKOFF_MS = [5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000];

function jobRetryCount(job: NotificationJobRow & { attempts?: number }): number {
  return job.retry_count ?? job.attempts ?? 0;
}

function backoffMsForRetry(retryCountAfterFailure: number): number {
  const idx = Math.min(Math.max(retryCountAfterFailure - 1, 0), BACKOFF_MS.length - 1);
  return BACKOFF_MS[idx];
}

export async function processDueNotificationJobs(
  supabase: SupabaseClient,
  limit = 75,
): Promise<{
  processed: number;
  sent: number;
  failed: number;
  rescheduled: number;
  skipped: number;
  skippedQuiet: number;
}> {
  const fcmKey = getFcmServerKey();
  if (!fcmKey) {
    console.warn("[notifications] FCM_SERVER_KEY missing; skip send");
    return { processed: 0, sent: 0, failed: 0, rescheduled: 0, skipped: 0, skippedQuiet: 0 };
  }

  const nowIso = new Date().toISOString();
  const { data: jobs, error } = await supabase
    .from("notification_jobs")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", nowIso)
    .order("priority", { ascending: true })
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (jobs ?? []) as (NotificationJobRow & { attempts?: number })[];

  const reminderFestivalIds: string[] = [];
  for (const j of rows) {
    if (j.job_type !== "reminder") continue;
    const pj = j.payload_json as Record<string, unknown>;
    const fid = (typeof pj.festival_id === "string" ? pj.festival_id : null) ?? j.festival_id;
    if (fid) reminderFestivalIds.push(fid);
  }
  const festivalById = await loadFestivalsForReminderEmails(supabase, reminderFestivalIds);

  const reminderUserIds = [...new Set(rows.filter((j) => j.job_type === "reminder").map((j) => j.user_id))];
  const emailPrefsMap = await loadEmailPreferencesMapForReminderUsers(supabase, reminderUserIds);

  let sent = 0;
  let failed = 0;
  let rescheduled = 0;
  let skipped = 0;
  let skippedQuiet = 0;

  for (const job of rows) {
    const { data: settings } = await supabase
      .from("user_notification_settings")
      .select("push_enabled,quiet_hours_start,quiet_hours_end")
      .eq("user_id", job.user_id)
      .maybeSingle();

    const pushEnabled = (settings as { push_enabled?: boolean } | null)?.push_enabled ?? true;
    if (!pushEnabled && job.job_type !== "reminder") {
      await supabase
        .from("notification_jobs")
        .update({ status: "cancelled", updated_at: nowIso, last_error: "push_disabled" })
        .eq("id", job.id);
      skipped += 1;
      continue;
    }

    const qh = settings as { quiet_hours_start?: string | null; quiet_hours_end?: string | null } | null;
    const now = new Date();
    if (isInQuietHours(now, qh?.quiet_hours_start, qh?.quiet_hours_end)) {
      if (job.job_type === "reminder") {
        await supabase
          .from("notification_jobs")
          .update({
            status: "cancelled",
            updated_at: nowIso,
            last_error: "quiet_hours_skip",
          })
          .eq("id", job.id);
        skippedQuiet += 1;
        continue;
      }

      const nextIso = nextAllowedSendAfterQuietHours(now, qh?.quiet_hours_start, qh?.quiet_hours_end).toISOString();
      await supabase.from("notification_jobs").update({ scheduled_for: nextIso, updated_at: nowIso }).eq("id", job.id);
      rescheduled += 1;
      continue;
    }

    const payload = job.payload_json as NotificationPayloadV1;
    const festivalId = payload.festival_id ?? job.festival_id;
    if (!payload?.title || !payload?.body || !festivalId) {
      await supabase
        .from("notification_jobs")
        .update({ status: "failed", last_error: "invalid_payload", updated_at: nowIso })
        .eq("id", job.id);
      failed += 1;
      continue;
    }

    /**
     * Reminder email (`email_jobs`): optional channel via `user_email_preferences`.
     * Push uses `push_enabled` + tokens; email can succeed when push is off or tokens are missing.
     */
    let reminderEmailEnqueued = false;
    if (job.job_type === "reminder") {
      reminderEmailEnqueued = await enqueueSavedFestivalReminderEmailFromJob(
        supabase,
        job,
        festivalById,
        emailPrefsMap.get(job.user_id),
      );
    }

    if (!pushEnabled && job.job_type === "reminder") {
      if (reminderEmailEnqueued) {
        await supabase
          .from("notification_jobs")
          .update({ status: "sent", updated_at: nowIso, last_error: null, retry_count: 0 })
          .eq("id", job.id);
        sent += 1;
      } else {
        await supabase
          .from("notification_jobs")
          .update({
            status: "cancelled",
            updated_at: nowIso,
            last_error: "reminder_no_active_channel",
          })
          .eq("id", job.id);
        skipped += 1;
      }
      continue;
    }

    const { data: tokenRows, error: tokenErr } = await supabase
      .from("device_tokens")
      .select("token,invalidated_at")
      .eq("user_id", job.user_id);

    if (tokenErr) {
      const rc = jobRetryCount(job) + 1;
      const giveUp = rc > MAX_RETRIES;
      await supabase
        .from("notification_jobs")
        .update({
          status: giveUp ? "failed" : "pending",
          last_error: tokenErr.message,
          retry_count: rc,
          scheduled_for: giveUp ? job.scheduled_for : new Date(Date.now() + backoffMsForRetry(rc)).toISOString(),
          updated_at: nowIso,
        })
        .eq("id", job.id);
      failed += 1;
      continue;
    }

    const tokenList = (tokenRows ?? [])
      .filter((r: { invalidated_at?: string | null }) => !r.invalidated_at)
      .map((r: { token: string }) => r.token.trim())
      .filter(Boolean);

    if (!tokenList.length) {
      if (job.job_type === "reminder" && reminderEmailEnqueued) {
        await supabase
          .from("notification_jobs")
          .update({ status: "sent", updated_at: nowIso, last_error: null, retry_count: 0 })
          .eq("id", job.id);
        sent += 1;
        continue;
      }
      const rc = jobRetryCount(job) + 1;
      const giveUp = rc > MAX_RETRIES;
      await supabase
        .from("notification_jobs")
        .update({
          status: giveUp ? "failed" : "pending",
          last_error: "no_device_tokens",
          retry_count: rc,
          scheduled_for: giveUp ? job.scheduled_for : new Date(Date.now() + backoffMsForRetry(rc)).toISOString(),
          updated_at: nowIso,
        })
        .eq("id", job.id);
      failed += 1;
      continue;
    }

    const t0 = Date.now();
    const payloadForSend = { ...payload, notification_id: job.id };
    const sendResult = await sendFcmToTokens(tokenList, payloadForSend.title, payloadForSend.body, payloadForSend, fcmKey);
    const durationMs = Date.now() - t0;
    await invalidateDeadTokens(supabase, job.user_id, tokenList, sendResult.results);

    const notifType = notificationTypeForJob(job.job_type, job.payload_json as Record<string, unknown>);
    const priorityVal = (job as { priority?: string }).priority ?? (payload.priority as string | undefined) ?? "normal";

    if (!sendResult.ok) {
      const rc = jobRetryCount(job) + 1;
      const giveUp = rc > MAX_RETRIES;
      const nextScheduled = giveUp ? job.scheduled_for : new Date(Date.now() + backoffMsForRetry(rc)).toISOString();
      await supabase
        .from("notification_jobs")
        .update({
          status: giveUp ? "failed" : "pending",
          retry_count: rc,
          last_error: JSON.stringify(sendResult.raw).slice(0, 800),
          scheduled_for: nextScheduled,
          updated_at: nowIso,
        })
        .eq("id", job.id);
      await supabase.from("notification_logs").insert({
        job_id: job.id,
        user_id: job.user_id,
        status: "failed",
        response: sendResult.raw as object,
        duration_ms: durationMs,
        priority: priorityVal,
        notification_type: notifType,
      });
      failed += 1;
      continue;
    }

    await supabase
      .from("notification_jobs")
      .update({ status: "sent", updated_at: nowIso, last_error: null, retry_count: 0 })
      .eq("id", job.id);
    await supabase.from("notification_logs").insert({
      job_id: job.id,
      user_id: job.user_id,
      status: "sent",
      response: sendResult.raw as object,
      duration_ms: durationMs,
      priority: priorityVal,
      notification_type: notifType,
    });

    const notifTypeInbox = notifType;
    const { error: unErr } = await supabase.from("user_notifications").upsert(
      {
        user_id: job.user_id,
        festival_id: festivalId,
        type: notifTypeInbox,
        title: payload.title,
        body: payload.body,
        scheduled_for: job.scheduled_for,
        sent_at: nowIso,
        pushed_at: nowIso,
      },
      { onConflict: "user_id,festival_id,type", ignoreDuplicates: true },
    );

    if (unErr) {
      console.warn("[notifications] user_notifications upsert failed", { job_id: job.id, message: unErr.message });
    }

    sent += 1;
  }

  console.info("[notifications] run", {
    processed: rows.length,
    sent,
    failed,
    rescheduled,
    skipped,
    skippedQuiet,
  });

  return { processed: rows.length, sent, failed, rescheduled, skipped, skippedQuiet };
}
