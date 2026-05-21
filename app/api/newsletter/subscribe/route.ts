import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  email?: string;
  source?: string;
  /** Honeypot — must stay empty. */
  website?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_SOURCES = new Set(["footer", "popup", "landing"]);

// Anti-abuse stack on this route (Turnstile intentionally NOT used — newsletter
// signup is low-stakes UX and a visible challenge clashes with the warm footer
// design):
//   1) Honeypot field below (bots fill all fields → silent success, no signal).
//   2) Strict email regex + 320-char cap.
//   3) Middleware rate limit (`user-actions` bucket: 30 req/60s per IP/user).
//   4) DB unique index on `email_lower` → upsert collapses duplicates.

function getClientIp(request: Request): string | null {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") || null;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Body;

  // Honeypot — silently succeed to not signal detection to bots.
  const hp = typeof body.website === "string" ? body.website.trim() : "";
  if (hp.length > 0) {
    return NextResponse.json({ ok: true });
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
  const ip = getClientIp(request);

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
