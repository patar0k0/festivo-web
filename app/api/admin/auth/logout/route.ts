import { NextResponse } from "next/server";

const ADMIN_AUTH_COOKIE = "festivo_admin_token";

export async function GET(request: Request) {
  const isProd = process.env.NODE_ENV === "production";
  const response = NextResponse.redirect(new URL("/admin/login", request.url));

  response.cookies.set(ADMIN_AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: 0,
  });

  return response;
}
