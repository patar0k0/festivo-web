import type { SupabaseClient } from "@supabase/supabase-js";

import type { EmailJobRow } from "./emailJobRow";
import { parseEmailJobType } from "./emailJobTypes";
import { renderEmailJob } from "./renderEmailJob";
import { sendEmail } from "./sendEmail";

export type { EmailJobRow } from "./emailJobRow";

/** Failed-send backoff after each attempt index (1-based). */
const BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000];

const LAST_ERROR_UNKNOWN_TYPE_PREFIX = "unknown_job_type:";
const LAST_ERROR_RESEND_NOT_CONFIGURED = "resend_not_configured";

function backoffAfterFailureMs(attemptsAfterIncrement: number): number {
  const idx = Math.min(Math.max(attemptsAfterIncrement - 1, 0), BACKOFF_MS.length - 1);
  return BACKOFF_MS[idx] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
}

export async function requeueStaleProcessingEmailJobs(
  supabase: SupabaseClient,
  staleMinutes = 15,
): Promise<number> {
  const cutoff = new Date(Date.now() - staleMinutes * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("email_jobs")
    .update({
      status: "pending",
      locked_at: null,
      processing_started_at: null,
      last_error: "stale_processing_requeued",
      updated_at: nowIso,
    })
    .eq("status", "processing")
    .lt("locked_at", cutoff)
    .not("locked_at", "is", null)
    .select("id");

  if (error) {
    console.error("[email_jobs] stale requeue failed", { message: error.message });
    return 0;
  }

  const n = data?.length ?? 0;
  if (n > 0) {
    console.info("[email_jobs] stale processing requeued", { count: n });
  }
  return n;
}

async function finalizeSendSuccess(
  supabase: SupabaseClient,
  jobId: string,
  providerMessageId: string | null,
): Promise<void> {
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("email_jobs")
    .update({
      status: "sent",
      sent_at: nowIso,
      provider: "resend",
      provider_message_id: providerMessageId,
      locked_at: null,
      processing_started_at: null,
      last_error: null,
      updated_at: nowIso,
    })
    .eq("id", jobId);

  if (error) {
    console.error("[email_jobs] finalize sent failed", {
      job_id: jobId,
      message: error.message,
    });
    throw new Error(error.message);
  }
}

async function finalizeSendFailure(
  supabase: SupabaseClient,
  job: EmailJobRow,
  errorMessage: string,
): Promise<"retried" | "failed"> {
  const nowIso = new Date().toISOString();
  const nextAttempts = job.attempts + 1;
  const terminal = nextAttempts >= job.max_attempts;
  const nextScheduled = terminal
    ? job.scheduled_at
    : new Date(Date.now() + backoffAfterFailureMs(nextAttempts)).toISOString();

  const { error } = await supabase
    .from("email_jobs")
    .update({
      status: terminal ? "failed" : "pending",
      attempts: nextAttempts,
      last_error: errorMessage.slice(0, 2000),
      locked_at: null,
      processing_started_at: null,
      scheduled_at: nextScheduled,
      updated_at: nowIso,
    })
    .eq("id", job.id);

  if (error) {
    console.error("[email_jobs] finalize failure update failed", {
      job_id: job.id,
      message: error.message,
    });
    throw new Error(error.message);
  }

  if (terminal) {
    console.warn("[email_jobs] job failed (terminal)", {
      job_id: job.id,
      attempts: nextAttempts,
      max_attempts: job.max_attempts,
      last_error: errorMessage.slice(0, 200),
    });
    return "failed";
  }

  console.info("[email_jobs] job retry scheduled", {
    job_id: job.id,
    attempts: nextAttempts,
    next_scheduled_at: nextScheduled,
  });
  return "retried";
}

export async function processOneEmailJob(
  supabase: SupabaseClient,
  job: EmailJobRow,
): Promise<"sent" | "retried" | "failed"> {
  const jobType = parseEmailJobType(job.type);
  if (!jobType) {
    const err = `${LAST_ERROR_UNKNOWN_TYPE_PREFIX}${job.type}`;
    console.warn("[email_jobs] job rejected: unknown_type", { job_id: job.id, type: job.type });
    return finalizeSendFailure(supabase, job, err);
  }

  let built: { subject: string; html: string; text: string };
  try {
    built = await renderEmailJob(job, jobType);
  } catch (err) {
    const message = err instanceof Error ? err.message : "render_failed";
    console.error("[email_jobs] render failed", { job_id: job.id, type: job.type, message });
    return finalizeSendFailure(supabase, job, `render_failed:${message.slice(0, 500)}`);
  }

  const result = await sendEmail({
    to: job.recipient_email,
    subject: built.subject,
    html: built.html,
    text: built.text,
  });

  if (result.ok) {
    await finalizeSendSuccess(supabase, job.id, result.providerMessageId ?? null);
    console.info("[email_jobs] job sent", {
      job_id: job.id,
      type: job.type,
      provider_message_id: result.providerMessageId ?? null,
    });
    return "sent";
  }

  const err =
    result.missingApiKey === true
      ? LAST_ERROR_RESEND_NOT_CONFIGURED
      : (result.errorMessage?.trim() || "send_failed");

  if (result.missingApiKey) {
    console.warn("[email_jobs] job failed: resend_not_configured", { job_id: job.id });
  } else {
    console.warn("[email_jobs] job send failed", { job_id: job.id, type: job.type, error: err });
  }

  return finalizeSendFailure(supabase, job, err);
}

export async function processDueEmailJobs(
  supabase: SupabaseClient,
  limit = 15,
): Promise<{
  picked: number;
  sent: number;
  retried: number;
  failed: number;
}> {
  await requeueStaleProcessingEmailJobs(supabase);

  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const { data: claimed, error: claimErr } = await supabase.rpc("claim_due_email_jobs", {
    p_limit: safeLimit,
  });

  if (claimErr) {
    console.error("[email_jobs] claim failed", { message: claimErr.message });
    throw new Error(claimErr.message);
  }

  const jobs = (claimed ?? []) as EmailJobRow[];
  const picked = jobs.length;

  if (picked === 0) {
    return { picked: 0, sent: 0, retried: 0, failed: 0 };
  }

  console.info("[email_jobs] batch start", { picked });

  let sent = 0;
  let retried = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      const outcome = await processOneEmailJob(supabase, job);
      if (outcome === "sent") sent += 1;
      else if (outcome === "retried") retried += 1;
      else failed += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : "unexpected_processor_error";
      console.error("[email_jobs] processor error", { job_id: job.id, message });
      try {
        const outcome = await finalizeSendFailure(supabase, job, message);
        if (outcome === "failed") failed += 1;
        else retried += 1;
      } catch {
        failed += 1;
      }
    }
  }

  console.info("[email_jobs] batch end", { picked, sent, retried, failed });
  return { picked, sent, retried, failed };
}
