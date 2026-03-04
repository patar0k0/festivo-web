# Festivo ER Diagram

```mermaid
erDiagram
  auth_users {
    uuid id PK
  }

  festivals {
    uuid id PK
    text slug
    text title
    text city_slug
    text category_slug
    uuid organizer_id FK
  }

  cities {
    text slug PK
    text name_bg
  }

  organizers {
    uuid id PK
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

  user_plan_items {
    uuid user_id FK
    uuid schedule_item_id FK
  }

  user_plan_festivals {
    uuid user_id FK
    uuid festival_id FK
    timestamptz created_at
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

  user_notification_settings {
    uuid user_id PK,FK
  }

  user_followed_cities {
    uuid user_id FK
    text city_slug
  }

  user_followed_categories {
    uuid user_id FK
    text category_slug
  }

  user_followed_organizers {
    uuid user_id FK
    uuid organizer_id FK
  }

  user_roles {
    uuid user_id FK
    text role
  }

  device_tokens {
    uuid user_id FK
    text token
  }

  cron_locks {
    text name PK
    timestamptz locked_at
  }

  festivals ||--o{ festival_days : has
  festival_days ||--o{ festival_schedule_items : has
  festivals ||--o{ festival_media : has

  organizers ||--o{ festivals : organizes
  organizers ||--o{ user_followed_organizers : followed_by

  auth_users ||--o{ user_roles : has
  auth_users ||--o{ user_plan_items : has
  auth_users ||--o{ user_plan_festivals : saves
  auth_users ||--o{ user_plan_reminders : sets
  auth_users ||--o{ user_notifications : receives
  auth_users ||--|| user_notification_settings : configures
  auth_users ||--o{ user_followed_cities : follows
  auth_users ||--o{ user_followed_categories : follows
  auth_users ||--o{ user_followed_organizers : follows
  auth_users ||--o{ device_tokens : owns

  festivals ||--o{ user_plan_festivals : planned
  festivals ||--o{ user_plan_reminders : reminder_for
  festivals ||--o{ user_notifications : notification_for

  festival_schedule_items ||--o{ user_plan_items : planned_item

  cities ||--o{ festivals : city_slug_logical
  cities ||--o{ user_followed_cities : follows_logical
```

> Some relationships (`cities` and several support tables) are logical/inferred from query usage rather than explicit FK declarations in the migration files available in this repository.
