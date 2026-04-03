import type { SupabaseClient } from "@supabase/supabase-js";

const RESEND = {
  DELIVERED: "email.delivered",
  BOUNCED: "email.bounced",
  COMPLAINED: "email.complained",
  DELIVERY_DELAYED: "email.delivery_delayed",
  FAILED: "email.failed",
  SUPPRESSED: "email.suppressed",
  SENT: "email.sent",
  OPENED: "email.opened",
  CLICKED: "email.clicked",
} as const;

function isTerminalBad(status: string | null): boolean {
  return status === "bounced" || status === "complained";
}

/**
 * Best-effort summary on `email_jobs` for sent rows, using Resend `email.*` event types.
 * Engagement events only touch `last_event_*`.
 */
export async function applyResendEmailEventToEmailJob(
  supabase: SupabaseClient,
  emailJobId: string,
  resendEventType: string,
  occurredAtIso: string,
): Promise<void> {
  if (!resendEventType.startsWith("email.")) {
    return;
  }

  const { data: row, error: selErr } = await supabase
    .from("email_jobs")
    .select("status, delivery_status, delivered_at, bounced_at")
    .eq("id", emailJobId)
    .maybeSingle();

  if (selErr || !row || row.status !== "sent") {
    return;
  }

  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = {
    last_event_type: resendEventType,
    last_event_at: occurredAtIso,
    updated_at: nowIso,
  };

  const ds = row.delivery_status;

  switch (resendEventType) {
    case RESEND.BOUNCED: {
      patch.delivery_status = "bounced";
      if (!row.bounced_at) patch.bounced_at = occurredAtIso;
      break;
    }
    case RESEND.COMPLAINED: {
      if (ds !== "bounced") {
        patch.delivery_status = "complained";
      }
      break;
    }
    case RESEND.FAILED:
    case RESEND.SUPPRESSED: {
      if (ds !== "bounced" && ds !== "complained" && ds !== "delivered") {
        patch.delivery_status = resendEventType === RESEND.FAILED ? "failed" : "suppressed";
      }
      break;
    }
    case RESEND.DELIVERY_DELAYED: {
      if (!ds || ds === "delayed" || ds === "accepted") {
        patch.delivery_status = "delayed";
      }
      break;
    }
    case RESEND.DELIVERED: {
      if (!isTerminalBad(ds)) {
        patch.delivery_status = "delivered";
        if (!row.delivered_at) patch.delivered_at = occurredAtIso;
      }
      break;
    }
    case RESEND.SENT: {
      if (!ds && !row.delivered_at) {
        patch.delivery_status = "accepted";
      }
      break;
    }
    case RESEND.OPENED:
    case RESEND.CLICKED:
      break;
    default:
      break;
  }

  const { error: upErr } = await supabase.from("email_jobs").update(patch).eq("id", emailJobId);

  if (upErr) {
    console.error("[email_events] email_jobs summary update failed", {
      email_job_id: emailJobId,
      message: upErr.message,
    });
  }
}
