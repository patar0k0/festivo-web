import { NextResponse } from "next/server";
import { getEmailAdmin } from "@/lib/email/config";
import { sendEmail } from "@/lib/email/sendEmail";
import { SITE_ADMIN_EMAIL } from "@/lib/siteContact";
import { getRequestClientIp, shouldEnforceTurnstile, verifyTurnstileToken } from "@/lib/turnstile";

type Body = {
  name?: string;
  email?: string;
  message?: string;
  turnstileToken?: string;
  /** Honeypot — must stay empty. */
  website?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseContact(body: Body):
  | { ok: true; name: string; email: string; message: string }
  | { ok: false; error: string } {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!name) {
    return { ok: false, error: "Моля, въведи име." };
  }
  if (name.length > 120) {
    return { ok: false, error: "Името е твърде дълго." };
  }
  if (!email) {
    return { ok: false, error: "Моля, въведи имейл." };
  }
  if (!EMAIL_RE.test(email) || email.length > 320) {
    return { ok: false, error: "Невалиден имейл адрес." };
  }
  if (message.length < 10) {
    return { ok: false, error: "Съобщението трябва да е поне 10 символа." };
  }
  if (message.length > 6000) {
    return { ok: false, error: "Съобщението е твърде дълго." };
  }

  return { ok: true, name, email, message };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Body;

  const hp = typeof body.website === "string" ? body.website.trim() : "";
  if (hp.length > 0) {
    return NextResponse.json({ ok: true });
  }

  const token = typeof body.turnstileToken === "string" ? body.turnstileToken : "";
  if (shouldEnforceTurnstile()) {
    const ok = await verifyTurnstileToken(token, getRequestClientIp(request));
    if (!ok) {
      return NextResponse.json({ error: "Проверката срещу ботове не мина. Опитай отново." }, { status: 403 });
    }
  }

  const parsed = parseContact(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { name, email, message } = parsed;
  const recipient = getEmailAdmin()?.trim() || SITE_ADMIN_EMAIL;
  const subjectSafe = name.replace(/[\r\n\u0000]/g, " ").slice(0, 100);
  const subject = `[Festivo.bg] Контакт: ${subjectSafe}`;

  const html = `<!DOCTYPE html><html><body>
<p><strong>Име:</strong> ${escapeHtml(name)}</p>
<p><strong>Имейл:</strong> ${escapeHtml(email)}</p>
<p><strong>Съобщение:</strong></p>
<p style="white-space:pre-wrap;font-family:system-ui,sans-serif">${escapeHtml(message)}</p>
</body></html>`;

  const text = `Име: ${name}\nИмейл: ${email}\n\n${message}\n`;

  const result = await sendEmail({
    to: recipient,
    subject,
    html,
    text,
    replyTo: email,
  });

  if (result.ok) {
    return NextResponse.json({ ok: true });
  }

  if (result.missingApiKey) {
    console.error("[contact] resend not configured");
    return NextResponse.json(
      {
        error: `Изпращането на съобщения е временно недостъпно. Моля, пиши на ${SITE_ADMIN_EMAIL}.`,
      },
      { status: 503 },
    );
  }

  console.error("[contact] send failed", result.errorMessage);
  return NextResponse.json({ error: "Неуспешно изпращане. Опитай отново по-късно." }, { status: 502 });
}
