import { NextResponse } from "next/server";
import {
  requireActiveUserWithSupabase,
} from "@/lib/auth/requireActiveUser";
import { cancelPendingReminderJobs, syncReminderJobsForPreference } from "@/lib/notifications/triggers";
import { isFestivalPast } from "@/lib/festival/isFestivalPast";
import { parseDefaultPlanReminderType } from "@/lib/plan/planReminderDefault";

type Payload = {
  festivalId?: string;
};

type SavedFestival = {
  id: string;
  slug: string;
  title: string;
  city: string;
  start_date: string;
};

type SavedFestivalRow = {
  festival: SavedFestival | SavedFestival[] | null;
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
      .eq("user_id", user.id);

    console.log('[PLAN GET] raw data:', data);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const festivals = (data ?? [])
      .map((row) => {
        const r = row as SavedFestivalRow;
        let f: SavedFestival | null = null;

        if (Array.isArray(r.festival)) {
          f = r.festival[0] ?? null;
        } else {
          f = r.festival ?? null;
        }

        if (!f) return null;

        return {
          id: f.id,
          slug: f.slug,
          title: f.title,
          city: f.city,
          start_date: f.start_date,
          festivalId: f.id,
          saved: true,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));

    console.log('[PLAN GET] mapped festivals:', festivals);

    return NextResponse.json({ festivals });
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

  const { data: existing, error: existingError } = await supabase
    .from("user_plan_festivals")
    .select("id")
    .eq("user_id", user.id)
    .eq("festival_id", festivalId)
    .maybeSingle();

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
    void syncReminderJobsForPreference(user.id, festivalId, "none").catch((err) =>
      console.warn("[notifications] syncReminderJobsForPreference", err),
    );

    return NextResponse.json({ saved: false });
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

  return NextResponse.json({ saved: true });
}
