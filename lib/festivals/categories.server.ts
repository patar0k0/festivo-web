import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export type FestivalCategory = {
  slug: string;
  label_bg: string;
  sort_order: number;
  is_active: boolean;
};

/**
 * Active categories ordered by sort_order, then label_bg.
 * Uses anon client (respects RLS — only is_active = true rows returned).
 * Safe for server components visible to non-admin users.
 */
export async function listActiveFestivalCategories(): Promise<FestivalCategory[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("festival_categories")
    .select("slug,label_bg,sort_order,is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("label_bg", { ascending: true });

  if (error) {
    console.error("[listActiveFestivalCategories]", error.message);
    return [];
  }
  return (data ?? []) as FestivalCategory[];
}

/**
 * All categories including inactive. Uses service role — admin only.
 */
export async function listAllFestivalCategories(): Promise<FestivalCategory[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("festival_categories")
    .select("slug,label_bg,sort_order,is_active")
    .order("sort_order", { ascending: true })
    .order("label_bg", { ascending: true });

  if (error) {
    console.error("[listAllFestivalCategories]", error.message);
    return [];
  }
  return (data ?? []) as FestivalCategory[];
}
