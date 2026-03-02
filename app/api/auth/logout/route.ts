import { NextResponse } from "next/server";
import { USER_AUTH_COOKIE } from "@/lib/authUser";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const response = NextResponse.redirect(new URL("/", url));
  response.cookies.set(USER_AUTH_COOKIE, "", {
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
