import { NextResponse } from "next/server";

import { processDueEmailJobs } from "@/lib/email/processEmailJobs";
import { isAuthorizedJobRequest } from "@/lib/jobs/auth";
import { acquireCronLock, releaseCronLock } from "@/lib/jobs/locks";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAuthorizedJobRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
  }

  const supabase = createSupabaseAdmin();
  const now = new Date();
  const lockName = "email_jobs_run";
  const lock = await acquireCronLock(supabase, lockName, now, 10);
  if (!lock.ok && lock.reason === "lock_active") {
    return NextResponse.json({ skipped: true, reason: "lock_active" });
  }
  if (!lock.ok) {
    return NextResponse.json({ error: lock.message }, { status: 500 });
  }

  console.info("[jobs][email_jobs] started");

  try {
    const result = await processDueEmailJobs(supabase, 15);
    console.info("[jobs][email_jobs] finished", result);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[jobs][email_jobs] error", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await releaseCronLock(supabase, lockName);
  }
}
