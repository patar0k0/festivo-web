import { NextResponse } from "next/server";
import { mobileAuthErrorResponse, resolveMobileRequestAuth } from "@/lib/api/mobile/resolveMobileAuth";
import { getFestivalTemporalState } from "@/lib/festival/temporal";
import {
  buildMobilePlanSnapshot,
  normalizeReminderRecord,
  type MobilePlanReminderDto,
} from "@/lib/api/mobile/planSerialization";

export const dynamic = "force-dynamic";

type PlanFestivalRow = {
  festival_id: string;
  updated_at: string | null;
};

type PlanItemRow = {
  schedule_item_id: string;
  updated_at: string | null;
};

type PlanReminderRow = {
  festival_id: string;
  reminder_type: string | null;
  updated_at: string | null;
};

type SavedFestivalDateRow = {
  id: string;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  occurrence_dates: string[] | null;
};

export async function GET(request: Request) {
  try {
    const auth = await resolveMobileRequestAuth(request);
    const authErr = mobileAuthErrorResponse(auth);
    if (authErr) return authErr;
    if (!auth.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [savedFestivalRes, savedItemRes, remindersRes] = await Promise.all([
      auth.supabase.from("user_plan_festivals").select("festival_id,updated_at").eq("user_id", auth.user.id),
      auth.supabase.from("user_plan_items").select("schedule_item_id,updated_at").eq("user_id", auth.user.id),
      auth.supabase.from("user_plan_reminders").select("festival_id,reminder_type,updated_at").eq("user_id", auth.user.id),
    ]);

    if (savedFestivalRes.error) {
      throw new Error(savedFestivalRes.error.message);
    }
    if (savedItemRes.error) {
      throw new Error(savedItemRes.error.message);
    }
    if (remindersRes.error) {
      throw new Error(remindersRes.error.message);
    }

    const savedFestivalRows = (savedFestivalRes.data ?? []) as PlanFestivalRow[];
    const savedItemRows = (savedItemRes.data ?? []) as PlanItemRow[];
    const reminderRows = (remindersRes.data ?? []) as PlanReminderRow[];

    const savedFestivalIds = savedFestivalRows.map((row) => row.festival_id);
    const savedScheduleItemIds = savedItemRows.map((row) => row.schedule_item_id);

    let upcomingCount = 0;
    if (savedFestivalIds.length) {
      const { data: savedFestivalDates, error: savedFestivalDatesError } = await auth.supabase
        .from("festivals")
        .select("id,start_date,end_date,start_time,end_time,occurrence_dates")
        .in("id", savedFestivalIds);

      if (savedFestivalDatesError) {
        throw new Error(savedFestivalDatesError.message);
      }

      for (const festival of (savedFestivalDates ?? []) as SavedFestivalDateRow[]) {
        const state = getFestivalTemporalState(festival);
        if (state === "upcoming" || state === "ongoing") {
          upcomingCount += 1;
        }
      }
    }

    const reminders: Record<string, MobilePlanReminderDto> = {};
    for (const row of reminderRows) {
      const [key, value] = normalizeReminderRecord(row.festival_id, row.reminder_type, row.updated_at);
      reminders[key] = value;
    }

    const body = buildMobilePlanSnapshot({
      savedFestivalIds,
      savedScheduleItemIds,
      reminders,
      stats: {
        savedFestivalCount: savedFestivalIds.length,
        plannedItemCount: savedScheduleItemIds.length,
        upcomingCount,
      },
      updatedAtCandidates: [
        ...savedFestivalRows.map((row) => row.updated_at),
        ...savedItemRows.map((row) => row.updated_at),
        ...reminderRows.map((row) => row.updated_at),
      ],
    });

    return NextResponse.json(body);
  } catch (error) {
    console.error("[api/mobile/plan/state]", error);
    const message = error instanceof Error ? error.message : "Failed to load plan state";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
