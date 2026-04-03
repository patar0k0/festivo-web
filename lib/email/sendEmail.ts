import { EMAIL_FROM } from "./config";
import { resend } from "./resend";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
};

export type SendEmailResult = {
  ok: boolean;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  missingApiKey?: boolean;
};

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!resend) {
    console.error("[sendEmail] RESEND_API_KEY is not set");
    return { ok: false, missingApiKey: true, errorMessage: "RESEND_API_KEY is not set" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });

    if (error) {
      const errorMessage =
        typeof error.message === "string" ? error.message : JSON.stringify(error).slice(0, 500);
      console.error("[sendEmail] Resend error:", error);
      return { ok: false, errorMessage };
    }

    const providerMessageId =
      data && typeof data === "object" && "id" in data && typeof data.id === "string"
        ? data.id
        : null;

    return { ok: true, providerMessageId };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[sendEmail] Unexpected error:", err);
    return { ok: false, errorMessage };
  }
}
