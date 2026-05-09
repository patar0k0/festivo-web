import { NextResponse } from "next/server";
import { mobileAuthErrorResponse, resolveMobileRequestAuth } from "@/lib/api/mobile/resolveMobileAuth";
import { getFestivalTemporalState } from "@/lib/festival/temporal";
import { syncReminderJobsForPreference } from "@/lib/notifications/triggers";
import { normalizeReminderType } from "@/lib/api/mobile/planSerialization";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Payload = {
  festivalId?: string;
  type?: "none" | "24h" | "same_day_09" | "default";
};

type FestivalTemporalRow = {
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  occurrence_dates: string[] | null;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const auth = await resolveMobileRequestAuth(request);
    const authErr = mobileAuthErrorResponse(auth);
    if (authErr) return authErr;
    if (!auth.user) return jsonError("Unauthorized", 401);

    let body: Payload;
    try {
      body = (await request.json()) as Payload;
    } catch {
      return jsonError("Invalid JSON body", 400);
    }

    const festivalId = typeof body.festivalId === "string" ? body.festivalId.trim() : "";
    if (!festivalId) return jsonError("Missing festivalId", 400);
    if (!UUID_RE.test(festivalId)) return jsonError("Invalid festivalId", 400);

    const reminderTypeRaw = typeof body.type === "string" ? body.type : "";
    const reminderType = normalizeReminderType(reminderTypeRaw);
    if (!["none", "24h", "same_day_09", "default"].includes(reminderTypeRaw)) {
      return jsonError("Invalid reminder type", 400);
    }

    if (reminderType !== "none") {
      const { data: festival, error: festivalError } = await auth.supabase
        .from("festivals")
        .select("start_date,end_date,start_time,end_time,occurrence_dates")
        .eq("id", festivalId)
        .maybeSingle<FestivalTemporalRow>();

      if (festivalError) return jsonError(festivalError.message, 500);
      if (!festival) return jsonError("Festival not found", 404);
      if (getFestivalTemporalState(festival) === "past") {
        return jsonError("Cannot set reminder for past festival", 400);
      }
    }

    if (reminderType === "none") {
      const { error: deleteError } = await auth.supabase
        .from("user_plan_reminders")
        .delete()
        .eq("user_id", auth.user.id)
        .eq("festival_id", festivalId);
      if (deleteError) return jsonError(deleteError.message, 500);
    } else {
      const { error: upsertError } = await auth.supabase.from("user_plan_reminders").upsert(
        {
          user_id: auth.user.id,
          festival_id: festivalId,
          reminder_type: reminderType,
        },
        { onConflict: "user_id,festival_id" },
      );
      if (upsertError) return jsonError(upsertError.message, 500);
    }

    const syncResult = await syncReminderJobsForPreference(auth.user.id, festivalId, reminderType);
    if (!syncResult.ok) {
      return jsonError(syncResult.error ?? "Failed to sync reminders", 500);
    }

    return NextResponse.json({ ok: true, festivalId, type: reminderType });
  } catch (error) {
    console.error("[api/mobile/plan/reminders]", error);
    const message = error instanceof Error ? error.message : "Failed to update reminder";
    return jsonError(message, 500);
  }
}
