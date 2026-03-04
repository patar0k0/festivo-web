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

function parseStartDate(dateValue: string): Date {
  const [year, month, day] = dateValue.split("-").map((part) => Number(part));
  return new Date(Date.UTC(year, month - 1, day, LOCAL_REMINDER_HOUR, 0, 0));
}

function getScheduledFor(startDateValue: string, reminderType: ReminderType): Date {
  const localStart = parseStartDate(startDateValue);

  if (reminderType === "24h") {
    return new Date(localStart.getTime() - 24 * 60 * 60 * 1000);
  }

  return localStart;
}

export async function GET(request: Request) {
  const expectedSecret = process.env.JOBS_SECRET;
  const providedSecret = request.headers.get("x-job-secret");

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lookaheadMinutes = Number(process.env.REMINDER_LOOKAHEAD_MINUTES ?? DEFAULT_LOOKAHEAD_MINUTES);
  const now = new Date();
  const windowEnd = new Date(now.getTime() + lookaheadMinutes * 60 * 1000);

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
  }

  const supabase = createSupabaseAdmin();
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

      const scheduledFor = getScheduledFor(festival.start_date, row.reminder_type);
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
}
