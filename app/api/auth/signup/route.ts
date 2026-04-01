import { NextResponse } from "next/server";
import { signupErrorMessage } from "@/app/login/authErrors";
import { getRequestClientIp, shouldEnforceTurnstile, verifyTurnstileToken } from "@/lib/turnstile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  email?: string;
  password?: string;
  turnstileToken?: string;
  next?: string;
};

function safeNextPath(raw: unknown): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/";
  }
  return raw;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Body;
  const token = typeof body.turnstileToken === "string" ? body.turnstileToken : "";

  if (shouldEnforceTurnstile()) {
    const ok = await verifyTurnstileToken(token, getRequestClientIp(request));
    if (!ok) {
      return NextResponse.json({ error: "Bot protection check failed." }, { status: 403 });
    }
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const nextPath = safeNextPath(body.next);

  if (!email) {
    return NextResponse.json({ error: "Въведи валиден имейл." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Паролата трябва да е поне 8 символа." }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const emailRedirectTo = new URL("/auth/callback", origin);
  emailRedirectTo.searchParams.set("next", nextPath);

  const supabase = await createSupabaseServerClient();
  const { data, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: emailRedirectTo.toString() },
  });

  if (signUpError) {
    return NextResponse.json(
      { error: signupErrorMessage(signUpError.message, "Неуспешна регистрация. Опитай отново.") },
      { status: 400 },
    );
  }

  return NextResponse.json({
    hasSession: Boolean(data.session),
    needsEmailConfirmation: !data.session,
  });
}
