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
    jsonb occurrence_dates
    text source_url
    text source_type
    text status
    boolean is_verified
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
    text url
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
    boolean is_active
    uuid merged_into FK
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
  auth_users ||--o{ notification_jobs : scheduled
  auth_users ||--o{ notification_logs : delivery_audit
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
- `ingest_jobs -> pending_festivals` and `pending_festivals -> festivals` are workflow links via `source_url`/approval logic, not strict FK constraints.
- Pending AI guess columns are omitted from the diagram to keep relationships readable; column-level detail lives in Supabase, `scripts/sql/` migrations, and application types/queries—not in a static schema markdown snapshot.
