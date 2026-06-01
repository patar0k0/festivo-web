// lib/analytics/festivalViewCounts.ts
import "server-only";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export type FestivalViewCounts = {
  last30d: number;
  total: number;
};

/**
 * Returns the count of `festival_view` analytics events for `festivalId` in
 * the last 30 days and across all time. Admin/staff and bot events are already
 * filtered at insert time in /api/analytics/track, so the raw count is the
 * "real visitor" count.
 *
 * Fail-safe: returns { last30d: 0, total: 0 } on any error (the badge then
 * just shows zeros instead of breaking the page).
 */
export async function getFestivalViewCounts(
  festivalId: string,
): Promise<FestivalViewCounts> {
  if (!festivalId) return { last30d: 0, total: 0 };

  try {
    const admin = createSupabaseAdmin();
    const since = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();

    const [r30, rAll] = await Promise.all([
      admin
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .eq("festival_id", festivalId)
        .eq("event", "festival_view")
        .gte("created_at", since),
      admin
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .eq("festival_id", festivalId)
        .eq("event", "festival_view"),
    ]);

    return {
      last30d: r30.count ?? 0,
      total: rAll.count ?? 0,
    };
  } catch (err) {
    console.warn("[analytics] getFestivalViewCounts threw", err);
    return { last30d: 0, total: 0 };
  }
}
