import { NextResponse } from "next/server";
import {
  ACCESS_AUTH_COOKIE,
  REFRESH_AUTH_COOKIE,
  USER_AUTH_COOKIE,
} from "@/lib/authUser";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const secure = url.protocol === "https:";
  const response = NextResponse.redirect(new URL("/", url));

  for (const name of [ACCESS_AUTH_COOKIE, REFRESH_AUTH_COOKIE, USER_AUTH_COOKIE]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }

  return response;
}
