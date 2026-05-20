import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getRequestClientIp,
  shouldEnforceTurnstile,
  verifyTurnstileToken,
} from "@/lib/turnstile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  email?: string;
  source?: string;
  turnstileToken?: string;
  /** Honeypot — must stay empty. */
  website?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_SOURCES = new Set(["footer", "popup", "landing"]);

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Body;

  // Honeypot — silently succeed to not signal detection to bots.
  const hp = typeof body.website === "string" ? body.website.trim() : "";
  if (hp.length > 0) {
    return NextResponse.json({ ok: true });
  }

  // Turnstile (skipped if not configured in env).
  const token = typeof body.turnstileToken === "string" ? body.turnstileToken : "";
  if (shouldEnforceTurnstile()) {
    const ok = await verifyTurnstileToken(token, getRequestClientIp(request));
    if (!ok) {
      return NextResponse.json(
        { error: "Проверката срещу ботове не мина. Опитай отново." },
        { status: 403 },
      );
    }
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email || !EMAIL_RE.test(email) || email.length > 320) {
    return NextResponse.json({ error: "Невалиден имейл адрес." }, { status: 400 });
  }

  const rawSource = typeof body.source === "string" ? body.source.trim() : "footer";
  const source = ALLOWED_SOURCES.has(rawSource) ? rawSource : "footer";

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[newsletter] SUPABASE_SERVICE_ROLE_KEY is not set");
    return NextResponse.json(
      { error: "Записването е временно недостъпно. Опитай по-късно." },
      { status: 503 },
    );
  }

  const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;
  const ip = getRequestClientIp(request);

  try {
    const supabase = createSupabaseAdmin();

    // Idempotent upsert by email_lower (generated column).
    // If email already subscribed → silently succeed (no information leak).
    // If previously unsubscribed → reactivate by clearing unsubscribed_at.
    const { error } = await supabase
      .from("newsletter_subscribers")
      .upsert(
        {
          email,
          source,
          ip_address: ip,
          user_agent: userAgent,
          consented_at: new Date().toISOString(),
          unsubscribed_at: null,
        },
        { onConflict: "email_lower", ignoreDuplicates: false },
      );

    if (error) {
      console.error("[newsletter] upsert failed", error.message);
      return NextResponse.json(
        { error: "Възникна грешка. Опитай отново по-късно." },
        { status: 502 },
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[newsletter] unexpected error", msg);
    return NextResponse.json(
      { error: "Възникна грешка. Опитай отново по-късно." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
