import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isAuthorizedJobRequest } from "@/lib/jobs/auth";
import { claimUserSweepRetryBatch, recordUserSweepRetryFailure } from "@/lib/admin/userSweepRetryQueue";
import { postAuthUserSweep } from "@/lib/admin/postAuthUserSweep";

export const runtime = "nodejs";

const BATCH = 40;

export async function GET(request: Request) {
  if (!isAuthorizedJobRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
  }

  const admin = createSupabaseAdmin();
  let claimed: Awaited<ReturnType<typeof claimUserSweepRetryBatch>>;
  try {
    claimed = await claimUserSweepRetryBatch(admin, BATCH);
  } catch (e) {
    const message = e instanceof Error ? e.message : "claim failed";
    console.error("[jobs][user_sweep_retry] claim error", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (claimed.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, message: "queue empty or nothing due" });
  }

  console.info("[jobs][user_sweep_retry] started", { count: claimed.length });

  const ok: string[] = [];
  const failed: Array<{ user_id: string; error: string }> = [];

  for (const row of claimed) {
    const userId = row.user_id;
    const attemptsBeforeRun = row.attempts;
    try {
      await postAuthUserSweep(admin, userId, {
        label: "cron_user_sweep_retry",
        userId,
        authUserExistedBeforeSweep: false,
      });
      ok.push(userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "sweep failed";
      console.error("[jobs][user_sweep_retry] sweep failed", { userId, message });
      failed.push({ user_id: userId, error: message });
      try {
        await recordUserSweepRetryFailure(admin, userId, attemptsBeforeRun);
      } catch (recErr) {
        const recMsg = recErr instanceof Error ? recErr.message : String(recErr);
        console.error("[jobs][user_sweep_retry] record failure error", { userId, message: recMsg });
      }
    }
  }

  console.info("[jobs][user_sweep_retry] finished", { ok: ok.length, failed: failed.length });
  return NextResponse.json({ ok: true, processed: ok.length, failed });
}
