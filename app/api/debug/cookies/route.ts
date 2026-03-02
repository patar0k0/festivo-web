import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const cookieNames = cookieStore.getAll().map((cookie) => cookie.name);
  const sbCookieNames = cookieNames.filter((name) => name.startsWith("sb-"));

  return NextResponse.json({
    cookieNames,
    hasSbCookie: sbCookieNames.length > 0,
    sbCookieNames,
  });
}
