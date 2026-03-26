import { NextResponse } from "next/server";
import { isAuthorizedJobRequest } from "@/lib/jobs/auth";
import { acquireCronLock, releaseCronLock } from "@/lib/jobs/locks";
import { scheduleWeekendNearbyJobs, type WeekendRunSlot } from "@/lib/notifications/triggers";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slot: string }> },
) {
  if (!isAuthorizedJobRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
  }

  const { slot } = await params;

  if (slot !== "fri_18" && slot !== "sat_09") {
    return NextResponse.json({ error: "Invalid slot (use fri_18 or sat_09)" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const now = new Date();
  const lockName = `notifications_weekend_${slot}`;
  const lock = await acquireCronLock(supabase, lockName, now, 60);
  if (!lock.ok && lock.reason === "lock_active") {
    return NextResponse.json({ skipped: true, reason: "lock_active" });
  }
  if (!lock.ok) {
    return NextResponse.json({ error: lock.message }, { status: 500 });
  }

  console.info("[jobs][weekend_trigger] started", { slot });
  try {
    const result = await scheduleWeekendNearbyJobs(slot as WeekendRunSlot);
    console.info("[jobs][weekend_trigger] finished", { slot, ...result });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[jobs][weekend_trigger] error", { slot, message });
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await releaseCronLock(supabase, lockName);
  }
}
