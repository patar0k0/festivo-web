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
  }

  ingest_jobs {
    uuid id PK
    text source_url UK
    text source_type
    text status
    text error
    timestamptz created_at
    timestamptz started_at
    timestamptz finished_at
  }

  pending_festivals {
    uuid id PK
    text title
    text slug
    bigint city_id FK
    text source_url
    date start_date
    date end_date
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

  organizers {
    uuid id PK
    boolean is_active
    uuid merged_into FK
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

  cities ||--o{ pending_festivals : moderation_city_fk
  cities ||--o{ festivals : canonical_city_fk

  festivals ||--o{ festival_days : has
  festival_days ||--o{ festival_schedule_items : has
  festivals ||--o{ festival_media : has

  festivals ||--o{ user_plan_festivals : planned
  festivals ||--o{ user_plan_reminders : reminder_for
  festivals ||--o{ user_notifications : notification_for

  festival_schedule_items ||--o{ user_plan_items : planned_item

  organizers ||--o{ organizers : merged_into

  ingest_jobs ..> pending_festivals : ingest_to_moderation
  pending_festivals ..> festivals : approve_publishes
```

Notes:
- `ingest_jobs -> pending_festivals` and `pending_festivals -> festivals` are workflow links via `source_url`/approval logic, not strict FK constraints.
- Pending AI guess columns are omitted from the diagram to keep relationships readable; they are documented in `docs/database-schema.md`.
