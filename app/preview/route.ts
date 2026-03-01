import { NextResponse } from "next/server";

const PREVIEW_COOKIE_NAME = "festivo_preview";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const expectedToken = process.env.PREVIEW_TOKEN;
  const redirectUrl = new URL("/", url);

  if (!expectedToken || !token || token !== expectedToken) {
    return NextResponse.redirect(redirectUrl);
  }

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set(PREVIEW_COOKIE_NAME, expectedToken, {
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
