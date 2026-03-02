import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { USER_AUTH_COOKIE } from "@/lib/authUser";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const cookieNames = cookieStore.getAll().map((cookie) => cookie.name);
  const token = cookieStore.get(USER_AUTH_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ hasCookie: false, cookieNames });
  }

  const supabase = supabaseServer();
  if (!supabase) {
    return NextResponse.json({ hasCookie: true, cookieNames });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser(token);

  return NextResponse.json({
    hasCookie: true,
    cookieNames,
    userId: user?.id,
  });
}
