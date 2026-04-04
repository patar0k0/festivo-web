import type { ReminderType } from "@/lib/plan/server";

const ALLOWED = new Set<ReminderType>(["none", "24h", "same_day_09"]);

export function parseDefaultPlanReminderType(raw: unknown): ReminderType {
  if (raw === "none" || raw === "24h" || raw === "same_day_09") {
    return raw;
  }
  return "24h";
}

export function isAllowedPlanReminderType(value: unknown): value is ReminderType {
  return typeof value === "string" && ALLOWED.has(value as ReminderType);
}
