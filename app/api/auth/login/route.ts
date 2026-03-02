import { NextResponse } from "next/server";
import {
  REFRESH_AUTH_COOKIE,
  USER_AUTH_COOKIE,
} from "@/lib/authUser";
import { supabaseServer } from "@/lib/supabaseServer";

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

  const supabase = supabaseServer();
  if (!supabase) {
    return jsonWithError("Липсва Supabase конфигурация.", 500);
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return jsonWithError("Невалидни данни за вход.", 401);
  }

  const secure = process.env.NODE_ENV === "production";
  const response = NextResponse.json({ ok: true });

  response.cookies.set(USER_AUTH_COOKIE, data.session.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60,
  });

  response.cookies.set(REFRESH_AUTH_COOKIE, data.session.refresh_token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}

export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/login", request.url));
}
