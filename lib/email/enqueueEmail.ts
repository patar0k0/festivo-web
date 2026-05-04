import type { SupabaseClient } from "@supabase/supabase-js";

import type { EmailJobPriority, EmailJobType } from "./emailJobTypes";
import { isKnownEmailJobType, normalizeEmailJobPriority } from "./emailJobTypes";

export type EnqueueEmailJobInput = {
  type: EmailJobType;
  recipientEmail: string;
  recipientUserId?: string | null;
  locale?: string;
  subject?: string | null;
  payload?: Record<string, unknown>;
  dedupeKey?: string | null;
  scheduledAt?: Date;
  maxAttempts?: number;
  priority?: EmailJobPriority;
};

export type EnqueueEmailJobResult =
  | { outcome: "created"; jobId: string }
  | { outcome: "existing"; jobId: string };

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Light validation — no external library; rejects obvious garbage. */
function assertValidRecipientEmail(normalized: string): void {
  if (!normalized) {
    throw new Error("recipientEmail is required");
  }
  const at = normalized.indexOf("@");
  if (at <= 0 || at === normalized.length - 1) {
    throw new Error("Invalid recipient email");
  }
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (!local || !domain || domain.includes("@") || domain.includes(" ")) {
    throw new Error("Invalid recipient email");
  }
}

/** Matches DB unique index `email_jobs_dedupe_strict` (type + identity + dedupe_key). */
function selectExistingByDedupe(
  supabase: SupabaseClient,
  type: EmailJobType,
  dedupeKey: string,
  recipientEmail: string,
  recipientUserId: string | null | undefined,
) {
  const uid = recipientUserId?.trim() || null;
  let q = supabase.from("email_jobs").select("id").eq("type", type).eq("dedupe_key", dedupeKey).limit(1);
  if (uid) {
    q = q.eq("recipient_user_id", uid);
  } else {
    q = q.is("recipient_user_id", null).eq("recipient_email", recipientEmail);
  }
  return q.maybeSingle();
}

export async function enqueueEmailJob(
  supabase: SupabaseClient,
  input: EnqueueEmailJobInput,
): Promise<EnqueueEmailJobResult> {
  if (!isKnownEmailJobType(input.type)) {
    throw new Error(`Unknown email job type: ${input.type}`);
  }

  const recipientEmail = normalizeEmail(input.recipientEmail);
  assertValidRecipientEmail(recipientEmail);

  const dedupeKey = input.dedupeKey?.trim() || null;
  const nowIso = new Date().toISOString();

  if (dedupeKey) {
    const { data: existing, error: existingErr } = await selectExistingByDedupe(
      supabase,
      input.type,
      dedupeKey,
      recipientEmail,
      input.recipientUserId,
    );

    if (existingErr) {
      console.error("[email_jobs] enqueue dedupe lookup failed", {
        message: existingErr.message,
        dedupe_key: dedupeKey,
        type: input.type,
      });
      throw new Error(existingErr.message);
    }

    if (existing?.id) {
      console.info("[email_jobs] enqueue skipped (existing dedupe_key)", {
        job_id: existing.id,
        dedupe_key: dedupeKey,
        type: input.type,
      });
      return { outcome: "existing", jobId: existing.id };
    }
  }

  const row = {
    type: input.type,
    recipient_email: recipientEmail,
    recipient_user_id: input.recipientUserId ?? null,
    locale: input.locale?.trim() || "bg",
    subject: input.subject ?? null,
    payload: input.payload ?? {},
    dedupe_key: dedupeKey,
    scheduled_at: (input.scheduledAt ?? new Date()).toISOString(),
    max_attempts: input.maxAttempts ?? 3,
    priority: normalizeEmailJobPriority(input.priority),
    status: "pending" as const,
    updated_at: nowIso,
  };

  const { data: inserted, error: insertErr } = await supabase
    .from("email_jobs")
    .insert(row)
    .select("id")
    .single();

  if (insertErr?.code === "23505" && dedupeKey) {
    const { data: afterRace, error: raceErr } = await selectExistingByDedupe(
      supabase,
      input.type,
      dedupeKey,
      recipientEmail,
      input.recipientUserId,
    );

    if (raceErr || !afterRace?.id) {
      console.error("[email_jobs] enqueue race reconcile failed", {
        message: raceErr?.message ?? insertErr.message,
        dedupe_key: dedupeKey,
      });
      throw new Error(raceErr?.message ?? insertErr.message);
    }

    console.info("[email_jobs] enqueue converged to existing after conflict", {
      job_id: afterRace.id,
      dedupe_key: dedupeKey,
    });
    return { outcome: "existing", jobId: afterRace.id };
  }

  if (insertErr || !inserted?.id) {
    console.error("[email_jobs] enqueue insert failed", {
      message: insertErr?.message,
      type: input.type,
    });
    throw new Error(insertErr?.message ?? "enqueue insert failed");
  }

  console.info("[email_jobs] enqueue created", {
    job_id: inserted.id,
    type: input.type,
    dedupe_key: dedupeKey,
  });
  return { outcome: "created", jobId: inserted.id };
}
