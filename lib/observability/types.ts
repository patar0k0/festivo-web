export type ObservabilityLevel = "info" | "warn" | "error";

/** Safe metadata for structured logs (values are sanitized before emit). */
export type ObservabilityEventMeta = Record<string, unknown>;

/** Planner slices that may degrade independently (`loadMobilePlannerBundle`). */
export type PartialFailureSlice = "festivals" | "schedule_items" | "reminders" | "stats";
