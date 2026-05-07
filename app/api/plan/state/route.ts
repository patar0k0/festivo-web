import { NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/authUser";
import { getPlanStateByUser } from "@/lib/plan/server";

export async function GET(request: Request) {
  const ua = request.headers.get("user-agent") || "";

  const isInternal =
    ua.includes("vercel") ||
    ua.includes("node") ||
    ua.includes("curl") ||
    ua.includes("undici");

  if (isInternal) {
    return Response.json({ ok: true });
  }

  const user = await getOptionalUser();

  if (!user) {
    return NextResponse.json({ authenticated: false, scheduleItemIds: [], festivalIds: [], reminders: {} }, { status: 401 });
  }

  const state = await getPlanStateByUser();
  return NextResponse.json({ authenticated: true, ...state });
}
