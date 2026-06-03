import { NextResponse } from "next/server";
import { mobileAuthErrorResponse, resolveMobileRequestAuth } from "@/lib/api/mobile/resolveMobileAuth";
import { getFestivalTemporalState } from "@/lib/festival/temporal";
import { PLANNER_TABLE_SELECT } from "@/lib/plan/queries";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type BodyPayload = {
  scheduleItemId?: string;
  desiredInPlan?: boolean;
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

/**
 * Idempotent set-membership for a schedule item in the user's plan.
 *
 * Unlike the legacy toggle endpoint (`/api/plan/items`), the client states the
 * desired end state (`desiredInPlan`) so concurrent retries / offline replay can
 * never flip membership the wrong way.
 */
export async function POST(request: Request) {
  try {
    const auth = await resolveMobileRequestAuth(request);
    const authErr = mobileAuthErrorResponse(auth);
    if (authErr) return authErr;
    if (!auth.user) return jsonError("Unauthorized", 401);

    let body: BodyPayload;
    try {
      body = (await request.json()) as BodyPayload;
    } catch {
      return jsonError("Invalid JSON body", 400);
    }

    const scheduleItemId = typeof body.scheduleItemId === "string" ? body.scheduleItemId.trim() : "";
    if (!scheduleItemId) return jsonError("Missing scheduleItemId", 400);
    if (!UUID_RE.test(scheduleItemId)) return jsonError("Invalid scheduleItemId", 400);
    if (typeof body.desiredInPlan !== "boolean") return jsonError("Missing desiredInPlan", 400);
    const desiredInPlan = body.desiredInPlan;

    const supabase = auth.supabase;
    const userId = auth.user.id;

    // ----- Remove -----
    if (!desiredInPlan) {
      const { error: deleteError } = await supabase
        .from("user_plan_items")
        .delete()
        .eq("user_id", userId)
        .eq("schedule_item_id", scheduleItemId);
      if (deleteError) return jsonError(deleteError.message, 500);
      return NextResponse.json({ ok: true, inPlan: false, scheduleItemId });
    }

    // ----- Add (idempotent) -----
    const { data: existing, error: existingError } = await supabase
      .from("user_plan_items")
      .select("schedule_item_id")
      .eq("user_id", userId)
      .eq("schedule_item_id", scheduleItemId)
      .maybeSingle();
    if (existingError) return jsonError(existingError.message, 500);
    if (existing) {
      return NextResponse.json({ ok: true, inPlan: true, scheduleItemId });
    }

    // Resolve the parent festival to gate "past" and to auto-add the festival.
    const { data: scheduleMeta, error: scheduleMetaError } = await supabase
      .from("festival_schedule_items")
      .select("festival_days!inner(festival_id)")
      .eq("id", scheduleItemId)
      .maybeSingle<{ festival_days: { festival_id: string } | { festival_id: string }[] }>();
    if (scheduleMetaError) return jsonError(scheduleMetaError.message, 500);

    const festivalJoin = Array.isArray(scheduleMeta?.festival_days)
      ? scheduleMeta?.festival_days[0]
      : scheduleMeta?.festival_days;
    const festivalId = festivalJoin?.festival_id;
    if (!festivalId) return jsonError("Schedule item not found", 404);

    const { data: festival, error: festivalError } = await supabase
      .from("festivals")
      .select(PLANNER_TABLE_SELECT.festivalsTemporal)
      .eq("id", festivalId)
      .maybeSingle<FestivalTemporalRow>();
    if (festivalError) return jsonError(festivalError.message, 500);
    if (!festival) return jsonError("Festival not found", 404);
    if (getFestivalTemporalState(festival) === "past") {
      return jsonError("Cannot add past festival to plan", 400);
    }

    const { error: insertError } = await supabase
      .from("user_plan_items")
      .insert({ user_id: userId, schedule_item_id: scheduleItemId });
    // 23505 (unique violation) means a concurrent request already added it.
    if (insertError && insertError.code !== "23505") {
      return jsonError(insertError.message, 500);
    }

    // Auto-add the parent festival so the planner can render the item's program.
    const { error: festivalUpsertError } = await supabase
      .from("user_plan_festivals")
      .insert({ user_id: userId, festival_id: festivalId });
    if (festivalUpsertError && festivalUpsertError.code !== "23505") {
      console.warn("[api/mobile/plan/items] auto-add festival failed", {
        code: festivalUpsertError.code,
        message: festivalUpsertError.message,
        userId,
        festivalId,
      });
    }

    return NextResponse.json({ ok: true, inPlan: true, scheduleItemId, festivalId });
  } catch (error) {
    console.error("[api/mobile/plan/items] POST", error);
    const message = error instanceof Error ? error.message : "Failed to update plan item";
    return jsonError(message, 500);
  }
}
