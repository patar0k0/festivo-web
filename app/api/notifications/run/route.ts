import { NextResponse } from "next/server";
import { processDueNotificationJobs } from "@/lib/notifications/processDueJobs";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const expectedSecret = process.env.JOBS_SECRET;
  const providedSecret = request.headers.get("x-job-secret");
  const isCron = request.headers.get("x-vercel-cron");

  if (!isCron && (!expectedSecret || providedSecret !== expectedSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
  }

  const supabase = createSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: lockRows, error: lockError } = await supabase
    .from("cron_locks")
    .upsert({ name: "notifications_run", locked_at: now }, { onConflict: "name", ignoreDuplicates: true })
    .select("name");

  if (lockError) {
    return NextResponse.json({ error: lockError.message }, { status: 500 });
  }

  if (!lockRows?.length) {
    return NextResponse.json({ skipped: true, reason: "lock_active" });
  }

  try {
    const result = await processDueNotificationJobs(supabase, 50);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await supabase.from("cron_locks").delete().eq("name", "notifications_run");
  }
}
