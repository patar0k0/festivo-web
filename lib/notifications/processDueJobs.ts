import type { SupabaseClient } from "@supabase/supabase-js";

import {
  enqueueSavedFestivalReminderEmailFromJob,
  loadFestivalsForReminderEmails,
  type SavedFestivalReminderEmailEnqueueResult,
} from "@/lib/email/enqueueSavedFestivalReminderEmail";
import { loadEmailPreferencesMapForReminderUsers } from "@/lib/email/emailPreferences";
import { PUSH_SEND_MAX_RETRIES } from "@/lib/push/constants";
import { sendPushToUser, type PushSendResult } from "@/lib/push/sendPush";

import { notificationTypeForJob } from "./notificationTypes";
import type { NotificationJobRow, NotificationPayloadV1 } from "./types";
import { isInQuietHours, nextAllowedSendAfterQuietHours, nowSofia } from "./time";

const MAX_RETRIES = PUSH_SEND_MAX_RETRIES;
const BACKOFF_MS = [5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000];
const DEFAULT_QUIET_HOURS_START = "22:00";
const DEFAULT_QUIET_HOURS_END = "09:00";
const AUDIT_BATCH_SIZE = 500;

function reminderCancelledLastErrorForEmailSkip(
  result: SavedFestivalReminderEmailEnqueueResult,
): string {
  if (result.status === "enqueued") return "reminder_no_active_channel";
  if (result.reason === "preference_disabled") return "reminder_email_preference_disabled";
  if (result.reason === "preference_lookup_failed") return "reminder_email_preference_lookup_failed";
  return "reminder_no_active_channel";
}

function jobRetryCount(job: NotificationJobRow & { attempts?: number }): number {
  return job.retry_count ?? job.attempts ?? 0;
}

function backoffMsForRetry(retryCountAfterFailure: number): number {
  const idx = Math.min(Math.max(retryCountAfterFailure - 1, 0), BACKOFF_MS.length - 1);
  return BACKOFF_MS[idx];
}

async function retryJobOrFail(
  supabase: SupabaseClient,
  job: NotificationJobRow & { attempts?: number },
  nowIso: string,
  lastError: string,
): Promise<void> {
  const rc = jobRetryCount(job) + 1;
  const giveUp = rc > MAX_RETRIES;
  const { error } = await supabase
    .from("notification_jobs")
    .update({
      status: giveUp ? "failed" : "pending",
      last_error: lastError.slice(0, 800),
      retry_count: rc,
      scheduled_for: giveUp
        ? job.scheduled_for
        : new Date(Date.now() + backoffMsForRetry(rc)).toISOString(),
      updated_at: nowIso,
    })
    .eq("id", job.id);

  if (error) {
    console.error("[notifications] retry update failed", { job_id: job.id, message: error.message });
    throw new Error(error.message);
  }
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
  const nowIso = new Date().toISOString();
  const now = nowSofia().getTime();
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

  /** Recompute from payload so priority does not drift between enqueue and send. */
  function computePriority(
    startAt: unknown,
    job: NotificationJobRow & { attempts?: number },
  ): "high" | "normal" {
    if (startAt && typeof startAt === "string") {
      const start = new Date(startAt).getTime();
      if (!Number.isNaN(start)) {
        const days = (start - now) / (1000 * 60 * 60 * 24);
        return days <= 2 ? "high" : "normal";
      }
    }
    if (!startAt) {
      const scheduled = new Date(job.scheduled_for);
      if (Number.isNaN(scheduled.getTime())) return "normal";
      const diff = scheduled.getTime() - now;
      if (diff <= 0) return "normal";
      if (diff <= 24 * 60 * 60 * 1000) return "high";
      return "normal";
    }
    return "normal";
  }

  function priorityRank(p: "high" | "normal"): number {
    return p === "high" ? 1 : 0;
  }

  const rows = ((jobs ?? []) as (NotificationJobRow & { attempts?: number })[])
    .slice()
    .sort((a, b) => {
      const pj = a.payload_json as Record<string, unknown>;
      const pk = b.payload_json as Record<string, unknown>;
      const pa = computePriority(pj?.reminder_festival_start_at, a);
      const pb = computePriority(pk?.reminder_festival_start_at, b);
      const pr = priorityRank(pb) - priorityRank(pa);
      if (pr !== 0) return pr;
      return new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime();
    });

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
  const auditRows: Array<{
    notification_job_id: string;
    notification_type: string;
    user_id: string;
    device_token: string | null;
    device_platform: string | null;
    payload_summary: string;
    deep_link: string | null;
    send_status: "sent" | "failed" | "skipped";
    provider_name: string | null;
    provider_response: Record<string, unknown>;
    created_at: string;
  }> = [];

  const flushAuditRows = async () => {
    if (!auditRows.length) return;
    for (let i = 0; i < auditRows.length; i += AUDIT_BATCH_SIZE) {
      const chunk = auditRows.slice(i, i + AUDIT_BATCH_SIZE);
      const { error: auditErr } = await supabase.from("push_delivery_audit").insert(chunk);
      if (auditErr) {
        console.warn("[notifications] push audit insert failed", { message: auditErr.message, rows: chunk.length });
      }
    }
    auditRows.length = 0;
  };

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
    const quietStart = qh?.quiet_hours_start ?? DEFAULT_QUIET_HOURS_START;
    const quietEnd = qh?.quiet_hours_end ?? DEFAULT_QUIET_HOURS_END;
    const now = new Date();
    if (isInQuietHours(now, quietStart, quietEnd)) {
      if (job.job_type === "reminder") {
        // Saved festival reminders are higher-priority and bypass quiet-hours suppression.
      } else {
        const nextIso = nextAllowedSendAfterQuietHours(now, quietStart, quietEnd).toISOString();
        await supabase.from("notification_jobs").update({ scheduled_for: nextIso, updated_at: nowIso }).eq("id", job.id);
        rescheduled += 1;
        continue;
      }
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
     * Runs before push; never rolled back by push.
     */
    let reminderEmailResult: SavedFestivalReminderEmailEnqueueResult = { status: "skipped", reason: "other" };
    if (job.job_type === "reminder") {
      reminderEmailResult = await enqueueSavedFestivalReminderEmailFromJob(
        supabase,
        job,
        festivalById,
        emailPrefsMap.get(job.user_id) ?? { ok: false },
      );
    }
    const reminderEmailEnqueued = reminderEmailResult.status === "enqueued";

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
            last_error: reminderCancelledLastErrorForEmailSkip(reminderEmailResult),
          })
          .eq("id", job.id);
        skipped += 1;
      }
      continue;
    }

    const payloadForSend: NotificationPayloadV1 = { ...payload, notification_id: job.id };
    const notifType = notificationTypeForJob(job.job_type, job.payload_json as Record<string, unknown>);
    const priorityVal = (job as { priority?: string }).priority ?? (payload.priority as string | undefined) ?? "normal";

    let pushResult: PushSendResult;
    try {
      pushResult = await sendPushToUser(supabase, job.user_id, payloadForSend, { pushEnabled: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[push][failed]", { userId: job.user_id, job_id: job.id, message });
      pushResult = { ok: false, skipped: false, raw: { thrown: message } };
    }

    if (pushResult.error) {
      await retryJobOrFail(supabase, job, nowIso, pushResult.error);
      auditRows.push({
        notification_job_id: job.id,
        notification_type: notifType,
        user_id: job.user_id,
        device_token: null,
        device_platform: null,
        payload_summary: `${payload.title} — ${payload.body}`.slice(0, 300),
        deep_link: payload.deep_link ?? null,
        send_status: "failed",
        provider_name: (process.env.PUSH_PROVIDER || "fcm").toLowerCase(),
        provider_response: { error: pushResult.error },
        created_at: nowIso,
      });
      failed += 1;
      continue;
    }

    const durationMs = pushResult.duration_ms ?? 0;

    /** Reminder with email in queue: complete job regardless of push outcome (push is optional). */
    if (job.job_type === "reminder" && reminderEmailEnqueued) {
      if (pushResult.ok) {
        await supabase
          .from("notification_jobs")
          .update({ status: "sent", updated_at: nowIso, last_error: null, retry_count: 0 })
          .eq("id", job.id);
        await supabase.from("notification_logs").insert({
          job_id: job.id,
          user_id: job.user_id,
          status: "sent",
          response: (pushResult.raw ?? {}) as object,
          duration_ms: durationMs,
          priority: priorityVal,
          notification_type: notifType,
        });

        const { error: unErr } = await supabase.from("user_notifications").upsert(
          {
            user_id: job.user_id,
            festival_id: festivalId,
            type: notifType,
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
      } else {
        await supabase
          .from("notification_jobs")
          .update({ status: "sent", updated_at: nowIso, last_error: null, retry_count: 0 })
          .eq("id", job.id);
      }
      sent += 1;
      continue;
    }

    if (pushResult.skipped && pushResult.reason === "no_tokens") {
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
      auditRows.push({
        notification_job_id: job.id,
        notification_type: notifType,
        user_id: job.user_id,
        device_token: null,
        device_platform: null,
        payload_summary: `${payload.title} — ${payload.body}`.slice(0, 300),
        deep_link: payload.deep_link ?? null,
        send_status: "skipped",
        provider_name: (process.env.PUSH_PROVIDER || "fcm").toLowerCase(),
        provider_response: { reason: "no_tokens" },
        created_at: nowIso,
      });
      failed += 1;
      continue;
    }

    if (!pushResult.ok) {
      const rc = jobRetryCount(job) + 1;
      const giveUp = rc > MAX_RETRIES;
      const nextScheduled = giveUp ? job.scheduled_for : new Date(Date.now() + backoffMsForRetry(rc)).toISOString();
      const lastError =
        typeof pushResult.raw !== "undefined"
          ? JSON.stringify(pushResult.raw).slice(0, 800)
          : (pushResult.reason ?? "push_failed").slice(0, 800);

      await supabase
        .from("notification_jobs")
        .update({
          status: giveUp ? "failed" : "pending",
          retry_count: rc,
          last_error: lastError,
          scheduled_for: nextScheduled,
          updated_at: nowIso,
        })
        .eq("id", job.id);
      await supabase.from("notification_logs").insert({
        job_id: job.id,
        user_id: job.user_id,
        status: "failed",
        response: (pushResult.raw ?? {}) as object,
        duration_ms: durationMs,
        priority: priorityVal,
        notification_type: notifType,
      });
      for (const token of pushResult.tokens ?? []) {
        auditRows.push({
          notification_job_id: job.id,
          notification_type: notifType,
          user_id: job.user_id,
          device_token: token,
          device_platform: null,
          payload_summary: `${payload.title} — ${payload.body}`.slice(0, 300),
          deep_link: payload.deep_link ?? null,
          send_status: "failed",
          provider_name: (process.env.PUSH_PROVIDER || "fcm").toLowerCase(),
          provider_response: (pushResult.raw ?? {}) as Record<string, unknown>,
          created_at: nowIso,
        });
      }
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
      response: (pushResult.raw ?? {}) as object,
      duration_ms: durationMs,
      priority: priorityVal,
      notification_type: notifType,
    });

    const { error: unErr } = await supabase.from("user_notifications").upsert(
      {
        user_id: job.user_id,
        festival_id: festivalId,
        type: notifType,
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
    const tokensForAudit = pushResult.tokens?.length ? pushResult.tokens : [null];
    for (const token of tokensForAudit) {
      auditRows.push({
        notification_job_id: job.id,
        notification_type: notifType,
        user_id: job.user_id,
        device_token: token,
        device_platform: null,
        payload_summary: `${payload.title} — ${payload.body}`.slice(0, 300),
        deep_link: payload.deep_link ?? null,
        send_status: "sent",
        provider_name: (process.env.PUSH_PROVIDER || "fcm").toLowerCase(),
        provider_response: (pushResult.raw ?? {}) as Record<string, unknown>,
        created_at: nowIso,
      });
    }

    sent += 1;
    if (auditRows.length >= AUDIT_BATCH_SIZE) {
      await flushAuditRows();
    }
  }

  await flushAuditRows();

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
