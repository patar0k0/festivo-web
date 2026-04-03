import { NextResponse } from "next/server";
import {
  applyReminderTypeToAllSavedFestivals,
  getSavedReminderTimingSummary,
} from "@/lib/plan/applyReminderToSavedFestivals";
import { ReminderType } from "@/lib/plan/server";
import { syncReminderJobsForPreference } from "@/lib/notifications/triggers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Payload = {
  festivalId?: string;
  reminderType?: ReminderType;
  applyToAllSaved?: boolean;
};

const allowed = new Set<ReminderType>(["none", "24h", "same_day_09"]);

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await getSavedReminderTimingSummary(user.id, supabase);
  if ("error" in summary) {
    return NextResponse.json({ error: summary.error }, { status: 500 });
  }

  return NextResponse.json(summary);
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as Payload;
  const reminderType = body.reminderType;
  const applyToAllSaved = body.applyToAllSaved === true;
  const festivalId = body.festivalId;

  if (!reminderType || !allowed.has(reminderType)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (applyToAllSaved) {
    const result = await applyReminderTypeToAllSavedFestivals(user.id, reminderType, supabase);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      reminderType,
      applyToAllSaved: true,
      festivalCount: result.festivalCount,
    });
  }

  if (!festivalId) {
    return NextResponse.json({ error: "Missing festivalId" }, { status: 400 });
  }

  if (reminderType === "none") {
    const { error } = await supabase
      .from("user_plan_reminders")
      .delete()
      .eq("user_id", user.id)
      .eq("festival_id", festivalId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const syncResult = await syncReminderJobsForPreference(user.id, festivalId, "none");
    if (!syncResult.ok) {
      return NextResponse.json({ error: syncResult.error ?? "Failed to sync reminder jobs" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, reminderType: "none" });
  }

  const { error } = await supabase
    .from("user_plan_reminders")
    .upsert(
      {
        user_id: user.id,
        festival_id: festivalId,
        reminder_type: reminderType,
      },
      { onConflict: "user_id,festival_id" },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const syncResult = await syncReminderJobsForPreference(user.id, festivalId, reminderType);
  if (!syncResult.ok) {
    return NextResponse.json({ error: syncResult.error ?? "Failed to sync reminder jobs" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, reminderType });
}
