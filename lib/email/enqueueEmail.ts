import type { SupabaseClient } from "@supabase/supabase-js";

import type { EmailJobType } from "./emailJobTypes";
import { isKnownEmailJobType } from "./emailJobTypes";

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
    const { data: existing, error: existingErr } = await supabase
      .from("email_jobs")
      .select("id")
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();

    if (existingErr) {
      console.error("[email_jobs] enqueue dedupe lookup failed", {
        message: existingErr.message,
        dedupe_key: dedupeKey,
      });
      throw new Error(existingErr.message);
    }

    if (existing?.id) {
      console.info("[email_jobs] enqueue skipped (existing dedupe_key)", {
        job_id: existing.id,
        dedupe_key: dedupeKey,
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
    status: "pending" as const,
    updated_at: nowIso,
  };

  const { data: inserted, error: insertErr } = await supabase
    .from("email_jobs")
    .insert(row)
    .select("id")
    .single();

  if (insertErr?.code === "23505" && dedupeKey) {
    const { data: afterRace, error: raceErr } = await supabase
      .from("email_jobs")
      .select("id")
      .eq("dedupe_key", dedupeKey)
      .single();

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
