/**
 * Lightweight client event hook → `/api/track/event` (same pipeline as TrackedAnchor).
 * Fail-safe: never throws; anonymous-friendly.
 */
export function track(type: string, meta: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  void fetch("/api/track/event", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type, meta }),
    keepalive: true,
  }).catch(() => {
    // Tracking should never block primary user intent.
  });
}
