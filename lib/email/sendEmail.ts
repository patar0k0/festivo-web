import { EMAIL_FROM } from "./config";
import { resend } from "./resend";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
};

export async function sendEmail(
  input: SendEmailInput,
): Promise<{ ok: boolean }> {
  if (!resend) {
    console.error("[sendEmail] RESEND_API_KEY is not set");
    return { ok: false };
  }

  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });

    if (error) {
      console.error("[sendEmail] Resend error:", error);
      return { ok: false };
    }

    return { ok: true };
  } catch (err) {
    console.error("[sendEmail] Unexpected error:", err);
    return { ok: false };
  }
}
