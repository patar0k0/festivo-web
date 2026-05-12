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

  const withRid = (res: Response) => {
    // Defeat any Vercel/Next.js/CDN caching for plan state — must always be live.
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.headers.set("Pragma", "no-cache");
    return attachRequestIdHeader(res, requestId);
  };

  try {
    const auth = await resolveMobileRequestAuth(request);
    const authErr = mobileAuthErrorResponse(auth);
    if (authErr) return withRid(authErr);
    if (!auth.user) {
      return withRid(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    }
    authed = true;

    const bundle = await loadMobilePlannerBundle(auth.supabase, auth.user.id, { authed: true, startedAt });

    // Diagnose: is the row count from the DB query consistent with what we are
    // about to serialize? If admin sees 0 matching rows for a festival_id but
    // this list still includes it, something is serving cached data.
    console.log("[api/mobile/plan/state] bundle.savedFestivalIds", {
      userId: auth.user.id,
      savedFestivalIds: bundle.savedFestivalIds,
      rawSavedFestivalRowCount: bundle.savedFestivalRows.length,
    });

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
        savedFestivalBasicRows: bundle.savedFestivalBasicRows,
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
