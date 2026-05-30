import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

function toUtcDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Counts festivals per `category` where status is published or verified and end_date >= today (UTC).
 */
export async function fetchActiveFestivalCountsByCategory(): Promise<Map<string, number>> {
  const supabase = await createSupabaseServerClient();
  const counts = new Map<string, number>();
  const pageSize = 1000;
  let offset = 0;

  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayStr = toUtcDateString(todayUtc);

  for (;;) {
    const { data, error } = await supabase
      .from("festivals")
      .select("category")
      .in("status", ["published", "verified"])
      .neq("status", "archived")
      .not("category", "is", null)
      .gte("end_date", todayStr)
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error("[fetchActiveFestivalCountsByCategory]", error.message);
      break;
    }

    const rows = data ?? [];
    for (const row of rows) {
      const c = typeof row.category === "string" ? row.category.trim() : "";
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    }

    if (rows.length < pageSize) break;
    offset += pageSize;
    if (offset > 20000) break;
  }

  return counts;
}

/**
 * Active category slugs from the festival_categories table, ordered by sort_order.
 * This is the source of truth — visibility controlled via is_active column.
 */
export async function listPublicFestivalCategorySlugs(): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("festival_categories")
    .select("slug")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("slug", { ascending: true });

  if (error) {
    console.error("[listPublicFestivalCategorySlugs]", error.message);
    return [];
  }
  return (data ?? []).map((r) => r.slug as string);
}

/**
 * Active category slugs ordered by sort_order from festival_categories table.
 * The minCount parameter is kept for API compatibility but ignored —
 * visibility is controlled via is_active in the festival_categories table.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function listPublicFestivalCategorySlugsSortedByActiveCount(_minCount = 3): Promise<string[]> {
  return listPublicFestivalCategorySlugs();
}
