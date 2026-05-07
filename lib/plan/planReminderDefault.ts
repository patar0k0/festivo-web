import type { ReminderType } from "@/lib/plan/server";

const ALLOWED = new Set<ReminderType>(["none", "24h", "same_day_09", "default"]);

export function parseDefaultPlanReminderType(raw: unknown): ReminderType {
  if (raw === "none" || raw === "24h" || raw === "same_day_09" || raw === "default") {
    return raw;
  }
  return "default";
}

export function isAllowedPlanReminderType(value: unknown): value is ReminderType {
  return typeof value === "string" && ALLOWED.has(value as ReminderType);
}
