// lib/analytics/festivalViewDedup.ts
//
// Tiny localStorage-backed dedup so we don't double-count the same browser
// hitting the same festival page within a 24h window (refreshes, soft nav back
// to the same page, multiple tabs, etc.). Pure browser side — anonymous users
// don't have a stable server-side identifier in v1.

const KEY_PREFIX = "fv:";
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Returns true if a festival_view event for `festivalId` was recorded in this
 * browser within the last 24h. Safe to call on the server (returns false when
 * `window` is undefined).
 */
export function wasFestivalViewedRecently(festivalId: string): boolean {
  if (typeof window === "undefined") return false;
  if (!festivalId) return false;
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + festivalId);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DEDUP_WINDOW_MS;
  } catch {
    // localStorage may throw under quota / privacy modes — treat as "not viewed"
    return false;
  }
}

/**
 * Records `festivalId` as viewed now in localStorage. No-op when window is
 * undefined or storage is unavailable.
 */
export function markFestivalViewed(festivalId: string): void {
  if (typeof window === "undefined") return;
  if (!festivalId) return;
  try {
    window.localStorage.setItem(KEY_PREFIX + festivalId, String(Date.now()));
  } catch {
    // Swallow — analytics must never block UX
  }
}
