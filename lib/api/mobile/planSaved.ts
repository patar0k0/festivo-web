import type { SupabaseClient } from "@supabase/supabase-js";
import { PLANNER_TABLE_SELECT } from "@/lib/plan/queries";

/**
 * Festival IDs the user has in `user_plan_festivals` (mobile `is_saved`).
 */
export async function fetchUserSavedFestivalIdSet(
  supabase: SupabaseClient,
  userId: string,
  festivalIds: string[],
): Promise<Set<string>> {
  const ids = [...new Set(festivalIds.map((id) => String(id)).filter(Boolean))];
  if (ids.length === 0) {
    return new Set();
  }

  const { data, error } = await supabase
    .from("user_plan_festivals")
    .select(PLANNER_TABLE_SELECT.userPlanFestivals.idsOnly)
    .eq("user_id", userId)
    .in("festival_id", ids);

  if (error) {
    console.error("[mobile] user_plan_festivals select", error.message);
    throw new Error(error.message);
  }

  return new Set((data ?? []).map((row) => String(row.festival_id)));
}

export async function isFestivalInUserPlan(
  supabase: SupabaseClient,
  userId: string,
  festivalId: string,
): Promise<boolean> {
  const set = await fetchUserSavedFestivalIdSet(supabase, userId, [festivalId]);
  return set.has(String(festivalId));
}
