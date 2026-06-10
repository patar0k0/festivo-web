import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Social repost pipeline status for the admin dashboard.
 *
 * The repost bot (Telegram → TikTok + Instagram) runs entirely outside the web
 * app: the Telegram webhook enqueues `social_repost_jobs` and a festivo-workers
 * cron service drives the state machine
 * (queued → awaiting_review → scheduled → publishing → published/failed). The
 * admin otherwise has zero visibility into it, so this surfaces three numbers:
 * active jobs in flight, plus published / failed in the last 24h.
 *
 * Reads with a service-role client (the table is RLS-locked to service role).
 * Fail-safe: a null client, a missing table (feature not yet deployed), or any
 * query error degrades to `available: false` and the card is hidden.
 */

export type SocialRepostStatus = {
  available: boolean;
  active: number | null;
  published24h: number | null;
  failed24h: number | null;
};

/** Statuses that mean a job is still moving through the pipeline. */
const ACTIVE_STATUSES = ["queued", "awaiting_review", "scheduled", "publishing"];

async function safeCount(
  builder: PromiseLike<{ count: number | null; error: { message: string; code?: string } | null }>,
  context: string,
): Promise<number | null> {
  try {
    const { count, error } = await builder;
    if (error) {
      // 42P01 = undefined_table: feature not deployed to this environment yet.
      if (error.code !== "42P01") {
        console.error(`[dashboardSocialRepost] ${context}:`, error.message);
      }
      return null;
    }
    return count ?? 0;
  } catch (e) {
    console.error(`[dashboardSocialRepost] ${context} threw:`, e instanceof Error ? e.message : e);
    return null;
  }
}

export async function fetchSocialRepostStatus(admin: SupabaseClient | null): Promise<SocialRepostStatus> {
  const empty: SocialRepostStatus = { available: false, active: null, published24h: null, failed24h: null };
  if (!admin) return empty;

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [active, published24h, failed24h] = await Promise.all([
    safeCount(
      admin.from("social_repost_jobs").select("id", { count: "exact", head: true }).in("status", ACTIVE_STATUSES),
      "active",
    ),
    safeCount(
      admin
        .from("social_repost_jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "published")
        .gte("updated_at", since24h),
      "published 24h",
    ),
    safeCount(
      admin
        .from("social_repost_jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed")
        .gte("updated_at", since24h),
      "failed 24h",
    ),
  ]);

  // If even the active probe couldn't read the table, treat the feature as
  // unavailable in this environment and hide the card entirely.
  if (active == null && published24h == null && failed24h == null) {
    return empty;
  }

  return { available: true, active, published24h, failed24h };
}
