# Festivo ER Diagram

```mermaid
erDiagram
  auth_users {
    uuid id PK
  }

  cities {
    bigint id PK
    text slug UK
    text name_bg
    boolean is_village
  }

  ingest_jobs {
    uuid id PK
    text source_url UK
    text source_type
    text status
    text error
    text fb_browser_context
    timestamptz created_at
    timestamptz started_at
    timestamptz finished_at
  }

  pending_festivals {
    uuid id PK
    text title
    text slug
    bigint city_id FK
    jsonb organizer_entries
    uuid organizer_id FK
    uuid submitted_by_user_id FK
    text submission_source
    text source_url
    date start_date
    date end_date
    time start_time
    time end_time
    jsonb occurrence_dates
    text hero_image
    text[] tags
    text status
    timestamptz created_at
    timestamptz reviewed_at
    uuid reviewed_by FK
  }

  festivals {
    uuid id PK
    text title
    text slug
    bigint city_id FK
    text city
    date start_date
    date end_date
    time start_time
    time end_time
    jsonb occurrence_dates
    text source_url
    text source_type
    text status
    boolean is_verified
    text promotion_status
    timestamptz promotion_started_at
    timestamptz promotion_expires_at
    int promotion_rank
  }

  festival_days {
    uuid id PK
    uuid festival_id FK
    date date
  }

  festival_schedule_items {
    uuid id PK
    uuid day_id FK
    text title
  }

  festival_media {
    uuid id PK
    uuid festival_id FK
    text type
    text url
    int sort_order
    boolean is_hero
  }

  festival_organizers {
    uuid festival_id FK
    uuid organizer_id FK
    text role
    integer sort_order
    timestamptz created_at
  }

  organizers {
    uuid id PK
    text plan
    timestamptz plan_started_at
    timestamptz plan_expires_at
    int included_promotions_per_year
    int organizer_rank
    boolean is_active
    uuid merged_into FK
  }

  organizer_promotion_credits {
    uuid id PK
    uuid organizer_id FK
    int credit_year
    int included_total
    int used_total
    timestamptz created_at
    timestamptz updated_at
  }

  organizer_members {
    uuid id PK
    uuid organizer_id FK
    uuid user_id FK
    text role
    text status
    timestamptz created_at
    timestamptz approved_at
    uuid approved_by FK
    text contact_email
    text contact_phone
  }

  user_roles {
    uuid user_id FK
    text role
  }

  user_plan_festivals {
    uuid user_id FK
    uuid festival_id FK
  }

  user_plan_items {
    uuid user_id FK
    uuid schedule_item_id FK
  }

  user_plan_reminders {
    uuid user_id FK
    uuid festival_id FK
    text reminder_type
  }

  user_notifications {
    uuid id PK
    uuid user_id FK
    uuid festival_id FK
    text type
    timestamptz scheduled_for
  }

  device_tokens {
    uuid user_id FK
    text token
    text platform
    timestamptz invalidated_at
  }

  analytics_events {
    uuid id PK
    uuid user_id FK
    text event
    text notification_id
    uuid festival_id FK
    text slug
    text source
    jsonb metadata_json
    timestamptz created_at
  }

  outbound_clicks {
    uuid id PK
    uuid festival_id FK
    uuid user_id FK
    text destination_type
    text target_url
    text source
    timestamptz created_at
  }

  admin_audit_logs {
    uuid id PK
    timestamptz created_at
    uuid actor_user_id FK
    text action
    text entity_type
    text entity_id
    text route
    text method
    text status
    jsonb details
  }

  notification_jobs {
    uuid id PK
    uuid user_id FK
    uuid festival_id FK
    text job_type
    timestamptz scheduled_for
    text dedupe_key UK
    jsonb payload_json
    text status
    text priority
    int retry_count
  }

  email_jobs {
    uuid id PK
    text type
    text recipient_email
    uuid recipient_user_id FK
    text locale
    text subject
    jsonb payload
    text status
    int attempts
    int max_attempts
    timestamptz scheduled_at
    text dedupe_key UK
    text provider
    text provider_message_id
    text delivery_status
    timestamptz delivered_at
    timestamptz bounced_at
    text last_event_type
    timestamptz last_event_at
    timestamptz sent_at
    timestamptz locked_at
  }

  email_events {
    uuid id PK
    uuid email_job_id FK
    text provider
    text provider_message_id
    text event_type
    jsonb event_payload
    timestamptz occurred_at
    timestamptz created_at
    text webhook_delivery_id UK
  }

  user_email_preferences {
    uuid user_id PK
    boolean reminder_emails_enabled
    boolean organizer_update_emails_enabled
    boolean marketing_emails_enabled
    boolean unsubscribed_all_optional
    uuid unsubscribe_token UK
    timestamptz created_at
    timestamptz updated_at
  }

  notification_logs {
    uuid id PK
    uuid job_id FK
    uuid user_id FK
    text status
    jsonb response
    int duration_ms
    text priority
    text notification_type
  }

  cron_locks {
    text name PK
    timestamptz locked_at
  }

  auth_users ||--o{ user_roles : has
  auth_users ||--o{ user_plan_festivals : saves
  auth_users ||--o{ user_plan_items : saves
  auth_users ||--o{ user_plan_reminders : sets
  auth_users ||--o{ user_notifications : receives
  auth_users ||--o{ device_tokens : owns
  auth_users ||--o{ analytics_events : creates
  auth_users ||--o{ outbound_clicks : creates
  auth_users ||--o{ admin_audit_logs : performs_admin_action
  auth_users ||--o{ notification_jobs : scheduled
  auth_users ||--o{ notification_logs : delivery_audit
  auth_users ||--o{ email_jobs : optional_recipient
  auth_users ||--o{ user_email_preferences : email_prefs
  email_jobs ||--o{ email_events : delivery_audit
  notification_jobs ||--o{ notification_logs : has

  cities ||--o{ pending_festivals : moderation_city_fk
  organizers ||--o{ pending_festivals : portal_submitter_org
  cities ||--o{ festivals : canonical_city_fk

  festivals ||--o{ festival_days : has
  festival_days ||--o{ festival_schedule_items : has
  festivals ||--o{ festival_media : has
  festivals ||--o{ festival_organizers : has
  organizers ||--o{ festival_organizers : linked_to
  organizers ||--o{ organizer_members : has_member
  organizers ||--o{ organizer_promotion_credits : yearly_credits
  auth_users ||--o{ organizer_members : manages

  festivals ||--o{ user_plan_festivals : planned
  festivals ||--o{ user_plan_reminders : reminder_for
  festivals ||--o{ user_notifications : notification_for
  festivals ||--o{ analytics_events : relates
  festivals ||--o{ outbound_clicks : relates

  festival_schedule_items ||--o{ user_plan_items : planned_item

  organizers ||--o{ organizers : merged_into

  ingest_jobs ..> pending_festivals : ingest_to_moderation
  pending_festivals ..> festivals : approve_publishes
```

Notes:
- `user_notification_settings` (not drawn) includes `default_plan_reminder_type` (`none` | `24h` | `same_day_09`) for auto-applying reminder timing when a user saves a festival to their plan; see `scripts/sql/20260406_user_notification_default_plan_reminder_type.sql`.
- `ingest_jobs -> pending_festivals` and `pending_festivals -> festivals` are workflow links via `source_url`/approval logic, not strict FK constraints.
- Pending AI guess columns are omitted from the diagram to keep relationships readable; column-level detail lives in Supabase, `scripts/sql/` migrations, and application types/queries—not in a static schema markdown snapshot.
