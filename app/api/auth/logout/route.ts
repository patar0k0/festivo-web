import { NextResponse } from "next/server";
import { REFRESH_AUTH_COOKIE, USER_AUTH_COOKIE } from "@/lib/authUser";

export async function GET(request: Request) {
  const isProd = process.env.NODE_ENV === "production";
  const response = NextResponse.redirect(new URL("/", request.url));

  for (const name of [USER_AUTH_COOKIE, REFRESH_AUTH_COOKIE]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      maxAge: 0,
    });
  }

  return response;
}
