import { NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/authUser";
import { getPlanStateByUser } from "@/lib/plan/server";

export async function GET() {
  const user = await getOptionalUser();

  if (!user) {
    return NextResponse.json({ authenticated: false, scheduleItemIds: [], reminders: {} });
  }

  const state = await getPlanStateByUser(user.id);
  return NextResponse.json({ authenticated: true, ...state });
}
