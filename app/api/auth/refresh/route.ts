import { NextResponse } from "next/server";
import {
  ACCESS_AUTH_COOKIE,
  REFRESH_AUTH_COOKIE,
  USER_AUTH_COOKIE,
} from "@/lib/authUser";
import { refreshAccessToken } from "@/lib/authRefresh";

export async function POST(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const refreshToken = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${REFRESH_AUTH_COOKIE}=`))
    ?.slice(`${REFRESH_AUTH_COOKIE}=`.length);

  if (!refreshToken) {
    return new NextResponse(null, { status: 204 });
  }

  const data = await refreshAccessToken(refreshToken);
  if (!data?.access_token) {
    return new NextResponse(null, { status: 204 });
  }

  const secure = new URL(request.url).protocol === "https:";
  const response = new NextResponse(null, { status: 204 });

  response.cookies.set(ACCESS_AUTH_COOKIE, data.access_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });

  response.cookies.set(USER_AUTH_COOKIE, data.access_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });

  if (data.refresh_token) {
    response.cookies.set(REFRESH_AUTH_COOKIE, data.refresh_token, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  }

  return response;
}
