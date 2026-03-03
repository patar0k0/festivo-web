import { NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/authUser";
import { getPlanStateByUser } from "@/lib/plan/server";

export async function GET() {
  const user = await getOptionalUser();

  if (!user) {
    return NextResponse.json({ authenticated: false, scheduleItemIds: [], festivalIds: [], reminders: {} }, { status: 401 });
  }

  const state = await getPlanStateByUser();
  return NextResponse.json({ authenticated: true, ...state });
}
