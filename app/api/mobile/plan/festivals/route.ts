import { NextResponse } from "next/server";
import { mobileAuthErrorResponse, resolveMobileRequestAuth } from "@/lib/api/mobile/resolveMobileAuth";
import { parseDefaultPlanReminderType } from "@/lib/plan/planReminderDefault";
import { syncReminderJobsForPreference } from "@/lib/notifications/triggers";
import { getFestivalTemporalState } from "@/lib/festival/temporal";
import { PLANNER_TABLE_SELECT } from "@/lib/plan/queries";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

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
    if (authErr) {
      console.warn("[api/mobile/plan/festivals] POST auth rejected", { bearerMalformed: auth.bearerMalformed, hadBearer: auth.hadBearerScheme, hasUser: Boolean(auth.user) });
      return authErr;
    }
    if (!auth.user) return jsonError("Unauthorized", 401);

    const festivalIdOrResponse = await parseFestivalId(request);
    if (festivalIdOrResponse instanceof Response) return festivalIdOrResponse;
    const festivalId = festivalIdOrResponse;

    console.log("[api/mobile/plan/festivals] POST start", { userId: auth.user.id, festivalId });

    const adminDb = createSupabaseAdmin();
    const { data: festival, error: festivalError } = await adminDb
      .from("festivals")
      .select(PLANNER_TABLE_SELECT.festivalsTemporal)
      .eq("id", festivalId)
      .maybeSingle<FestivalTemporalRow>();

    if (festivalError) {
      console.error("[api/mobile/plan/festivals] festival lookup error", festivalError.message);
      return jsonError(festivalError.message, 500);
    }
    if (!festival) return jsonError("Festival not found", 404);
    if (getFestivalTemporalState(festival) === "past") {
      return jsonError("Cannot save past festival", 400);
    }

    const { error: upsertError } = await adminDb
      .from("user_plan_festivals")
      .insert({ user_id: auth.user.id, festival_id: festivalId });

    if (upsertError && upsertError.code !== "23505") {
      console.error("[api/mobile/plan/festivals] insert error", {
        code: upsertError.code,
        message: upsertError.message,
        hint: upsertError.hint,
        details: upsertError.details,
        userId: auth.user.id,
        festivalId,
      });
      if (upsertError.code === "23503") return jsonError("Festival not found", 404);
      return jsonError(upsertError.message, 500);
    }

    // Reminder sync is best-effort — a failure must not block the save response.
    const userId = auth.user.id;
    const supabaseForReminder = auth.supabase;
    void (async () => {
      try {
        const { data: settingsRow, error: settingsError } = await supabaseForReminder
          .from("user_notification_settings")
          .select("default_plan_reminder_type")
          .eq("user_id", userId)
          .maybeSingle();
        if (settingsError) {
          console.warn("[api/mobile/plan/festivals] default_plan_reminder_type", settingsError.message);
        }

        const defaultReminderType = parseDefaultPlanReminderType(settingsRow?.default_plan_reminder_type);
        if (defaultReminderType === "none") {
          const { error: deleteReminderError } = await supabaseForReminder
            .from("user_plan_reminders")
            .delete()
            .eq("user_id", userId)
            .eq("festival_id", festivalId);
          if (deleteReminderError) {
            console.warn("[api/mobile/plan/festivals] delete reminder", deleteReminderError.message);
          }
          const syncResult = await syncReminderJobsForPreference(userId, festivalId, "none");
          if (!syncResult.ok) {
            console.warn("[api/mobile/plan/festivals] reminder sync (none):", syncResult.error);
          }
        } else {
          const { error: upsertReminderError } = await supabaseForReminder.from("user_plan_reminders").upsert(
            {
              user_id: userId,
              festival_id: festivalId,
              reminder_type: "default",
            },
            { onConflict: "user_id,festival_id" },
          );
          if (upsertReminderError) {
            console.warn("[api/mobile/plan/festivals] upsert reminder", upsertReminderError.message);
          }
          const syncResult = await syncReminderJobsForPreference(userId, festivalId, "default");
          if (!syncResult.ok) {
            console.warn("[api/mobile/plan/festivals] reminder sync (default):", syncResult.error);
          }
        }
      } catch (reminderErr) {
        console.warn("[api/mobile/plan/festivals] reminder sync exception", reminderErr);
      }
    })();

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
    if (authErr) {
      console.warn("[api/mobile/plan/festivals] DELETE auth rejected", { bearerMalformed: auth.bearerMalformed, hadBearer: auth.hadBearerScheme, hasUser: Boolean(auth.user) });
      return authErr;
    }
    if (!auth.user) return jsonError("Unauthorized", 401);

    const festivalIdOrResponse = await parseFestivalId(request);
    if (festivalIdOrResponse instanceof Response) return festivalIdOrResponse;
    const festivalId = festivalIdOrResponse;

    console.log("[api/mobile/plan/festivals] DELETE start", { userId: auth.user.id, festivalId });

    const adminDb = createSupabaseAdmin();
    // `.select()` makes Supabase return the deleted rows so we can confirm
    // the delete actually matched. Without it a no-op delete (wrong user_id,
    // wrong festival_id, or RLS-filtered row) still returns 200 and the
    // mobile client wrongly believes the festival was removed.
    const { data: deletedRows, error: deleteError } = await adminDb
      .from("user_plan_festivals")
      .delete()
      .eq("user_id", auth.user.id)
      .eq("festival_id", festivalId)
      .select("festival_id");

    if (deleteError) {
      console.error("[api/mobile/plan/festivals] delete error", {
        code: deleteError.code,
        message: deleteError.message,
        hint: deleteError.hint,
        details: deleteError.details,
        userId: auth.user.id,
        festivalId,
      });
      return jsonError(deleteError.message, 500);
    }

    const deletedCount = deletedRows?.length ?? 0;
    if (deletedCount === 0) {
      // Diagnose: does the row exist under this user, or at all?
      const [{ data: forUser }, { data: anyRow }] = await Promise.all([
        adminDb
          .from("user_plan_festivals")
          .select("user_id, festival_id, created_at")
          .eq("user_id", auth.user.id)
          .eq("festival_id", festivalId)
          .limit(1),
        adminDb
          .from("user_plan_festivals")
          .select("user_id, festival_id, created_at")
          .eq("festival_id", festivalId)
          .limit(5),
      ]);
      console.warn("[api/mobile/plan/festivals] DELETE matched 0 rows", {
        userId: auth.user.id,
        festivalId,
        rowExistsForUser: (forUser?.length ?? 0) > 0,
        rowsForFestivalAnyUser: anyRow ?? [],
      });
    } else {
      console.log("[api/mobile/plan/festivals] DELETE ok", {
        userId: auth.user.id,
        festivalId,
        deletedCount,
      });
    }

    // Cancel reminders best-effort — must not block the unsave response.
    void syncReminderJobsForPreference(auth.user.id, festivalId, "none").catch((err: unknown) => {
      console.warn("[api/mobile/plan/festivals] DELETE reminder sync", err);
    });

    return NextResponse.json({ saved: false, festivalId, deletedCount });
  } catch (error) {
    console.error("[api/mobile/plan/festivals] DELETE", error);
    const message = error instanceof Error ? error.message : "Failed to unsave festival";
    return jsonError(message, 500);
  }
}
