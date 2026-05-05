import { NextResponse } from "next/server";
import {
  requireActiveUserWithSupabase,
} from "@/lib/auth/requireActiveUser";
import { cancelPendingReminderJobs, syncReminderJobsForPreference } from "@/lib/notifications/triggers";
import { enqueueFestivalReminder } from "@/lib/notifications/enqueueFestivalReminder";
import { isFestivalPast } from "@/lib/festival/isFestivalPast";
import { parseDefaultPlanReminderType } from "@/lib/plan/planReminderDefault";

type Payload = {
  festivalId?: string;
};

type SavedFestival = {
  id: string;
  slug: string;
  title: string;
  city: string | null;
  start_date: string | null;
};

type SavedFestivalRow = {
  festival?: SavedFestival[] | null;
};

export async function GET(request: Request) {
  try {
    const { user, supabase } = await requireActiveUserWithSupabase(request);
    console.log('[PLAN GET] user.id:', user.id);

    const { data, error } = await supabase
      .from("user_plan_festivals")
      .select(
        `
        festival:festival_id (
          id,
          slug,
          title,
          city,
          start_date
        )
      `,
      )
      .limit(10);

    console.log('[PLAN GET] raw data:', data);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      festivals: (data ?? [])
        .map((row) => (row as SavedFestivalRow).festival?.[0])
        .filter(Boolean)
        .map((festival) => ({
          ...festival,
          saved: true,
        })),
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  console.log("[AUTH] headers:", request.headers.get("authorization"));
  console.log("[AUTH] cookies:", request.headers.get("cookie"));

  let supabase;
  let user;
  try {
    const ctx = await requireActiveUserWithSupabase(request);
    supabase = ctx.supabase;
    user = ctx.user;
    console.log("[AUTH] resolved user:", user?.id);
  } catch (e) {
    console.error("[AUTH ERROR]", e);
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
  console.log('[PLAN POST] inserting user_id:', user.id);

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
  console.log("[REMINDER] verifyRow:", verifyRow);
  console.log("[REMINDER] route hit", {
    userId: user.id,
    festivalId,
  });

  if (verifyRow) {
    console.log("[REMINDER] calling enqueue");
    await enqueueFestivalReminder({
      userId: user.id,
      festivalId,
    });
  }

  await supabase.from("notification_jobs").insert({
    user_id: user.id,
    type: "debug_test",
    status: "pending",
    scheduled_at: new Date().toISOString(),
    payload: { test: true },
  });

  console.log("[REMINDER] debug insert done");

  return NextResponse.json({ ok: true, inPlan: Boolean(verifyRow) });
}
