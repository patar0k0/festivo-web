import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isAuthorizedJobRequest } from "@/lib/jobs/auth";
import { acquireCronLock, releaseCronLock } from "@/lib/jobs/locks";
import {
  claimUserSweepRetryBatch,
  getUserSweepRetryQueueStats,
  recordUserSweepRetryFailure,
} from "@/lib/admin/userSweepRetryQueue";
import { postAuthUserSweep } from "@/lib/admin/postAuthUserSweep";
import { retryPendingBanSync } from "@/lib/admin/syncUserBannedUntil";

export const runtime = "nodejs";

const BATCH = 40;
const SWEEP_LOCK_TTL_MINUTES = 3;

async function runBanSyncRetry(admin: ReturnType<typeof createSupabaseAdmin>): Promise<void> {
  try {
    const banResynced = await retryPendingBanSync(admin, 50);
    if (banResynced > 0) {
      console.info("[jobs][user_sweep_retry] ban sync retry", { banResynced });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "ban sync retry failed";
    console.error("[jobs][user_sweep_retry] ban sync retry error", { message });
  }
}

async function runSweepRetry(
  admin: ReturnType<typeof createSupabaseAdmin>,
): Promise<{ processed: number; failed: Array<{ user_id: string; error: string }> }> {
  let claimed: Awaited<ReturnType<typeof claimUserSweepRetryBatch>>;
  try {
    claimed = await claimUserSweepRetryBatch(admin, BATCH);
  } catch (e) {
    const message = e instanceof Error ? e.message : "claim failed";
    console.error("[jobs][user_sweep_retry] claim error", { message });
    throw new Error(message);
  }

  if (claimed.length === 0) {
    return { processed: 0, failed: [] };
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
        authUserExistedBeforeSweep: row.seen_in_auth_before,
      });
      ok.push(userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "sweep failed";
      console.error("[jobs][user_sweep_retry] sweep failed", { userId, message });
      failed.push({ user_id: userId, error: message });
      try {
        await recordUserSweepRetryFailure(admin, userId, attemptsBeforeRun, row.seen_in_auth_before);
      } catch (recErr) {
        const recMsg = recErr instanceof Error ? recErr.message : String(recErr);
        console.error("[jobs][user_sweep_retry] record failure error", { userId, message: recMsg });
      }
    }
  }

  console.info("[jobs][user_sweep_retry] finished", { ok: ok.length, failed: failed.length });
  return { processed: ok.length, failed };
}

export async function GET(request: Request) {
  if (!isAuthorizedJobRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
  }

  const admin = createSupabaseAdmin();
  const lockName = "user_sweep_retry";
  const lock = await acquireCronLock(admin, lockName, new Date(), SWEEP_LOCK_TTL_MINUTES);
  if (!lock.ok && lock.reason === "lock_active") {
    return NextResponse.json({ skipped: true, reason: "lock_active" });
  }
  if (!lock.ok) {
    return NextResponse.json({ error: lock.message }, { status: 500 });
  }

  try {
    await runBanSyncRetry(admin);
    const sweep = await runSweepRetry(admin);

    try {
      const stats = await getUserSweepRetryQueueStats(admin);
      console.info("[jobs][user_sweep_retry] queue stats", stats);
      if (sweep.processed === 0 && sweep.failed.length === 0) {
        return NextResponse.json({ ok: true, processed: 0, message: "queue empty or nothing due", stats });
      }
      return NextResponse.json({ ok: true, processed: sweep.processed, failed: sweep.failed, stats });
    } catch (statsErr) {
      const message = statsErr instanceof Error ? statsErr.message : String(statsErr);
      console.error("[jobs][user_sweep_retry] queue stats error", { message });
      if (sweep.processed === 0 && sweep.failed.length === 0) {
        return NextResponse.json({ ok: true, processed: 0, message: "queue empty or nothing due" });
      }
      return NextResponse.json({ ok: true, processed: sweep.processed, failed: sweep.failed });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "job failed";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await releaseCronLock(admin, lockName, lock.ok ? lock.lockToken : undefined);
  }
}
