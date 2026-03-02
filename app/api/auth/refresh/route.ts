import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { REFRESH_AUTH_COOKIE, USER_AUTH_COOKIE } from "@/lib/authUser";

function getSafeNext(rawNext: string | null) {
  return rawNext && rawNext.startsWith("/") ? rawNext : "/admin";
}

function loginRedirect(request: Request, nextPath: string) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", nextPath);
  return NextResponse.redirect(loginUrl);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const secure = process.env.NODE_ENV === "production";
  const nextPath = getSafeNext(url.searchParams.get("next"));
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_AUTH_COOKIE)?.value;

  if (!refreshToken) {
    return loginRedirect(request, nextPath);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    const response = loginRedirect(request, nextPath);
    response.cookies.set(USER_AUTH_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 0,
    });
    response.cookies.set(REFRESH_AUTH_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 0,
    });
    return response;
  }

  const refreshResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  });

  if (!refreshResponse.ok) {
    const response = loginRedirect(request, nextPath);
    response.cookies.set(USER_AUTH_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 0,
    });
    response.cookies.set(REFRESH_AUTH_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 0,
    });
    return response;
  }

  const data = (await refreshResponse.json()) as {
    access_token?: string;
    refresh_token?: string;
  };

  if (!data.access_token) {
    const response = loginRedirect(request, nextPath);
    response.cookies.set(USER_AUTH_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 0,
    });
    response.cookies.set(REFRESH_AUTH_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 0,
    });
    return response;
  }

  const response = NextResponse.redirect(new URL(nextPath, request.url));
  response.cookies.set(USER_AUTH_COOKIE, data.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60,
  });

  if (data.refresh_token) {
    response.cookies.set(REFRESH_AUTH_COOKIE, data.refresh_token, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  }

  return response;
}
