import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { REFRESH_AUTH_COOKIE, USER_AUTH_COOKIE } from "@/lib/authUser";

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url));

  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch {
    // Keep redirect even if sign out fails.
  }

  const secure = process.env.NODE_ENV === "production";
  for (const name of [USER_AUTH_COOKIE, REFRESH_AUTH_COOKIE]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 0,
    });
  }

  return response;
}

export async function POST(request: Request) {
  return GET(request);
}
