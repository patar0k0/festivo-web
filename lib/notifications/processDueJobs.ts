import type { SupabaseClient } from "@supabase/supabase-js";
import { getFcmServerKey, invalidateDeadTokens, MAX_RETRIES, sendFcmToTokens } from "./send";
import type { NotificationJobRow, NotificationPayloadV1 } from "./types";
import { isInQuietHours } from "./time";

function mapJobToNotificationType(job: NotificationJobRow): string {
  if (job.job_type === "reminder") {
    const sub = (job.payload_json as { reminder_subkind?: string }).reminder_subkind;
    return sub === "2h" ? "saved_festival_reminder_2h" : "saved_festival_reminder_24h";
  }
  if (job.job_type === "update") {
    return "festival_updated";
  }
  if (job.job_type === "weekend") {
    return "weekend_nearby";
  }
  if (job.job_type === "new_city") {
    return "new_festival";
  }
  return job.job_type;
}

export async function processDueNotificationJobs(
  supabase: SupabaseClient,
  limit = 50,
): Promise<{ processed: number; sent: number; failed: number; rescheduled: number; skipped: number }> {
  const fcmKey = getFcmServerKey();
  if (!fcmKey) {
    console.warn("[notifications] FCM_SERVER_KEY missing; skip send");
    return { processed: 0, sent: 0, failed: 0, rescheduled: 0, skipped: 0 };
  }

  const nowIso = new Date().toISOString();
  const { data: jobs, error } = await supabase
    .from("notification_jobs")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (jobs ?? []) as NotificationJobRow[];
  let sent = 0;
  let failed = 0;
  let rescheduled = 0;
  let skipped = 0;

  for (const job of rows) {
    const { data: settings } = await supabase
      .from("user_notification_settings")
      .select("push_enabled,quiet_hours_start,quiet_hours_end")
      .eq("user_id", job.user_id)
      .maybeSingle();

    const pushEnabled = (settings as { push_enabled?: boolean } | null)?.push_enabled ?? true;
    if (!pushEnabled) {
      await supabase
        .from("notification_jobs")
        .update({ status: "cancelled", updated_at: nowIso, last_error: "push_disabled" })
        .eq("id", job.id);
      skipped += 1;
      continue;
    }

    const qh = settings as { quiet_hours_start?: string | null; quiet_hours_end?: string | null } | null;
    if (isInQuietHours(new Date(), qh?.quiet_hours_start, qh?.quiet_hours_end)) {
      const next = new Date(Date.now() + 45 * 60 * 1000).toISOString();
      await supabase.from("notification_jobs").update({ scheduled_for: next, updated_at: nowIso }).eq("id", job.id);
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

    const { data: tokenRows, error: tokenErr } = await supabase
      .from("device_tokens")
      .select("token,invalidated_at")
      .eq("user_id", job.user_id);

    if (tokenErr) {
      await supabase
        .from("notification_jobs")
        .update({ status: "failed", last_error: tokenErr.message, attempts: job.attempts + 1, updated_at: nowIso })
        .eq("id", job.id);
      failed += 1;
      continue;
    }

    const tokenList = (tokenRows ?? [])
      .filter((r: { invalidated_at?: string | null }) => !r.invalidated_at)
      .map((r: { token: string }) => r.token.trim())
      .filter(Boolean);

    if (!tokenList.length) {
      await supabase
        .from("notification_jobs")
        .update({ status: "failed", last_error: "no_device_tokens", attempts: job.attempts + 1, updated_at: nowIso })
        .eq("id", job.id);
      failed += 1;
      continue;
    }

    const sendResult = await sendFcmToTokens(tokenList, payload.title, payload.body, payload, fcmKey);
    await invalidateDeadTokens(supabase, job.user_id, tokenList, sendResult.results);

    if (!sendResult.ok) {
      const attempts = job.attempts + 1;
      const giveUp = attempts >= MAX_RETRIES;
      const backoffMs = Math.min(5 * 60 * 1000 * attempts, 2 * 3600 * 1000);
      const nextScheduled = giveUp ? job.scheduled_for : new Date(Date.now() + backoffMs).toISOString();
      await supabase
        .from("notification_jobs")
        .update({
          status: giveUp ? "failed" : "pending",
          attempts,
          last_error: JSON.stringify(sendResult.raw).slice(0, 800),
          scheduled_for: giveUp ? job.scheduled_for : nextScheduled,
          updated_at: nowIso,
        })
        .eq("id", job.id);
      await supabase.from("notification_logs").insert({
        job_id: job.id,
        user_id: job.user_id,
        status: "failed",
        response: sendResult.raw as object,
      });
      failed += 1;
      continue;
    }

    await supabase.from("notification_jobs").update({ status: "sent", updated_at: nowIso, last_error: null }).eq("id", job.id);
    await supabase.from("notification_logs").insert({
      job_id: job.id,
      user_id: job.user_id,
      status: "sent",
      response: sendResult.raw as object,
    });

    const notifType = mapJobToNotificationType(job);
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

    sent += 1;
  }

  return { processed: rows.length, sent, failed, rescheduled, skipped };
}
