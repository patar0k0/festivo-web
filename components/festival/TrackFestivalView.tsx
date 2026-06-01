// components/festival/TrackFestivalView.tsx
"use client";

import { useEffect } from "react";
import {
  markFestivalViewed,
  wasFestivalViewedRecently,
} from "@/lib/analytics/festivalViewDedup";

type Props = {
  festivalId: string;
  slug: string | null;
};

/**
 * Fires a single `festival_view` analytics event per festival per browser per
 * 24h. Server-side filters (in /api/analytics/track) layer on staff / bot /
 * per-user dedup checks; this is the client-side optimistic dedup so that
 * F5 / soft-nav back / multi-tab don't pile up events for the same browser.
 *
 * Renders nothing. Mount once near the top of the festival detail page.
 */
export default function TrackFestivalView({ festivalId, slug }: Props) {
  useEffect(() => {
    if (!festivalId) return;
    if (wasFestivalViewedRecently(festivalId)) return;
    markFestivalViewed(festivalId);

    // Fire-and-forget. keepalive lets the request survive a fast page nav away.
    void fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "festival_view",
        festival_id: festivalId,
        slug,
        source: "web",
      }),
      keepalive: true,
      credentials: "include",
    }).catch(() => {
      // Analytics must never block UX. If the fetch fails, mark stays in
      // localStorage so we don't retry on the next page load.
    });
  }, [festivalId, slug]);

  return null;
}
