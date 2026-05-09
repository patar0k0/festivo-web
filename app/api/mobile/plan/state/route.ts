import { NextResponse } from "next/server";
import { mobileAuthErrorResponse, resolveMobileRequestAuth } from "@/lib/api/mobile/resolveMobileAuth";
import {
  buildMobilePlanSnapshot,
  normalizeReminderRecord,
  type MobilePlanReminderDto,
  type MobilePlanStateDto,
} from "@/lib/api/mobile/planSerialization";
import { loadMobilePlannerBundle } from "@/lib/plan/queries";
import { logPlannerEvent } from "@/lib/plan/plannerLog";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const startedAt = Date.now();
  let authed = false;

  try {
    const auth = await resolveMobileRequestAuth(request);
    const authErr = mobileAuthErrorResponse(auth);
    if (authErr) return authErr;
    if (!auth.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    authed = true;

    const bundle = await loadMobilePlannerBundle(auth.supabase, auth.user.id, { authed: true, startedAt });

    const reminders: Record<string, MobilePlanReminderDto> = {};
    for (const row of bundle.reminderRows) {
      try {
        const normalized = normalizeReminderRecord(row.festival_id, row.reminder_type, null);
        if (!normalized) continue;
        const [key, value] = normalized;
        reminders[key] = value;
      } catch {
        // skip bad row
      }
    }

    let body: MobilePlanStateDto;
    try {
      body = buildMobilePlanSnapshot({
        savedFestivalIds: bundle.savedFestivalIds,
        savedScheduleItemIds: bundle.savedScheduleItemIds,
        reminders,
        stats: bundle.stats,
        updatedAtCandidates: bundle.updatedAtCandidates,
        partialFailures: bundle.partialFailures,
      });
    } catch (e) {
      logPlannerEvent({
        event: "planner_state_failed",
        authed,
        duration_ms: Date.now() - startedAt,
        phase: "serialization",
        err: e instanceof Error ? e.name : "unknown",
      });
      return NextResponse.json({ error: "Failed to load plan state" }, { status: 500 });
    }

    const duration_ms = Date.now() - startedAt;
    const degraded = bundle.degradedSlices;
    if (degraded.length) {
      logPlannerEvent({
        event: "planner_state_partial",
        authed,
        duration_ms,
        rows: bundle.rowCounts,
        degraded,
        snapshot_revision: bundle.snapshotRevision,
      });
    } else {
      logPlannerEvent({
        event: "planner_state_success",
        authed,
        duration_ms,
        rows: bundle.rowCounts,
        snapshot_revision: bundle.snapshotRevision,
      });
    }

    return NextResponse.json(body);
  } catch (error) {
    console.error("[mobile/plan/state] fatal", error);
    logPlannerEvent({
      event: "planner_state_failed",
      authed,
      duration_ms: Date.now() - startedAt,
      phase: "handler",
      err: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ error: "Failed to load plan state" }, { status: 500 });
  }
}
