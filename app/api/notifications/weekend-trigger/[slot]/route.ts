import { NextResponse } from "next/server";
import { scheduleWeekendNearbyJobs, type WeekendRunSlot } from "@/lib/notifications/triggers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slot: string }> },
) {
  const expectedSecret = process.env.JOBS_SECRET;
  const providedSecret = request.headers.get("x-job-secret");
  const isCron = request.headers.get("x-vercel-cron");

  if (!isCron && (!expectedSecret || providedSecret !== expectedSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
  }

  const { slot } = await params;

  if (slot !== "fri_18" && slot !== "sat_09") {
    return NextResponse.json({ error: "Invalid slot (use fri_18 or sat_09)" }, { status: 400 });
  }

  const result = await scheduleWeekendNearbyJobs(slot as WeekendRunSlot);
  return NextResponse.json(result);
}
