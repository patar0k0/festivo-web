import type { ResendVerifiedWebhookPayload } from "./webhook/verifyResendWebhook";

export type NormalizedEmailWebhookEvent = {
  provider: "resend";
  /** Resend `data.email_id` when present (same id returned from `emails.send`). */
  provider_message_id: string | null;
  /** Resend webhook `type`, e.g. `email.delivered`, or `unknown` if missing. */
  event_type: string;
  occurred_at: string;
  event_payload: Record<string, unknown>;
  webhook_delivery_id: string | null;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function pickString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function parseOccurredAt(payload: ResendVerifiedWebhookPayload): string | null {
  const top = pickString(payload.created_at);
  if (top) return top;

  const data = payload.data;
  if (isRecord(data)) {
    const inner = pickString(data.created_at);
    if (inner) return inner;
  }

  return null;
}

function extractEmailId(payload: ResendVerifiedWebhookPayload): string | null {
  const data = payload.data;
  if (!isRecord(data)) return null;
  return pickString(data.email_id);
}

/**
 * Maps a verified Resend webhook JSON body to a row-shaped object for `email_events`.
 * Does not throw on odd shapes; uses `unknown` / fallbacks instead.
 */
export function normalizeEmailWebhookEvent(
  verifiedPayload: ResendVerifiedWebhookPayload,
  webhookDeliveryId: string | null,
): NormalizedEmailWebhookEvent {
  const eventType = pickString(verifiedPayload.type) ?? "unknown";
  const occurredAt = parseOccurredAt(verifiedPayload) ?? new Date().toISOString();
  const providerMessageId = extractEmailId(verifiedPayload);

  return {
    provider: "resend",
    provider_message_id: providerMessageId,
    event_type: eventType,
    occurred_at: occurredAt,
    event_payload: verifiedPayload,
    webhook_delivery_id: webhookDeliveryId,
  };
}
