import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_AUTH_COOKIE,
  REFRESH_AUTH_COOKIE,
  USER_AUTH_COOKIE,
} from "@/lib/authUser";

type RefreshResponse = {
  access_token?: string;
  refresh_token?: string;
};

export async function middleware(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_AUTH_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_AUTH_COOKIE)?.value;

  if (!refreshToken) {
    return NextResponse.next();
  }

  if (accessToken) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return NextResponse.next();
  }

  try {
    const refreshResponse = await fetch(
      `${supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
      {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      },
    );

    if (!refreshResponse.ok) {
      return NextResponse.next();
    }

    const data: RefreshResponse = await refreshResponse.json();

    if (!data.access_token) {
      return NextResponse.next();
    }

    const response = NextResponse.next();
    const secure = request.nextUrl.protocol === "https:";

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
      maxAge: 60 * 60 * 24 * 7,
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
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/admin/:path*", "/plan/:path*"],
};
