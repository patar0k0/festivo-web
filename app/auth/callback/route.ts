import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getSafeNext(rawNext: string | null) {
  if (!rawNext || !rawNext.startsWith("/")) {
    return "/admin";
  }
  return rawNext;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = getSafeNext(requestUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=oauth", request.url));
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[auth/callback] exchangeCodeForSession failed", error);
      return NextResponse.redirect(new URL("/login?error=oauth", request.url));
    }

    return NextResponse.redirect(new URL(nextPath, request.url));
  } catch (error) {
    console.error("[auth/callback] unexpected error", error);
    return NextResponse.redirect(new URL("/login?error=oauth", request.url));
  }
}
