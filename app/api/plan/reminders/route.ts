import { NextResponse } from "next/server";
import {
  nextResponseForRequireActiveUserError,
  requireActiveUserWithSupabase,
} from "@/lib/auth/requireActiveUser";
import {
  applyReminderTypeToAllSavedFestivals,
  getSavedReminderTimingSummary,
} from "@/lib/plan/applyReminderToSavedFestivals";
import { isFestivalPast } from "@/lib/festival/isFestivalPast";
import { ReminderType } from "@/lib/plan/server";
import { syncReminderJobsForPreference } from "@/lib/notifications/triggers";

type Payload = {
  festivalId?: string;
  reminderType?: ReminderType;
  applyToAllSaved?: boolean;
};

const allowed = new Set<ReminderType>(["none", "24h", "same_day_09", "default"]);

export async function GET(request: Request) {
  let supabase;
  let user;
  try {
    const ctx = await requireActiveUserWithSupabase(request);
    supabase = ctx.supabase;
    user = ctx.user;
  } catch (e) {
    const r = nextResponseForRequireActiveUserError(e);
    if (r) return r;
    console.error("[plan/reminders] GET auth", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }

  const summary = await getSavedReminderTimingSummary(user.id, supabase);
  if ("error" in summary) {
    return NextResponse.json({ error: summary.error }, { status: 500 });
  }

  return NextResponse.json(summary);
}

export async function POST(request: Request) {
  let supabase;
  let user;
  try {
    const ctx = await requireActiveUserWithSupabase(request);
    supabase = ctx.supabase;
    user = ctx.user;
  } catch (e) {
    const r = nextResponseForRequireActiveUserError(e);
    if (r) return r;
    console.error("[plan/reminders] POST auth", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
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

  if (reminderType !== "none") {
    const { data: festival, error: festivalError } = await supabase
      .from("festivals")
      .select("start_date,end_date")
      .eq("id", festivalId)
      .maybeSingle<{ start_date: string | null; end_date: string | null }>();

    if (festivalError) {
      return NextResponse.json({ error: festivalError.message }, { status: 500 });
    }

    if (!festival) {
      return NextResponse.json({ error: "Festival not found" }, { status: 404 });
    }

    if (isFestivalPast(festival)) {
      return NextResponse.json({ error: "Cannot set reminder for past festival" }, { status: 400 });
    }
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
