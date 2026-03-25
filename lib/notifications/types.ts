/** Payload stored in notification_jobs.payload_json and sent as FCM data keys. */

export type NotificationPayloadV1 = {
  type: string;
  festival_id: string;
  slug: string;
  deep_link: string;
  title: string;
  body: string;
};

export type NotificationJobType = "reminder" | "update" | "weekend" | "new_city";

export type ReminderSubkind = "24h" | "2h";

export type NotificationJobRow = {
  id: string;
  user_id: string;
  festival_id: string | null;
  job_type: NotificationJobType;
  scheduled_for: string;
  payload_json: NotificationPayloadV1 & Record<string, unknown>;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};
