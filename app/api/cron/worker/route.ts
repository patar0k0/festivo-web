import { NextResponse } from "next/server";
import { isAuthorizedJobRequest } from "@/lib/jobs/auth";
import { acquireCronLock, releaseCronLock } from "@/lib/jobs/locks";
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

async function maybeRunCleanup(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  baseUrl: string,
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

  const sweepRes = await fetch(`${baseUrl}/api/jobs/user-sweep-retry`, {
    headers: { "x-job-secret": process.env.JOBS_SECRET! },
    cache: "no-store",
  });
  const sweepBody = await readJsonResponse(sweepRes);
  if (!sweepRes.ok) {
    console.error("[cron/worker] user-sweep-retry failed", sweepRes.status, sweepBody);
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

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
  }

  if (!process.env.JOBS_SECRET) {
    return NextResponse.json({ error: "JOBS_SECRET is not set" }, { status: 500 });
  }

  const supabase = createSupabaseAdmin();
  const now = new Date();
  const baseUrl = getWorkerJobBaseUrl(request);

  const [notifRes, emailRes] = await Promise.all([
    fetch(`${baseUrl}/api/notifications/run`, {
      headers: { "x-job-secret": process.env.JOBS_SECRET! },
      cache: "no-store",
    }),
    fetch(`${baseUrl}/api/jobs/email`, {
      headers: { "x-job-secret": process.env.JOBS_SECRET! },
      cache: "no-store",
    }),
  ]);

  const notifResult = await readJsonResponse(notifRes);
  const emailResult = await readJsonResponse(emailRes);
  if (!notifRes.ok) {
    console.error("[cron/worker] notifications/run failed", notifRes.status, notifResult);
  }
  if (!emailRes.ok) {
    console.error("[cron/worker] email failed", emailRes.status, emailResult);
  }

  const remindersRes = await fetch(`${baseUrl}/api/jobs/reminders`, {
    headers: { "x-job-secret": process.env.JOBS_SECRET! },
    cache: "no-store",
  });
  const remindersBody = await readJsonResponse(remindersRes);
  if (!remindersRes.ok) {
    console.error("[cron/worker] reminders failed", remindersRes.status, remindersBody);
  }

  const pushRes = await fetch(`${baseUrl}/api/jobs/push`, {
    headers: { "x-job-secret": process.env.JOBS_SECRET! },
    cache: "no-store",
  });
  const pushBody = await readJsonResponse(pushRes);
  if (!pushRes.ok) {
    console.error("[cron/worker] push failed", pushRes.status, pushBody);
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

  const cleanup = await maybeRunCleanup(supabase, baseUrl, now);

  const subtasksOk =
    notifRes.ok &&
    emailRes.ok &&
    remindersRes.ok &&
    pushRes.ok &&
    (!cleanup.ran || cleanup.ok !== false);

  return NextResponse.json({
    ok: subtasksOk,
    notifications_run: notifResult,
    email_jobs: emailResult,
    reminders: remindersBody,
    reminders_http_ok: remindersRes.ok,
    push: pushBody,
    push_http_ok: pushRes.ok,
    weekend,
    cleanup,
  });
}
