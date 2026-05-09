import { NextResponse } from "next/server";
import { mobileAuthErrorResponse, resolveMobileRequestAuth } from "@/lib/api/mobile/resolveMobileAuth";
import { getFestivalTemporalState } from "@/lib/festival/temporal";
import {
  buildMobilePlanSnapshot,
  normalizeReminderRecord,
  type MobilePlanReminderDto,
  type MobilePlanStateDto,
} from "@/lib/api/mobile/planSerialization";

export const dynamic = "force-dynamic";

const LOG_TAG = "[mobile/plan/state]";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PlanFestivalRow = {
  festival_id: string | null | undefined;
  created_at?: string | null;
};

type PlanItemRow = {
  schedule_item_id: string | null | undefined;
};

type PlanReminderRow = {
  festival_id: string | null | undefined;
  reminder_type: string | null;
};

type SavedFestivalDateRow = {
  id: string;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  occurrence_dates: string[] | null;
};

function logQueryFailure(which: string, message: string) {
  console.warn(`${LOG_TAG} query_failed which=${which} msg=${message}`);
}

function asStableId(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  return s || null;
}

function emptyPlanResponse() {
  return NextResponse.json(
    buildMobilePlanSnapshot({
      savedFestivalIds: [],
      savedScheduleItemIds: [],
      reminders: {},
      stats: {
        savedFestivalCount: 0,
        plannedItemCount: 0,
        upcomingCount: 0,
      },
      updatedAtCandidates: [],
    }),
  );
}

export async function GET(request: Request) {
  let authedUser = false;
  try {
    const auth = await resolveMobileRequestAuth(request);
    const authErr = mobileAuthErrorResponse(auth);
    if (authErr) return authErr;
    if (!auth.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    authedUser = true;

    try {
      const [savedFestivalRes, savedItemRes, remindersRes] = await Promise.all([
        auth.supabase.from("user_plan_festivals").select("festival_id,created_at").eq("user_id", auth.user.id),
        auth.supabase.from("user_plan_items").select("schedule_item_id").eq("user_id", auth.user.id),
        auth.supabase.from("user_plan_reminders").select("festival_id,reminder_type").eq("user_id", auth.user.id),
      ]);

      const savedFestivalRows: PlanFestivalRow[] = (() => {
        if (savedFestivalRes.error) {
          logQueryFailure("user_plan_festivals", savedFestivalRes.error.message);
          return [];
        }
        return (savedFestivalRes.data ?? []) as PlanFestivalRow[];
      })();

      const savedItemRows: PlanItemRow[] = (() => {
        if (savedItemRes.error) {
          logQueryFailure("user_plan_items", savedItemRes.error.message);
          return [];
        }
        return (savedItemRes.data ?? []) as PlanItemRow[];
      })();

      const reminderRows: PlanReminderRow[] = (() => {
        if (remindersRes.error) {
          logQueryFailure("user_plan_reminders", remindersRes.error.message);
          return [];
        }
        return (remindersRes.data ?? []) as PlanReminderRow[];
      })();

      console.info(
        `${LOG_TAG} rows festivals=${savedFestivalRows.length} items=${savedItemRows.length} reminders=${reminderRows.length} authed=${authedUser}`,
      );

      const savedFestivalIds = [
        ...new Set(
          savedFestivalRows.map((row) => asStableId(row.festival_id)).filter((id): id is string => Boolean(id)),
        ),
      ];
      const savedScheduleItemIds = [
        ...new Set(
          savedItemRows.map((row) => asStableId(row.schedule_item_id)).filter((id): id is string => Boolean(id)),
        ),
      ];

      const festivalIdsForTemporal = savedFestivalIds.filter((id) => UUID_RE.test(id));

      let upcomingCount = 0;
      if (festivalIdsForTemporal.length) {
        const { data: savedFestivalDates, error: savedFestivalDatesError } = await auth.supabase
          .from("festivals")
          .select("id,start_date,end_date,start_time,end_time,occurrence_dates")
          .in("id", festivalIdsForTemporal);

        if (savedFestivalDatesError) {
          logQueryFailure("festivals_temporal", savedFestivalDatesError.message);
        } else {
          for (const festival of (savedFestivalDates ?? []) as SavedFestivalDateRow[]) {
            try {
              if (!festival?.id) continue;
              const state = getFestivalTemporalState(festival);
              if (state === "upcoming" || state === "ongoing") {
                upcomingCount += 1;
              }
            } catch (e) {
              console.warn(`${LOG_TAG} temporal_skip msg=${e instanceof Error ? e.message : "unknown"}`);
            }
          }
        }
      }

      const reminders: Record<string, MobilePlanReminderDto> = {};
      for (const row of reminderRows) {
        try {
          const normalized = normalizeReminderRecord(row.festival_id, row.reminder_type, null);
          if (!normalized) continue;
          const [key, value] = normalized;
          reminders[key] = value;
        } catch (e) {
          console.warn(`${LOG_TAG} reminder_row_skip msg=${e instanceof Error ? e.message : "unknown"}`);
        }
      }

      let body: MobilePlanStateDto;
      try {
        body = buildMobilePlanSnapshot({
          savedFestivalIds,
          savedScheduleItemIds,
          reminders,
          stats: {
            savedFestivalCount: savedFestivalIds.length,
            plannedItemCount: savedScheduleItemIds.length,
            upcomingCount,
          },
          updatedAtCandidates: [...savedFestivalRows.map((row) => row.created_at ?? null)],
        });
      } catch (e) {
        console.error(`${LOG_TAG} serialization_failed msg=${e instanceof Error ? e.message : "unknown"}`);
        return emptyPlanResponse();
      }

      return NextResponse.json(body);
    } catch (inner) {
      console.error(`${LOG_TAG} handler_error`, inner);
      return emptyPlanResponse();
    }
  } catch (error) {
    console.error(`${LOG_TAG} fatal`, error);
    const message = error instanceof Error ? error.message : "Failed to load plan state";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
