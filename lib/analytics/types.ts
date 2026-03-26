export const ANALYTICS_EVENTS = ["push_open", "festival_view", "festival_saved", "app_open"] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

export function isAnalyticsEvent(value: string): value is AnalyticsEvent {
  return (ANALYTICS_EVENTS as readonly string[]).includes(value);
}

