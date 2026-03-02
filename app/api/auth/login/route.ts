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

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  const nextPath = formData.get("next");

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return redirectWithError(request, "Невалидни данни за вход.");
  }

  const supabase = supabaseServer();
  if (!supabase) {
    return redirectWithError(request, "Липсва Supabase конфигурация.");
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return redirectWithError(request, "Невалидни данни за вход.");
  }

  const safeNext = typeof nextPath === "string" && nextPath.startsWith("/") ? nextPath : "/plan";
  const isProd = process.env.NODE_ENV === "production";
  const response = NextResponse.redirect(new URL(safeNext, request.url));

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
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}

export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/login", request.url));
}
