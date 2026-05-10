import { NextResponse } from "next/server";
import { mobileAuthErrorResponse, resolveMobileRequestAuth } from "@/lib/api/mobile/resolveMobileAuth";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getFestivalTemporalState } from "@/lib/festival/temporal";
import { PLANNER_TABLE_SELECT } from "@/lib/plan/queries";

export const dynamic = "force-dynamic";

type FestivalTemporalRow = {
  id: string;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  occurrence_dates: string[] | null;
};

// Temporary diagnostic endpoint — REMOVE after root cause identified
export async function GET(request: Request) {
  const steps: Record<string, unknown> = {};

  try {
    const auth = await resolveMobileRequestAuth(request);
    const authErr = mobileAuthErrorResponse(auth);
    if (authErr) return authErr;
    if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    steps.userId = auth.user.id;
    steps.authType = auth.hadBearerScheme ? "bearer" : "cookie";

    const adminDb = createSupabaseAdmin();

    // Step 1: find a festival NOT in the user's plan to test POST flow
    const { data: savedRows } = await adminDb
      .from("user_plan_festivals")
      .select("festival_id")
      .eq("user_id", auth.user.id);
    const savedIds = (savedRows ?? []).map((r: Record<string, unknown>) => String(r.festival_id));
    steps.savedCount = savedIds.length;

    // Step 2: find an upcoming festival to test with (exact same query as POST handler)
    const { data: testFestivals, error: testFestivalsError } = await adminDb
      .from("festivals")
      .select(PLANNER_TABLE_SELECT.festivalsTemporal)
      .not("id", "in", savedIds.length > 0 ? `(${savedIds.join(",")})` : "(00000000-0000-0000-0000-000000000000)")
      .limit(5);

    steps.temporalQuery = testFestivalsError
      ? { ok: false, code: testFestivalsError.code, message: testFestivalsError.message }
      : { ok: true, count: (testFestivals ?? []).length };

    const upcoming = (testFestivals ?? []).find(
      (f: FestivalTemporalRow) => getFestivalTemporalState(f) !== "past"
    ) as FestivalTemporalRow | undefined;

    steps.upcomingFestival = upcoming
      ? { id: upcoming.id, start_date: upcoming.start_date, state: getFestivalTemporalState(upcoming) }
      : null;

    if (upcoming) {
      // Step 3: simulate full POST flow
      const { error: insertError } = await adminDb
        .from("user_plan_festivals")
        .insert({ user_id: auth.user.id, festival_id: upcoming.id });
      steps.simulatedInsert = insertError
        ? { ok: false, code: insertError.code, message: insertError.message, hint: insertError.hint }
        : { ok: true };

      if (!insertError) {
        const { error: cleanupError } = await adminDb
          .from("user_plan_festivals")
          .delete()
          .eq("user_id", auth.user.id)
          .eq("festival_id", upcoming.id);
        steps.cleanup = cleanupError ? { ok: false, message: cleanupError.message } : { ok: true };
      }
    }

    // Step 4: simulate full DELETE flow on first saved festival
    if (savedIds.length > 0) {
      const targetId = savedIds[0];
      // Just check if we CAN delete it (don't actually delete — test with a non-existent festival)
      const { error: deleteError } = await adminDb
        .from("user_plan_festivals")
        .delete()
        .eq("user_id", auth.user.id)
        .eq("festival_id", "00000000-0000-0000-0000-000000000000"); // fake ID, deletes nothing
      steps.simulatedDelete = deleteError
        ? { ok: false, code: deleteError.code, message: deleteError.message }
        : { ok: true, note: "deleted 0 rows (fake id), targetId=" + targetId };
    }

    // Step 5: test syncReminderJobsForPreference import (check if it throws on import)
    steps.reminderImport = "ok";
    const { syncReminderJobsForPreference } = await import("@/lib/notifications/triggers");
    steps.reminderImportDone = typeof syncReminderJobsForPreference === "function";

    return NextResponse.json({ ok: true, steps });
  } catch (e) {
    return NextResponse.json(
      { ok: false, caught: e instanceof Error ? e.message : String(e), stack: e instanceof Error ? e.stack?.split("\n").slice(0, 5).join(" | ") : null, steps },
      { status: 500 }
    );
  }
}
