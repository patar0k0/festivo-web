import type { SupabaseClient } from "@supabase/supabase-js";

/** Global like count for a festival. RLS exposes `festival_likes` for read to all. */
export async function fetchFestivalLikesCount(
  supabase: SupabaseClient,
  festivalId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("festival_likes")
    .select("festival_id", { count: "exact", head: true })
    .eq("festival_id", festivalId);
  if (error) {
    console.warn("[mobile] festival_likes count error", error.message);
    return 0;
  }
  return count ?? 0;
}

/** Whether the given user has liked the festival. */
export async function isFestivalLikedByUser(
  supabase: SupabaseClient,
  userId: string,
  festivalId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("festival_likes")
    .select("festival_id")
    .eq("user_id", userId)
    .eq("festival_id", festivalId)
    .maybeSingle();
  if (error) {
    console.warn("[mobile] festival_likes lookup error", error.message);
    return false;
  }
  return Boolean(data);
}
