import { NextResponse } from "next/server";
import { mobileAuthErrorResponse, resolveMobileRequestAuth } from "@/lib/api/mobile/resolveMobileAuth";
import {
  buildMobilePlanSnapshot,
  normalizeReminderRecord,
  type MobilePlanReminderDto,
  type MobilePlanStateDto,
} from "@/lib/api/mobile/planSerialization";
import { loadMobilePlannerBundle } from "@/lib/plan/queries";
import { logError, logInfo, logWarn } from "@/lib/observability/logger";
import { attachRequestIdHeader, getOrCreateRequestId } from "@/lib/observability/requestId";
import { measureDurationMs } from "@/lib/observability/timing";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const startedPerf = performance.now();
  const startedAt = Date.now();
  let authed = false;

  const withRid = (res: Response) => attachRequestIdHeader(res, requestId);

  try {
    const auth = await resolveMobileRequestAuth(request);
    const authErr = mobileAuthErrorResponse(auth);
    if (authErr) return withRid(authErr);
    if (!auth.user) {
      return withRid(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
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
      logError("planner_state_failed", {
        request_id: requestId,
        authed,
        duration_ms: measureDurationMs(startedPerf),
        rows: bundle.rowCounts,
        partial_failures: bundle.degradedSlices,
        snapshot_revision: bundle.snapshotRevision,
        phase: "serialization",
        err: e instanceof Error ? e.name : "unknown",
      });
      return withRid(NextResponse.json({ error: "Failed to load plan state" }, { status: 500 }));
    }

    const duration_ms = measureDurationMs(startedPerf);
    const degraded = bundle.degradedSlices;
    const logMeta = {
      request_id: requestId,
      authed,
      duration_ms,
      rows: bundle.rowCounts,
      partial_failures: bundle.degradedSlices,
      snapshot_revision: bundle.snapshotRevision,
    };

    if (degraded.length) {
      logWarn("planner_state_partial", logMeta);
    } else {
      logInfo("planner_state_success", logMeta);
    }

    return withRid(NextResponse.json(body));
  } catch (error) {
    logError("planner_state_failed", {
      request_id: requestId,
      authed,
      duration_ms: measureDurationMs(startedPerf),
      phase: "handler",
      err: error instanceof Error ? error.name : "unknown",
    });
    return withRid(NextResponse.json({ error: "Failed to load plan state" }, { status: 500 }));
  }
}
