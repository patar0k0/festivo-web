import { sendEmail as sendViaResend } from "@/lib/email/sendEmail";

function htmlToText(html: string): string {
  return html
    .replace(/<a\s+[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, "$2 ($1) ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const result = await sendViaResend({
    to,
    subject,
    html,
    text: htmlToText(html),
  });
  if (!result.ok) {
    throw new Error(
      result.errorMessage ?? (result.missingApiKey ? "RESEND_API_KEY is not set" : "send failed"),
    );
  }
}
