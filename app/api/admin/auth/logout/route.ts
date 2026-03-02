import { NextResponse } from "next/server";
import { ADMIN_AUTH_COOKIE } from "@/lib/admin/isAdmin";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const response = NextResponse.redirect(new URL("/admin/login", url));
  response.cookies.set(ADMIN_AUTH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
