import { Webhook } from "svix";

export type ResendVerifiedWebhookPayload = Record<string, unknown>;

/**
 * Verifies a Resend (Svix-signed) webhook using the raw body string.
 * @see https://resend.com/docs/webhooks/verify-webhooks-requests
 */
export function verifyResendWebhook(
  rawBody: string,
  svixId: string | null,
  svixTimestamp: string | null,
  svixSignature: string | null,
  webhookSecret: string,
): ResendVerifiedWebhookPayload {
  const wh = new Webhook(webhookSecret);
  const verified = wh.verify(rawBody, {
    "svix-id": svixId ?? "",
    "svix-timestamp": svixTimestamp ?? "",
    "svix-signature": svixSignature ?? "",
  });

  if (typeof verified === "object" && verified !== null && !Array.isArray(verified)) {
    return verified as ResendVerifiedWebhookPayload;
  }

  return { _non_object_payload: verified } as ResendVerifiedWebhookPayload;
}
