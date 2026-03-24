import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/supabaseServer";

function getSafeNext(rawNext: string | null) {
  if (!rawNext || !rawNext.startsWith("/") || rawNext.startsWith("//")) {
    return "/";
  }
  return rawNext;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = getSafeNext(requestUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=oauth", request.url));
  }

  try {
    const { url, anon, configured } = getSupabaseEnv();
    if (!configured || !url || !anon) {
      return NextResponse.redirect(new URL("/login?error=oauth", request.url));
    }

    const response = NextResponse.redirect(new URL(nextPath, request.url));
    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[auth/callback] exchangeCodeForSession failed", error);
      return NextResponse.redirect(new URL("/login?error=oauth", request.url));
    }

    return response;
  } catch (error) {
    console.error("[auth/callback] unexpected error", error);
    return NextResponse.redirect(new URL("/login?error=oauth", request.url));
  }
}
