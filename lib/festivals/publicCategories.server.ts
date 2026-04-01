import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  sortPublicFestivalCategorySlugs,
  sortPublicFestivalCategorySlugsByActiveCount,
} from "@/lib/festivals/publicCategoryShared";

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
 * All public category slugs, ordered by active festival count (desc), then locale.
 */
export async function listPublicFestivalCategorySlugsSortedByActiveCount(): Promise<string[]> {
  const [slugs, counts] = await Promise.all([
    listPublicFestivalCategorySlugs(),
    fetchActiveFestivalCountsByCategory(),
  ]);
  return sortPublicFestivalCategorySlugsByActiveCount(slugs, counts);
}

/**
 * Distinct non-empty `festivals.category` values for published/public scope.
 */
export async function listPublicFestivalCategorySlugs(): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const seen = new Set<string>();
  const pageSize = 1000;
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("festivals")
      .select("category")
      .or("status.eq.published,status.eq.verified,is_verified.eq.true")
      .neq("status", "archived")
      .not("category", "is", null)
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error("[listPublicFestivalCategorySlugs]", error.message);
      break;
    }

    const rows = data ?? [];
    for (const row of rows) {
      const c = typeof row.category === "string" ? row.category.trim() : "";
      if (c) seen.add(c);
    }

    if (rows.length < pageSize) break;
    offset += pageSize;
    if (offset > 20000) break;
  }

  return sortPublicFestivalCategorySlugs(seen);
}
