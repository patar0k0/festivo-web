import { NextResponse } from "next/server";
import {
  ACCESS_AUTH_COOKIE,
  REFRESH_AUTH_COOKIE,
  USER_AUTH_COOKIE,
} from "@/lib/authUser";
import { supabaseServer } from "@/lib/supabaseServer";

function redirectWithError(request: Request, message: string) {
  const url = new URL(request.url);
  const loginUrl = new URL("/login", url);
  loginUrl.searchParams.set("error", message);
  return NextResponse.redirect(loginUrl);
}

function jsonWithError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function resolveSafeNext(nextPath: unknown) {
  return typeof nextPath === "string" && nextPath.startsWith("/") ? nextPath : "/plan";
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");

  let email: unknown;
  let password: unknown;
  let nextPath: unknown;

  if (isJson) {
    const body = (await request.json().catch(() => null)) as { email?: unknown; password?: unknown; next?: unknown } | null;
    email = body?.email;
    password = body?.password;
    nextPath = body?.next;
  } else {
    const formData = await request.formData();
    email = formData.get("email");
    password = formData.get("password");
    nextPath = formData.get("next");
  }

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return isJson ? jsonWithError("Невалидни данни за вход.") : redirectWithError(request, "Невалидни данни за вход.");
  }

  const supabase = supabaseServer();
  if (!supabase) {
    return isJson ? jsonWithError("Липсва Supabase конфигурация.", 500) : redirectWithError(request, "Липсва Supabase конфигурация.");
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return isJson ? jsonWithError("Невалидни данни за вход.", 401) : redirectWithError(request, "Невалидни данни за вход.");
  }

  const safeNext = resolveSafeNext(nextPath);
  const isProd = process.env.NODE_ENV === "production";
  const response = isJson
    ? NextResponse.json({ ok: true, next: safeNext })
    : NextResponse.redirect(new URL(safeNext, request.url));

  response.cookies.set(ACCESS_AUTH_COOKIE, data.session.access_token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });

  response.cookies.set(REFRESH_AUTH_COOKIE, data.session.refresh_token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  response.cookies.set(USER_AUTH_COOKIE, data.session.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}

export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/login", request.url));
}
