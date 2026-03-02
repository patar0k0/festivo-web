import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_AUTH_COOKIE,
  REFRESH_AUTH_COOKIE,
  USER_AUTH_COOKIE,
} from "@/lib/authUser";
import { supabaseServer } from "@/lib/supabaseServer";

function logDev(message: string) {
  if (process.env.NODE_ENV !== "production") {
    console.log(message);
  }
}

export async function middleware(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_AUTH_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_AUTH_COOKIE)?.value;

  if (!refreshToken) {
    return NextResponse.next();
  }

  const supabase = supabaseServer();
  if (!supabase) {
    return NextResponse.next();
  }

  if (accessToken) {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(accessToken);

    if (!error && user) {
      return NextResponse.next();
    }
  }

  const { data } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (!data.session) {
    logDev("middleware: no refresh");
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const secure = request.nextUrl.protocol === "https:";

  response.cookies.set(ACCESS_AUTH_COOKIE, data.session.access_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });

  response.cookies.set(USER_AUTH_COOKIE, data.session.access_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  if (data.session.refresh_token) {
    response.cookies.set(REFRESH_AUTH_COOKIE, data.session.refresh_token, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  }

  logDev("middleware: refreshed");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
