import { NextResponse } from "next/server";
import { mobileAuthErrorResponse, resolveMobileRequestAuth } from "@/lib/api/mobile/resolveMobileAuth";
import { parseDefaultPlanReminderType } from "@/lib/plan/planReminderDefault";
import { syncReminderJobsForPreference } from "@/lib/notifications/triggers";
import { getFestivalTemporalState } from "@/lib/festival/temporal";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type BodyPayload = {
  festivalId?: string;
};

type FestivalTemporalRow = {
  id: string;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  occurrence_dates: string[] | null;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function parseFestivalId(request: Request): Promise<string | Response> {
  let body: BodyPayload;
  try {
    body = (await request.json()) as BodyPayload;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const festivalId = typeof body.festivalId === "string" ? body.festivalId.trim() : "";
  if (!festivalId) return jsonError("Missing festivalId", 400);
  if (!UUID_RE.test(festivalId)) return jsonError("Invalid festivalId", 400);
  return festivalId;
}

export async function POST(request: Request) {
  try {
    const auth = await resolveMobileRequestAuth(request);
    const authErr = mobileAuthErrorResponse(auth);
    if (authErr) return authErr;
    if (!auth.user) return jsonError("Unauthorized", 401);

    const festivalIdOrResponse = await parseFestivalId(request);
    if (festivalIdOrResponse instanceof Response) return festivalIdOrResponse;
    const festivalId = festivalIdOrResponse;

    const { data: festival, error: festivalError } = await auth.supabase
      .from("festivals")
      .select("id,start_date,end_date,start_time,end_time,occurrence_dates")
      .eq("id", festivalId)
      .maybeSingle<FestivalTemporalRow>();

    if (festivalError) return jsonError(festivalError.message, 500);
    if (!festival) return jsonError("Festival not found", 404);
    if (getFestivalTemporalState(festival) === "past") {
      return jsonError("Cannot save past festival", 400);
    }

    const { error: upsertError } = await auth.supabase
      .from("user_plan_festivals")
      .upsert({ user_id: auth.user.id, festival_id: festivalId }, { onConflict: "user_id,festival_id" });

    if (upsertError) {
      if (upsertError.code === "23503") return jsonError("Festival not found", 404);
      return jsonError(upsertError.message, 500);
    }

    const { data: settingsRow, error: settingsError } = await auth.supabase
      .from("user_notification_settings")
      .select("default_plan_reminder_type")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (settingsError) {
      console.warn("[api/mobile/plan/festivals] default_plan_reminder_type", settingsError.message);
    }

    const defaultReminderType = parseDefaultPlanReminderType(settingsRow?.default_plan_reminder_type);
    if (defaultReminderType === "none") {
      const { error: deleteReminderError } = await auth.supabase
        .from("user_plan_reminders")
        .delete()
        .eq("user_id", auth.user.id)
        .eq("festival_id", festivalId);
      if (deleteReminderError) {
        console.warn("[api/mobile/plan/festivals] delete reminder", deleteReminderError.message);
      }
      const syncResult = await syncReminderJobsForPreference(auth.user.id, festivalId, "none");
      if (!syncResult.ok) {
        return jsonError(syncResult.error ?? "Failed to sync reminders", 500);
      }
    } else {
      const { error: upsertReminderError } = await auth.supabase.from("user_plan_reminders").upsert(
        {
          user_id: auth.user.id,
          festival_id: festivalId,
          reminder_type: "default",
        },
        { onConflict: "user_id,festival_id" },
      );
      if (upsertReminderError) {
        console.warn("[api/mobile/plan/festivals] upsert reminder", upsertReminderError.message);
      }
      const syncResult = await syncReminderJobsForPreference(auth.user.id, festivalId, "default");
      if (!syncResult.ok) {
        return jsonError(syncResult.error ?? "Failed to sync reminders", 500);
      }
    }

    return NextResponse.json({ saved: true, festivalId });
  } catch (error) {
    console.error("[api/mobile/plan/festivals] POST", error);
    const message = error instanceof Error ? error.message : "Failed to save festival";
    return jsonError(message, 500);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await resolveMobileRequestAuth(request);
    const authErr = mobileAuthErrorResponse(auth);
    if (authErr) return authErr;
    if (!auth.user) return jsonError("Unauthorized", 401);

    const festivalIdOrResponse = await parseFestivalId(request);
    if (festivalIdOrResponse instanceof Response) return festivalIdOrResponse;
    const festivalId = festivalIdOrResponse;

    const { error: deleteError } = await auth.supabase
      .from("user_plan_festivals")
      .delete()
      .eq("user_id", auth.user.id)
      .eq("festival_id", festivalId);

    if (deleteError) return jsonError(deleteError.message, 500);

    const syncResult = await syncReminderJobsForPreference(auth.user.id, festivalId, "none");
    if (!syncResult.ok) {
      return jsonError(syncResult.error ?? "Failed to sync reminders", 500);
    }

    return NextResponse.json({ saved: false, festivalId });
  } catch (error) {
    console.error("[api/mobile/plan/festivals] DELETE", error);
    const message = error instanceof Error ? error.message : "Failed to unsave festival";
    return jsonError(message, 500);
  }
}
