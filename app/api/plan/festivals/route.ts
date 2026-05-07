import { NextResponse } from "next/server";
import {
  nextResponseForRequireActiveUserError,
  requireActiveUserWithSupabase,
} from "@/lib/auth/requireActiveUser";
import { syncReminderJobsForPreference } from "@/lib/notifications/triggers";
import { isFestivalPast } from "@/lib/festival/isFestivalPast";
import { parseDefaultPlanReminderType } from "@/lib/plan/planReminderDefault";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function planJsonError(message: string, status: number) {
  return NextResponse.json({ error: message, message }, { status });
}

type Payload = {
  festivalId?: string;
  festival_id?: string;
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
      console.error("[plan festivals GET] supabase", { userId: user.id, message: error.message, code: error.code });
      return NextResponse.json({ error: error.message, message: error.message }, { status: 500 });
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
  let supabase;
  let user;
  try {
    const ctx = await requireActiveUserWithSupabase(request);
    supabase = ctx.supabase;
    user = ctx.user;
  } catch (e) {
    const authRes = nextResponseForRequireActiveUserError(e, (msg) => ({ error: msg, message: msg }));
    if (authRes) return authRes;
    console.error("[plan save] requireActiveUser unexpected", e);
    return planJsonError("Internal error", 500);
  }

  let body: Payload;
  try {
    body = (await request.json()) as Payload;
  } catch {
    console.error("[plan save] invalid JSON body");
    return planJsonError("Invalid JSON body", 400);
  }

  const festivalIdRaw = body.festivalId ?? body.festival_id;
  const festivalId = typeof festivalIdRaw === "string" ? festivalIdRaw.trim() : "";

  console.log("[plan save] request", { userId: user.id, festivalId: festivalId || null, hasBody: Boolean(body) });

  if (!festivalId) {
    return planJsonError("Missing festivalId", 400);
  }

  if (!isValidUuid(festivalId)) {
    console.error("[plan save] invalid festivalId format", { userId: user.id });
    return planJsonError("Invalid festivalId", 400);
  }

  const { data: existing, error: existingError } = await supabase
    .from("user_plan_festivals")
    .select("festival_id")
    .eq("user_id", user.id)
    .eq("festival_id", festivalId)
    .maybeSingle();

  if (existingError) {
    console.error("[plan save] existing lookup failed", {
      userId: user.id,
      festivalId,
      message: existingError.message,
      code: existingError.code,
    });
    return planJsonError(existingError.message, 500);
  }

  if (existing) {
    const { error: deleteError } = await supabase
      .from("user_plan_festivals")
      .delete()
      .eq("user_id", user.id)
      .eq("festival_id", festivalId);

    if (deleteError) {
      console.error("[plan save] delete failed", {
        userId: user.id,
        festivalId,
        message: deleteError.message,
        code: deleteError.code,
      });
      return planJsonError(deleteError.message, 500);
    }

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
    console.error("[plan save] festival lookup failed", {
      userId: user.id,
      festivalId,
      message: festivalError.message,
      code: festivalError.code,
    });
    return planJsonError(festivalError.message, 500);
  }

  if (!festival) {
    return planJsonError("Festival not found", 404);
  }

  if (isFestivalPast(festival)) {
    return planJsonError("Cannot add past festival to plan", 400);
  }

  const { error: insertError } = await supabase.from("user_plan_festivals").insert({
    user_id: user.id,
    festival_id: festivalId,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      console.error("[plan save] duplicate insert treated as idempotent save", { userId: user.id, festivalId });
    } else if (insertError.code === "23503") {
      console.error("[plan save] FK violation on insert", { userId: user.id, festivalId, message: insertError.message });
      return planJsonError("Festival not found", 404);
    } else {
      console.error("[plan save] insert failed", {
        userId: user.id,
        festivalId,
        message: insertError.message,
        code: insertError.code,
      });
      return planJsonError(insertError.message, 500);
    }
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
        reminder_type: "default",
      },
      { onConflict: "user_id,festival_id" },
    );
    if (upsertRemErr) {
      console.warn("[plan/festivals] user_plan_reminders upsert", upsertRemErr.message);
    }
    void syncReminderJobsForPreference(user.id, festivalId, "default").catch((err) =>
      console.warn("[notifications] syncReminderJobsForPreference", err),
    );
  }

  return NextResponse.json({ saved: true });
}
