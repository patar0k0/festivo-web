import type { NotificationJobType } from "./types";

/** In-app / analytics type string for a job (matches user_notifications.type where applicable). */
export function notificationTypeForJob(
  jobType: NotificationJobType,
  payload: Record<string, unknown>,
): string {
  if (jobType === "reminder") {
    return payload.reminder_subkind === "2h" ? "saved_festival_reminder_2h" : "saved_festival_reminder_24h";
  }
  if (jobType === "update") {
    return "festival_updated";
  }
  if (jobType === "weekend") {
    return "weekend_nearby";
  }
  if (jobType === "new_city") {
    return "new_festival";
  }
  return jobType;
}
