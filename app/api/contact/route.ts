import { NextResponse } from "next/server";
import { getEmailAdmin } from "@/lib/email/config";
import { enqueueEmailJob } from "@/lib/email/enqueueEmail";
import { EMAIL_JOB_TYPE_CONTACT_FORM } from "@/lib/email/emailJobTypes";
import { SITE_ADMIN_EMAIL } from "@/lib/siteContact";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
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

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[contact] SUPABASE_SERVICE_ROLE_KEY is not set");
    return NextResponse.json(
      {
        error: `Изпращането на съобщения е временно недостъпно. Моля, пиши на ${SITE_ADMIN_EMAIL}.`,
      },
      { status: 503 },
    );
  }

  const recipientRaw = getEmailAdmin()?.trim() || SITE_ADMIN_EMAIL;
  const recipient = recipientRaw.trim().toLowerCase();

  try {
    const supabase = createSupabaseAdmin();
    await enqueueEmailJob(supabase, {
      type: EMAIL_JOB_TYPE_CONTACT_FORM,
      recipientEmail: recipient,
      recipientUserId: null,
      payload: {
        visitorName: name,
        visitorEmail: email,
        message,
        replyTo: email,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("RESEND") || msg.includes("enqueue")) {
      console.error("[contact] enqueue failed", msg);
    } else {
      console.error("[contact] enqueue failed", err);
    }
    return NextResponse.json({ error: "Неуспешно изпращане. Опитай отново по-късно." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
