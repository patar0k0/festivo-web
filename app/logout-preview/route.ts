import { NextResponse } from "next/server";

const PREVIEW_COOKIE_NAME = "festivo_preview";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const response = NextResponse.redirect(new URL("/", url));
  response.cookies.set(PREVIEW_COOKIE_NAME, "", {
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
