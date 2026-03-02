import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const cookieNames = cookieStore.getAll().map((cookie) => cookie.name);

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return NextResponse.json({
      hasCookie: cookieNames.length > 0,
      cookieNames,
      userId: user?.id,
    });
  } catch {
    return NextResponse.json({ hasCookie: cookieNames.length > 0, cookieNames });
  }
}
