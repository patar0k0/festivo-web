import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const cookieStore = await cookies();
  const cookieNames = cookieStore.getAll().map((cookie) => cookie.name);
  const sbCookieNames = cookieNames.filter((name) => name.startsWith("sb-"));

  return NextResponse.json({
    cookieNames,
    hasSbCookie: sbCookieNames.length > 0,
    sbCookieNames,
  });
}
