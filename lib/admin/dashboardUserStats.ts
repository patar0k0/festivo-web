import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * User growth metrics for the admin dashboard (new registrations).
 *
 * Registration date lives in `auth.users.created_at`. The `public.users` table is
 * only a shadow table for soft-delete/ban tracking and has no `created_at`, so we
 * read through the GoTrue admin API (`auth.admin.listUsers`) with a service-role
 * client and bucket by signup time client-side.
 *
 * At launch scale (hundreds of users) this is one or two requests. Page count is
 * capped so the call stays bounded as the user base grows; if the cap is hit the
 * totals become a lower bound (`capped: true`) rather than an unbounded scan.
 *
 * Fail-safe: a null client or any API error degrades to `available: false` — the
 * dashboard must never break because a stats probe failed.
 */

export type UserGrowthStats = {
  available: boolean;
  new24h: number | null;
  new7d: number | null;
  total: number | null;
  /** Registrations in the 24h *before* the last 24h — for a trend delta. */
  prev24h: number | null;
  /** Registrations in the 7d *before* the last 7d — for a trend delta. */
  prev7d: number | null;
  /** True when the page cap was reached, so counts are a lower bound. */
  capped: boolean;
};

const PER_PAGE = 200;
const MAX_PAGES = 50; // hard ceiling: up to 10k users scanned

export async function fetchUserGrowthStats(admin: SupabaseClient | null): Promise<UserGrowthStats> {
  const empty: UserGrowthStats = {
    available: false,
    new24h: null,
    new7d: null,
    total: null,
    prev24h: null,
    prev7d: null,
    capped: false,
  };
  if (!admin) return empty;

  const now = Date.now();
  const since24h = now - 24 * 60 * 60 * 1000;
  const since48h = now - 48 * 60 * 60 * 1000;
  const since7d = now - 7 * 24 * 60 * 60 * 1000;
  const since14d = now - 14 * 24 * 60 * 60 * 1000;

  let total = 0;
  let new24h = 0;
  let new7d = 0;
  let prev24h = 0;
  let prev7d = 0;
  let capped = false;

  try {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE });
      if (error) {
        console.error("[dashboardUserStats] listUsers:", error.message);
        return empty;
      }
      const users = data?.users ?? [];
      for (const u of users) {
        total += 1;
        const created = u.created_at ? new Date(u.created_at).getTime() : NaN;
        if (Number.isNaN(created)) continue;
        if (created >= since24h) new24h += 1;
        else if (created >= since48h) prev24h += 1;
        if (created >= since7d) new7d += 1;
        else if (created >= since14d) prev7d += 1;
      }
      if (users.length < PER_PAGE) break;
      if (page === MAX_PAGES) capped = true;
    }
  } catch (e) {
    console.error("[dashboardUserStats] threw:", e instanceof Error ? e.message : e);
    return empty;
  }

  // When capped, the scan is a lower bound and prev/current windows may be
  // unevenly truncated — deltas would mislead, so suppress them.
  return {
    available: true,
    new24h,
    new7d,
    total,
    prev24h: capped ? null : prev24h,
    prev7d: capped ? null : prev7d,
    capped,
  };
}
