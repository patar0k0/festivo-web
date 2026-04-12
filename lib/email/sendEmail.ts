import { EMAIL_FROM, getEmailReplyTo } from "./config";
import { resend } from "./resend";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  /** Per-message Reply-To (e.g. visitor email); overrides env `EMAIL_REPLY_TO` when non-empty. */
  replyTo?: string | null;
};

export type SendEmailResult = {
  ok: boolean;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  missingApiKey?: boolean;
};

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!resend) {
    return {
      ok: false,
      missingApiKey: true,
      errorMessage: "RESEND_API_KEY is not set",
    };
  }

  try {
    const replyToOverride = typeof input.replyTo === "string" ? input.replyTo.trim() : "";
    const replyTo = replyToOverride || getEmailReplyTo();
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      ...(replyTo ? { replyTo } : {}),
    });

    if (error) {
      const errorMessage =
        typeof error.message === "string" ? error.message : JSON.stringify(error).slice(0, 500);
      return { ok: false, errorMessage };
    }

    const providerMessageId =
      data && typeof data === "object" && "id" in data && typeof (data as { id?: unknown }).id === "string"
        ? (data as { id: string }).id
        : null;

    return { ok: true, providerMessageId };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { ok: false, errorMessage };
  }
}
