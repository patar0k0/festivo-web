/** Row shape returned by `claim_due_email_jobs` and email_jobs selects. */
export type EmailJobRow = {
  id: string;
  type: string;
  recipient_email: string;
  recipient_user_id: string | null;
  locale: string;
  subject: string | null;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  max_attempts: number;
  scheduled_at: string;
  dedupe_key: string | null;
  provider: string | null;
  provider_message_id: string | null;
  delivery_status: string | null;
  delivered_at: string | null;
  bounced_at: string | null;
  last_event_type: string | null;
  last_event_at: string | null;
  last_error: string | null;
  sent_at: string | null;
  locked_at: string | null;
  processing_started_at: string | null;
  created_at: string;
  updated_at: string;
};
