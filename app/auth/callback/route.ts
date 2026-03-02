import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

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

    return NextResponse.redirect(new URL("/admin", request.url));
  } catch (error) {
    console.error("[auth/callback] unexpected error", error);
    return NextResponse.redirect(new URL("/login?error=oauth", request.url));
  }
}
