import { NextResponse } from "next/server";
import { cancelPendingReminderJobs, syncReminderJobsForPreference } from "@/lib/notifications/triggers";
import { isFestivalPast } from "@/lib/festival/isFestivalPast";
import { parseDefaultPlanReminderType } from "@/lib/plan/planReminderDefault";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Payload = {
  festivalId?: string;
};

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as Payload;
  const festivalId = body.festivalId;

  if (!festivalId) {
    return NextResponse.json({ error: "Missing festivalId" }, { status: 400 });
  }

  const getExistingRow = async () =>
    supabase
      .from("user_plan_festivals")
      .select("festival_id")
      .eq("user_id", user.id)
      .eq("festival_id", festivalId)
      .maybeSingle();

  const { data: existing, error: existingError } = await getExistingRow();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (existing) {
    const { error: deleteError } = await supabase
      .from("user_plan_festivals")
      .delete()
      .eq("user_id", user.id)
      .eq("festival_id", festivalId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    void cancelPendingReminderJobs(user.id, festivalId).catch((err) =>
      console.warn("[notifications] cancelPendingReminderJobs", err),
    );

    const { data: verifyRow, error: verifyError } = await getExistingRow();
    if (verifyError) {
      return NextResponse.json({ error: verifyError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, inPlan: Boolean(verifyRow) });
  }

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
    return NextResponse.json({ error: "Cannot add past festival to plan" }, { status: 400 });
  }

  const { error: insertError } = await supabase.from("user_plan_festivals").insert({
    user_id: user.id,
    festival_id: festivalId,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const { data: nsRow, error: nsErr } = await supabase
    .from("user_notification_settings")
    .select("default_plan_reminder_type")
    .eq("user_id", user.id)
    .maybeSingle();

  if (nsErr) {
    console.warn("[plan/festivals] default_plan_reminder_type load", nsErr.message);
  }

  const defaultTiming = parseDefaultPlanReminderType(nsRow?.default_plan_reminder_type);

  if (defaultTiming === "none") {
    const { error: delRem } = await supabase
      .from("user_plan_reminders")
      .delete()
      .eq("user_id", user.id)
      .eq("festival_id", festivalId);
    if (delRem) {
      console.warn("[plan/festivals] user_plan_reminders delete", delRem.message);
    }
    void syncReminderJobsForPreference(user.id, festivalId, "none").catch((err) =>
      console.warn("[notifications] syncReminderJobsForPreference", err),
    );
  } else {
    const { error: upsertRemErr } = await supabase.from("user_plan_reminders").upsert(
      {
        user_id: user.id,
        festival_id: festivalId,
        reminder_type: defaultTiming,
      },
      { onConflict: "user_id,festival_id" },
    );
    if (upsertRemErr) {
      console.warn("[plan/festivals] user_plan_reminders upsert", upsertRemErr.message);
    }
    void syncReminderJobsForPreference(user.id, festivalId, defaultTiming).catch((err) =>
      console.warn("[notifications] syncReminderJobsForPreference", err),
    );
  }

  const { data: verifyRow, error: verifyError } = await getExistingRow();
  if (verifyError) {
    return NextResponse.json({ error: verifyError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, inPlan: Boolean(verifyRow) });
}
