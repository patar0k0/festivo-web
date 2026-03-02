import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function jsonWithError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { email?: unknown; password?: unknown }
    | null;
  const email = body?.email;
  const password = body?.password;

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return jsonWithError("Невалидни данни за вход.");
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return jsonWithError("Невалидни данни за вход.", 401);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return jsonWithError("Липсва Supabase конфигурация.", 500);
  }
}

export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/login", request.url));
}
