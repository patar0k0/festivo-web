import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

type ReminderType = "24h" | "same_day_09";

type ReminderRow = {
  user_id: string;
  festival_id: string;
  reminder_type: ReminderType;
  festivals: {
    id: string;
    title: string | null;
    start_date: string | null;
  } | null;
};

const DEFAULT_LOOKAHEAD_MINUTES = 10;
const LOCAL_REMINDER_HOUR = 9;
const TZ = "Europe/Sofia";

function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number | null {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
  });
  const offsetPart = formatter.formatToParts(date).find((part) => part.type === "timeZoneName")?.value;
  if (!offsetPart) {
    return null;
  }

  if (offsetPart === "GMT") {
    return 0;
  }

  const match = offsetPart.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!match) {
    return null;
  }

  const [, sign, hours, minutes = "0"] = match;
  const totalMinutes = Number(hours) * 60 + Number(minutes);
  return sign === "+" ? totalMinutes : -totalMinutes;
}

function getDatePartsInTimeZone(date: Date, timeZone: string): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return { year, month, day };
}

function getDateAtHourInTimeZone(date: Date, timeZone: string, hour: number): Date | null {
  const { year, month, day } = getDatePartsInTimeZone(date, timeZone);
  const utcGuess = Date.UTC(year, month - 1, day, hour, 0, 0, 0);

  const firstOffsetMinutes = getTimeZoneOffsetMinutes(new Date(utcGuess), timeZone);
  if (firstOffsetMinutes === null) {
    return null;
  }

  const firstPass = utcGuess - firstOffsetMinutes * 60 * 1000;
  const secondOffsetMinutes = getTimeZoneOffsetMinutes(new Date(firstPass), timeZone);
  if (secondOffsetMinutes === null) {
    return null;
  }

  return new Date(utcGuess - secondOffsetMinutes * 60 * 1000);
}

function getScheduledFor(startDateValue: string, reminderType: ReminderType): Date | null {
  const start = new Date(startDateValue);
  if (Number.isNaN(start.getTime())) {
    return null;
  }

  const sameDayAtNine = getDateAtHourInTimeZone(start, TZ, LOCAL_REMINDER_HOUR);
  if (!sameDayAtNine || Number.isNaN(sameDayAtNine.getTime())) {
    return null;
  }

  if (reminderType === "24h") {
    if (startDateValue.includes("T")) {
      return new Date(start.getTime() - 24 * 60 * 60 * 1000);
    }

    return new Date(sameDayAtNine.getTime() - 24 * 60 * 60 * 1000);
  }

  return sameDayAtNine;
}

export async function GET(request: Request) {
  const expectedSecret = process.env.JOBS_SECRET;
  const providedSecret = request.headers.get("x-job-secret");
  const isCron = request.headers.get("x-vercel-cron");

  if (!isCron && (!expectedSecret || providedSecret !== expectedSecret)) {
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

  const lockCutoff = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const { error: staleLockError } = await supabase.from("cron_locks").delete().lt("locked_at", lockCutoff);
  if (staleLockError) {
    return NextResponse.json({ error: staleLockError.message }, { status: 500 });
  }

  const { data: lockRows, error: lockError } = await supabase
    .from("cron_locks")
    .upsert({ name: "reminders_job", locked_at: now.toISOString() }, { onConflict: "name", ignoreDuplicates: true })
    .select("name");

  if (lockError) {
    return NextResponse.json({ error: lockError.message }, { status: 500 });
  }

  if (!lockRows?.length) {
    return NextResponse.json({ skipped: true, reason: "lock_active" });
  }

  try {
    const { data, error } = await supabase
      .from("user_plan_reminders")
      .select("user_id,festival_id,reminder_type,festivals(id,title,start_date)")
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
          : getScheduledFor(festival.start_date, row.reminder_type);
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
          type: "reminder",
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
        onConflict: "user_id,festival_id,scheduled_for",
        ignoreDuplicates: true,
      })
      .select("id");

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const created = insertedRows?.length ?? 0;
    const skipped = dueRows.length - created;

    return NextResponse.json({ created, skipped });
  } finally {
    await supabase.from("cron_locks").delete().eq("name", "reminders_job");
  }
}
