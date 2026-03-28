import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sortPublicFestivalCategorySlugs } from "@/lib/festivals/publicCategoryShared";

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
