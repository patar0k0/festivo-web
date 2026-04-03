/**
 * Legacy reminder pipeline: reads `user_plan_reminders`, writes due rows to `user_notifications` for `/api/jobs/push`.
 * Does **not** enqueue `email_jobs` and does **not** use `notification_jobs`. Saved-festival reminder **email** is
 * canonical only via `GET /api/notifications/run` on due `notification_jobs` (see `docs/notification-system.md`).
 */
import { NextResponse } from "next/server";
import { isAuthorizedJobRequest } from "@/lib/jobs/auth";
import { acquireCronLock, releaseCronLock } from "@/lib/jobs/locks";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getDateAtHourInTimeZone, getFestivalStartInstant, TZ } from "@/lib/notifications/time";

type ReminderType = "24h" | "same_day_09";

type ReminderRow = {
  user_id: string;
  festival_id: string;
  reminder_type: ReminderType;
  festivals: {
    id: string;
    title: string | null;
    start_date: string | null;
    start_time: string | null;
  } | null;
};

const DEFAULT_LOOKAHEAD_MINUTES = 10;
const LOCAL_REMINDER_HOUR = 9;

function getScheduledFor(startDateValue: string, startTime: string | null, reminderType: ReminderType): Date | null {
  const eventStart = getFestivalStartInstant(startDateValue, startTime);
  if (!eventStart) {
    return null;
  }

  if (reminderType === "24h") {
    return new Date(eventStart.getTime() - 24 * 60 * 60 * 1000);
  }

  const sameDayAtNine = getDateAtHourInTimeZone(eventStart, TZ, LOCAL_REMINDER_HOUR);
  if (!sameDayAtNine || Number.isNaN(sameDayAtNine.getTime())) {
    return null;
  }
  return sameDayAtNine;
}

export async function GET(request: Request) {
  if (!isAuthorizedJobRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lookaheadMinutes = Number(process.env.REMINDER_LOOKAHEAD_MINUTES ?? DEFAULT_LOOKAHEAD_MINUTES);
  const reminderTestMinutes = Number(process.env.REMINDER_TEST_MINUTES ?? 0);
  const isReminderTestMode = process.env.NODE_ENV === "development" && reminderTestMinutes > 0;
  const now = new Date();
  const windowEnd = new Date(now.getTime() + lookaheadMinutes * 60 * 1000);

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
  }

  const supabase = createSupabaseAdmin();
  const lockName = "reminders_job";
  const lock = await acquireCronLock(supabase, lockName, now, 10);
  if (!lock.ok && lock.reason === "lock_active") {
    return NextResponse.json({ skipped: true, reason: "lock_active" });
  }
  if (!lock.ok) {
    return NextResponse.json({ error: lock.message }, { status: 500 });
  }

  console.info("[jobs][reminders] started", { lookaheadMinutes, reminderTestMinutes, isReminderTestMode });

  try {
    const { data, error } = await supabase
      .from("user_plan_reminders")
      .select("user_id,festival_id,reminder_type,festivals(id,title,start_date,start_time)")
      .in("reminder_type", ["24h", "same_day_09"]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const dueRows = (data ?? [])
      .map((row) => row as unknown as ReminderRow)
      .map((row) => {
        const festival = row.festivals;
        if (!festival?.start_date) {
          return null;
        }

        const scheduledFor = isReminderTestMode
          ? new Date(now.getTime() + reminderTestMinutes * 60 * 1000)
          : getScheduledFor(festival.start_date, festival.start_time ?? null, row.reminder_type);
        if (!scheduledFor || Number.isNaN(scheduledFor.getTime())) {
          return null;
        }

        if (scheduledFor < now || scheduledFor >= windowEnd) {
          return null;
        }

        const title = festival.title ?? "Upcoming festival reminder";
        const body = row.reminder_type === "24h" ? "Your festival starts in 24 hours." : "Your festival starts today.";

        return {
          user_id: row.user_id,
          festival_id: row.festival_id,
          type: row.reminder_type === "24h" ? "reminder_24h" : "reminder_same_day_09",
          title,
          body,
          scheduled_for: scheduledFor.toISOString(),
          sent_at: now.toISOString(),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (!dueRows.length) {
      return NextResponse.json({ created: 0, skipped: 0 });
    }

    const { data: insertedRows, error: insertError } = await supabase
      .from("user_notifications")
      .upsert(dueRows, {
        onConflict: "user_id,festival_id,type",
        ignoreDuplicates: true,
      })
      .select("id");

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const created = insertedRows?.length ?? 0;
    const skipped = dueRows.length - created;

    console.info("[jobs][reminders] finished", { created, skipped, due: dueRows.length });
    return NextResponse.json({ created, skipped });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[jobs][reminders] error", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await releaseCronLock(supabase, lockName);
  }
}
