import { EMAIL_FROM, getEmailReplyTo } from "./config";
import { resend } from "./resend";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  /** Override the from address for this message (e.g. outreach emails). Defaults to EMAIL_FROM env var. */
  from?: string | null;
  /** Per-message Reply-To (e.g. visitor email); overrides env `EMAIL_REPLY_TO` when non-empty. */
  replyTo?: string | null;
};

export type SendEmailMeta = {
  jobId?: string;
  type?: string;
};

export type SendEmailResult = {
  success: boolean;
  providerMessageId?: string | null;
  error?: string;
};

export const RESEND_API_KEY_MISSING_ERROR = "RESEND_API_KEY is not set";

function normalizeProviderError(err: unknown): string {
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return JSON.stringify(err).slice(0, 500);
}

export async function sendEmail(input: SendEmailInput, meta?: SendEmailMeta): Promise<SendEmailResult> {
  if (meta?.jobId && meta?.type) {
    console.info("[email][start]", { jobId: meta.jobId, type: meta.type });
  }

  if (process.env.EMAIL_ENABLED === "false") {
    const to = input.to;
    console.info("[email][disabled]", { jobId: meta?.jobId, to });
    return { success: true, providerMessageId: "disabled-mode" };
  }

  if (!resend) {
    return { success: false, error: RESEND_API_KEY_MISSING_ERROR };
  }

  try {
    const replyToOverride = typeof input.replyTo === "string" ? input.replyTo.trim() : "";
    const replyTo = replyToOverride || getEmailReplyTo();
    const fromAddress = input.from?.trim() || EMAIL_FROM;
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      ...(replyTo ? { replyTo } : {}),
    });

    if (error) {
      return { success: false, error: normalizeProviderError(error) };
    }

    const providerMessageId =
      data && typeof data === "object" && "id" in data && typeof (data as { id?: unknown }).id === "string"
        ? (data as { id: string }).id
        : null;

    if (meta?.jobId) {
      console.info("[email][sent]", { jobId: meta.jobId, providerMessageId: providerMessageId ?? undefined });
    }

    return { success: true, providerMessageId };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMessage };
  }
}
