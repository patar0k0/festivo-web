declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function gaTrack(event: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", event, params);
}
