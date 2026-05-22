import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ProfileSummary = {
  /** Number of festivals в "Моят план". */
  planCount: number;
  /** Number of cities the user follows. */
  followedCitiesCount: number;
  /** Number of organizers the user follows. */
  followedOrganizersCount: number;
  /**
   * True if the user has at least one active 'organizer_members' row.
   * Used to suppress consumer-facing mobile app promo (organizers use the web portal).
   */
  isActiveOrganizer: boolean;
};

const EMPTY: ProfileSummary = {
  planCount: 0,
  followedCitiesCount: 0,
  followedOrganizersCount: 0,
  isActiveOrganizer: false,
};

/**
 * Fetches lightweight aggregate counts for the profile page.
 * Uses `head: true, count: "exact"` to avoid pulling row data — only row counts.
 * All four queries run in parallel.
 *
 * Returns zeroed defaults on any error to keep the page resilient (the profile
 * page must never 500 because of stats fetch failure).
 */
export async function getProfileSummary(userId: string): Promise<ProfileSummary> {
  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return EMPTY;
  }

  const [planRes, citiesRes, organizersRes, membershipRes] = await Promise.allSettled([
    supabase
      .from("user_plan_festivals")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("user_followed_cities")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("user_followed_organizers")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("organizer_members")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "active"),
  ]);

  return {
    planCount: extractCount(planRes),
    followedCitiesCount: extractCount(citiesRes),
    followedOrganizersCount: extractCount(organizersRes),
    isActiveOrganizer: extractCount(membershipRes) > 0,
  };
}

function extractCount(
  result: PromiseSettledResult<{ count: number | null; error: unknown }>,
): number {
  if (result.status !== "fulfilled") return 0;
  if (result.value.error) return 0;
  return result.value.count ?? 0;
}
