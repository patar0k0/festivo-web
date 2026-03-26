import { NextResponse } from "next/server";
import { isAuthorizedJobRequest } from "@/lib/jobs/auth";
import { acquireCronLock, releaseCronLock } from "@/lib/jobs/locks";
import { processDueNotificationJobs } from "@/lib/notifications/processDueJobs";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  if (!isAuthorizedJobRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
  }

  const supabase = createSupabaseAdmin();
  const now = new Date();
  const lockName = "notifications_run";
  const lock = await acquireCronLock(supabase, lockName, now, 10);
  if (!lock.ok && lock.reason === "lock_active") {
    return NextResponse.json({ skipped: true, reason: "lock_active" });
  }
  if (!lock.ok) {
    return NextResponse.json({ error: lock.message }, { status: 500 });
  }

  console.info("[jobs][notifications_run] started");

  try {
    const result = await processDueNotificationJobs(supabase, 75);
    console.info("[jobs][notifications_run] finished", result);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[jobs][notifications_run] error", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await releaseCronLock(supabase, lockName);
  }
}
