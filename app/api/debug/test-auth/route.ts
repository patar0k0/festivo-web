import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  // TEMP: manually paste a real access token here
  const token = "PASTE_REAL_TOKEN_HERE";

  const { data, error } = await supabase.auth.getUser(token);

  console.log("[TEST AUTH] user:", data?.user?.id);
  console.log("[TEST AUTH] error:", error);

  return NextResponse.json({
    user: data?.user ?? null,
    error,
  });
}
