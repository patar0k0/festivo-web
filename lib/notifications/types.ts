/** Payload stored in notification_jobs.payload_json and sent as FCM data keys. */

export type NotificationPayloadV1 = {
  type: string;
  festival_id: string;
  slug: string;
  deep_link: string;
  title: string;
  body: string;
  /**
   * Opaque identifier for the specific push payload delivered to the user.
   * Used by clients to correlate follow-up analytics events.
   */
  notification_id?: string;
  /** FCM / client metadata */
  source?: "push";
  notification_type?: string;
  priority?: "high" | "normal";
};

export type NotificationJobType = "reminder" | "update" | "weekend" | "new_city";

export type NotificationPriority = "high" | "normal";

export type ReminderSubkind = "24h" | "2h";

export type NotificationJobRow = {
  id: string;
  user_id: string;
  festival_id: string | null;
  job_type: NotificationJobType;
  scheduled_for: string;
  payload_json: NotificationPayloadV1 & Record<string, unknown>;
  status: string;
  retry_count: number;
  priority: NotificationPriority;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};
