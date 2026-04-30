import { NextResponse } from "next/server";
import { processDueEmailJobs } from "@/lib/email/processEmailJobs";
import { isAuthorizedJobRequest } from "@/lib/jobs/auth";
import { acquireCronLock, releaseCronLock } from "@/lib/jobs/locks";
import { processDueNotificationJobs } from "@/lib/notifications/processDueJobs";
import { TZ } from "@/lib/notifications/time";
import { scheduleWeekendNearbyJobs, type WeekendRunSlot } from "@/lib/notifications/triggers";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const CLEANUP_MARKER = "cron_worker_cleanup_marker";
const CLEANUP_MIN_INTERVAL_MS = 60 * 60 * 1000;

function getWorkerJobBaseUrl(request: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
  return new URL(request.url).origin;
}

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

async function internalJobGet(
  request: Request,
  path: string,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const secret = process.env.JOBS_SECRET;
  if (!secret) {
    return { ok: false, status: 0, body: { error: "JOBS_SECRET is not set" } };
  }
  const base = getWorkerJobBaseUrl(request);
  const res = await fetch(`${base}${path}`, {
    headers: { "x-job-secret": secret },
    cache: "no-store",
  });
  const body = await readJsonResponse(res);
  return { ok: res.ok, status: res.status, body };
}

async function maybeRunCleanup(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  request: Request,
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

  const sweep = await internalJobGet(request, "/api/jobs/user-sweep-retry");
  if (!sweep.ok) {
    console.error("[cron/worker] user-sweep-retry failed", sweep);
    return { ran: true, ok: false, body: sweep.body };
  }

  await supabase.from("cron_locks").delete().eq("name", CLEANUP_MARKER);
  const { error: insErr } = await supabase
    .from("cron_locks")
    .insert({ name: CLEANUP_MARKER, locked_at: now.toISOString() });

  if (insErr) {
    console.error("[cron/worker] cleanup marker insert failed", insErr);
  }

  return { ran: true, ok: true, body: sweep.body };
}

export async function GET(request: Request) {
  if (!isAuthorizedJobRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
  }

  if (!process.env.JOBS_SECRET) {
    return NextResponse.json({ error: "JOBS_SECRET is not set" }, { status: 500 });
  }

  const supabase = createSupabaseAdmin();
  const now = new Date();

  const [notifResult, emailResult] = await Promise.all([
    (async () => {
      const lockName = "notifications_run";
      const lock = await acquireCronLock(supabase, lockName, now, 10);
      if (!lock.ok && lock.reason === "lock_active") {
        return { skipped: true as const, reason: "lock_active" as const };
      }
      if (!lock.ok) {
        throw new Error("message" in lock ? lock.message : "notification lock failed");
      }
      try {
        return await processDueNotificationJobs(supabase, 75);
      } finally {
        await releaseCronLock(supabase, lockName, lock.ok ? lock.lockToken : undefined);
      }
    })(),
    (async () => {
      const lockName = "email_jobs_run";
      const lock = await acquireCronLock(supabase, lockName, now, 10);
      if (!lock.ok && lock.reason === "lock_active") {
        return { skipped: true as const, reason: "lock_active" as const };
      }
      if (!lock.ok) {
        throw new Error("message" in lock ? lock.message : "email lock failed");
      }
      try {
        return await processDueEmailJobs(supabase, 15);
      } finally {
        await releaseCronLock(supabase, lockName, lock.ok ? lock.lockToken : undefined);
      }
    })(),
  ]);

  const reminders = await internalJobGet(request, "/api/jobs/reminders");
  if (!reminders.ok) {
    console.error("[cron/worker] reminders failed", reminders);
  }

  const push = await internalJobGet(request, "/api/jobs/push");
  if (!push.ok) {
    console.error("[cron/worker] push failed", push);
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

  const cleanup = await maybeRunCleanup(supabase, request, now);

  const subtasksOk = reminders.ok && push.ok && (!cleanup.ran || cleanup.ok !== false);

  return NextResponse.json({
    ok: subtasksOk,
    notifications_run: notifResult,
    email_jobs: emailResult,
    reminders: reminders.body,
    reminders_http_ok: reminders.ok,
    push: push.body,
    push_http_ok: push.ok,
    weekend,
    cleanup,
  });
}
