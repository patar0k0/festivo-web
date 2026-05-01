import { NextResponse } from "next/server";
import { isAuthorizedJobRequest } from "@/lib/jobs/auth";
import { acquireCronLock, releaseCronLock } from "@/lib/jobs/locks";
import { TZ } from "@/lib/notifications/time";
import { scheduleWeekendNearbyJobs, type WeekendRunSlot } from "@/lib/notifications/triggers";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const CLEANUP_MARKER = "cron_worker_cleanup_marker";
const CLEANUP_MIN_INTERVAL_MS = 60 * 60 * 1000;

type JobCallResult = {
  ok: boolean;
  status: number;
  body: unknown;
};

function getSofiaWeekdayHourMinute(now: Date): { weekday: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "-1");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "-1");
  return { weekday, hour, minute };
}

function shouldRunWeekendSlot(now: Date, slot: WeekendRunSlot): boolean {
  const { weekday, hour, minute } = getSofiaWeekdayHourMinute(now);
  if (slot === "fri_18") {
    return weekday === "Fri" && hour === 18 && minute < 5;
  }
  return weekday === "Sat" && hour === 9 && minute < 5;
}

async function readJsonResponse(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

async function maybeRunCleanup(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  callJob: (path: string) => Promise<JobCallResult>,
  now: Date,
): Promise<{ ran: boolean; ok?: boolean; body?: unknown }> {
  const { data, error } = await supabase
    .from("cron_locks")
    .select("locked_at")
    .eq("name", CLEANUP_MARKER)
    .maybeSingle();

  if (error) {
    console.error("[cron/worker] cleanup marker read failed", error);
  }

  if (data?.locked_at) {
    const age = now.getTime() - new Date(data.locked_at).getTime();
    if (age < CLEANUP_MIN_INTERVAL_MS) {
      return { ran: false };
    }
  }

  const { ok, status, body: sweepBody } = await callJob("/api/jobs/user-sweep-retry");
  if (!ok) {
    console.error("[cron/worker] user-sweep-retry failed", status, sweepBody);
    return { ran: true, ok: false, body: sweepBody };
  }

  await supabase.from("cron_locks").delete().eq("name", CLEANUP_MARKER);
  const { error: insErr } = await supabase
    .from("cron_locks")
    .insert({ name: CLEANUP_MARKER, locked_at: now.toISOString() });

  if (insErr) {
    console.error("[cron/worker] cleanup marker insert failed", insErr);
  }

  return { ran: true, ok: true, body: sweepBody };
}

export async function GET(request: Request) {
  if (!isAuthorizedJobRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.JOBS_SECRET) {
    throw new Error("Missing JOBS_SECRET");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  if (!baseUrl) {
    throw new Error("Missing base URL for cron worker");
  }

  async function callJob(path: string): Promise<JobCallResult> {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "GET",
      headers: {
        "x-job-secret": process.env.JOBS_SECRET || "",
      },
      cache: "no-store",
    });

    const body = await readJsonResponse(res);

    return {
      ok: res.ok,
      status: res.status,
      body,
    };
  }

  const supabase = createSupabaseAdmin();
  const now = new Date();

  const [notifJob, emailJob] = await Promise.all([
    callJob("/api/notifications/run"),
    callJob("/api/jobs/email"),
  ]);

  if (!notifJob.ok) {
    console.error("[cron/worker] notifications/run failed", notifJob.status, notifJob.body);
  }
  if (!emailJob.ok) {
    console.error("[cron/worker] email failed", emailJob.status, emailJob.body);
  }

  const remindersJob = await callJob("/api/jobs/reminders");
  if (!remindersJob.ok) {
    console.error("[cron/worker] reminders failed", remindersJob.status, remindersJob.body);
  }

  const pushJob = await callJob("/api/jobs/push");
  if (!pushJob.ok) {
    console.error("[cron/worker] push failed", pushJob.status, pushJob.body);
  }

  const weekend: Record<string, unknown> = {};
  for (const slot of ["fri_18", "sat_09"] as const) {
    if (!shouldRunWeekendSlot(now, slot)) {
      continue;
    }
    const lockName = `notifications_weekend_${slot}`;
    const lock = await acquireCronLock(supabase, lockName, now, 60);
    if (!lock.ok && lock.reason === "lock_active") {
      weekend[slot] = { skipped: true, reason: "lock_active" };
      continue;
    }
    if (!lock.ok) {
      weekend[slot] = { error: "message" in lock ? lock.message : "lock error" };
      continue;
    }
    try {
      weekend[slot] = await scheduleWeekendNearbyJobs(slot);
    } catch (e) {
      const message = e instanceof Error ? e.message : "unexpected";
      weekend[slot] = { error: message };
    } finally {
      await releaseCronLock(supabase, lockName, lock.ok ? lock.lockToken : undefined);
    }
  }

  const cleanup = await maybeRunCleanup(supabase, callJob, now);

  const subtasksOk =
    notifJob.ok &&
    emailJob.ok &&
    remindersJob.ok &&
    pushJob.ok &&
    (!cleanup.ran || cleanup.ok !== false);

  return NextResponse.json({
    ok: subtasksOk,
    notifications_run: notifJob.body,
    email_jobs: emailJob.body,
    reminders: remindersJob.body,
    reminders_http_ok: remindersJob.ok,
    push: pushJob.body,
    push_http_ok: pushJob.ok,
    weekend,
    cleanup,
  });
}
