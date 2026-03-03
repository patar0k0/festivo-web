import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  // Keep GET side-effect free to avoid accidental logout from prefetches.
  return NextResponse.redirect(new URL("/", request.url));
}

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url));

  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch {
    // Keep redirect even if sign out fails.
  }

  return response;
}
