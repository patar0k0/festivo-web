import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isAuthorizedJobRequest } from "@/lib/jobs/auth";
import { listUserSweepRetryBatch } from "@/lib/admin/userSweepRetryQueue";
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
  let ids: string[];
  try {
    ids = await listUserSweepRetryBatch(admin, BATCH);
  } catch (e) {
    const message = e instanceof Error ? e.message : "list failed";
    console.error("[jobs][user_sweep_retry] list error", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (ids.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, message: "queue empty" });
  }

  console.info("[jobs][user_sweep_retry] started", { count: ids.length });

  const ok: string[] = [];
  const failed: Array<{ user_id: string; error: string }> = [];

  for (const userId of ids) {
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
    }
  }

  console.info("[jobs][user_sweep_retry] finished", { ok: ok.length, failed: failed.length });
  return NextResponse.json({ ok: true, processed: ok.length, failed });
}
