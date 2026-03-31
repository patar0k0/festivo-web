import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { sortPublicFestivalCategorySlugs } from "@/lib/festivals/publicCategoryShared";

const STATUS_OPTIONS = ["draft", "verified", "rejected", "archived"] as const;
const PAGE = 1000;

export type AdminFestivalsFilterStatus = "all" | (typeof STATUS_OPTIONS)[number];

export type AdminCityFilterOption = {
  id: number;
  label: string;
};

function isStatusFilter(v: string): v is (typeof STATUS_OPTIONS)[number] {
  return (STATUS_OPTIONS as readonly string[]).includes(v);
}

function applyStatusScope<T extends { eq: (c: string, v: string) => T }>(
  q: T,
  status: AdminFestivalsFilterStatus
): T {
  if (status !== "all" && isStatusFilter(status)) {
    return q.eq("status", status);
  }
  return q;
}

/**
 * Distinct trimmed non-null `festivals.category` values for the given status scope
 * (same semantics as admin list: `all` = no status filter).
 */
export async function loadAdminFestivalCategoryOptions(
  supabase: SupabaseClient,
  status: AdminFestivalsFilterStatus
): Promise<string[]> {
  /** Exact distinct `festivals.category` values (trimmed); must match `eq("category", value)`. */
  const seen = new Set<string>();
  let offset = 0;

  for (;;) {
    let q = supabase.from("festivals").select("category").range(offset, offset + PAGE - 1);
    q = applyStatusScope(q, status);

    const { data, error } = await q;

    if (error) {
      console.error("[loadAdminFestivalCategoryOptions]", error.message);
      break;
    }

    const rows = data ?? [];
    for (const row of rows) {
      const c = typeof row.category === "string" ? row.category.trim() : "";
      if (c) seen.add(c);
    }

    if (rows.length < PAGE) break;
    offset += PAGE;
    if (offset > 50000) break;
  }

  return sortPublicFestivalCategorySlugs(seen);
}

/**
 * Cities referenced by `festivals.city_id` in the given status scope, with labels from `cities`.
 */
export async function loadAdminFestivalCityOptions(
  supabase: SupabaseClient,
  status: AdminFestivalsFilterStatus
): Promise<AdminCityFilterOption[]> {
  const ids = new Set<number>();
  let offset = 0;

  for (;;) {
    let q = supabase.from("festivals").select("city_id").not("city_id", "is", null).range(offset, offset + PAGE - 1);
    q = applyStatusScope(q, status);

    const { data, error } = await q;

    if (error) {
      console.error("[loadAdminFestivalCityOptions] scan", error.message);
      break;
    }

    const rows = data ?? [];
    for (const row of rows) {
      const id = row.city_id;
      if (typeof id === "number" && Number.isFinite(id)) ids.add(id);
    }

    if (rows.length < PAGE) break;
    offset += PAGE;
    if (offset > 50000) break;
  }

  if (!ids.size) return [];

  const idList = Array.from(ids);
  const { data: cityRows, error: cityErr } = await supabase
    .from("cities")
    .select("id,name_bg,slug")
    .in("id", idList);

  if (cityErr) {
    console.error("[loadAdminFestivalCityOptions] cities", cityErr.message);
    return [];
  }

  const list = (cityRows ?? []).map((row) => ({
    id: row.id,
    label: (typeof row.name_bg === "string" && row.name_bg.trim()) || row.slug || `City ${row.id}`,
  }));

  list.sort((a, b) => a.label.localeCompare(b.label, "bg"));

  return list;
}
