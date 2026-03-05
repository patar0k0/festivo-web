# Festivo Database Schema (working documentation)

> Note: the full Supabase `pg_dump` schema was not present in this workspace input, so this document is compiled from SQL migrations and live query usage in the codebase. Fields and constraints marked as **inferred** should be verified against the canonical schema dump.

## Core content tables

### festivals

**Purpose:** Primary catalog of festivals shown in web and mobile clients.

| column | type | notes |
|---|---|---|
| id | uuid (inferred) | primary key (inferred) |
| title | text | festival title |
| slug | text | URL slug; used for festival detail routes |
| description | text | long description |
| city | text | denormalized city slug (canonical; mirrors `cities.slug`) |
| city_id | bigint | FK to `cities.id` (canonical city reference) |
| region | text | administrative region |
| address | text | optional venue address |
| start_date | date / timestamptz (inferred) | festival start |
| end_date | date / timestamptz (inferred) | festival end; nullable |
| category | text | category label |
| category_slug | text | normalized category used for follows |
| image_url | text | hero image URL |
| is_free | boolean | free/paid flag |
| status | text | moderation/publish status (`draft`, `verified`, etc.) |
| is_verified | boolean | legacy/public visibility flag |
| lat | numeric / double precision (inferred) | latitude |
| lng | numeric / double precision (inferred) | longitude |
| website_url | text | official website |
| ticket_url | text | ticket purchase URL |
| price_range | text | price text |
| tags | text[] (inferred) | tag filtering |
| organizer_id | uuid | FK to organizers (used by notifications) |
| source_type | text | ingestion/source metadata |
| updated_at | timestamptz | last admin update |

**Primary keys:** `id` (inferred).  
**Foreign keys:** `organizer_id -> organizers.id` (inferred from usage).  
**Relationships:**
- `festivals -> festival_days` (1:N)
- `festivals -> festival_media` (1:N)
- `festivals -> user_plan_festivals` (1:N)
- `festivals -> user_notifications` (1:N)
- `festivals -> user_plan_reminders` (1:N, inferred)
- `festivals -> organizers` (N:1, inferred)

**Constraints / indexes visible:**
- unique partial index `festivals_source_url_unique_idx` on `(source_url)` where `source_url is not null`

---

### pending_festivals

**Purpose:** Moderation layer for newly submitted/ingested festivals before they are approved into the main `festivals` catalog.

| column | type | notes |
|---|---|---|
| id | uuid | primary key; default `gen_random_uuid()` |
| title | text | not null |
| slug | text | optional proposed URL slug |
| description | text | optional description |
| city_id | bigint | optional FK to `cities.id` |
| location_name | text | optional venue/location text |
| latitude | numeric | optional latitude |
| longitude | numeric | optional longitude |
| start_date | date | optional festival start date |
| end_date | date | optional festival end date |
| organizer_name | text | optional organizer display name |
| source_url | text | ingestion/source reference URL |
| is_free | boolean | default `true` |
| hero_image | text | optional hero image URL |
| status | text | not null, default `pending`; allowed: `pending`, `approved`, `rejected` |
| created_at | timestamptz | not null, default `now()` |
| reviewed_at | timestamptz | set when moderation review is completed |
| reviewed_by | uuid | optional FK to `auth.users.id` |

**Primary keys:** `id`.  
**Foreign keys:**
- `city_id -> cities.id`
- `reviewed_by -> auth.users.id`

**Relationships:**
- `pending_festivals -> cities` (N:1)
- `pending_festivals -> auth.users` (N:1, reviewer)

**Constraints / indexes visible:**
- `status` check constraint allows only `pending`, `approved`, `rejected`
- `pending_festivals_status_idx` on `(status)`
- unique partial index `pending_festivals_source_url_unique_idx` on `(source_url)` where `source_url is not null`
- RLS enabled with admin-only `SELECT`, `UPDATE`, and `DELETE` policies
- No user-facing `INSERT` RLS policy (worker/service role bypasses RLS)

---

### ingest_jobs

**Purpose:** Queue table for source URLs submitted by admins and consumed later by ingestion workers before moderation in `pending_festivals`.

| column | type | notes |
|---|---|---|
| id | uuid | primary key; default `gen_random_uuid()` |
| source_url | text | not null; deduplicated unique source URL |
| source_type | text | not null; default `facebook_event` |
| status | text | not null; default `pending`; allowed: `pending`, `processing`, `done`, `failed` |
| error | text | optional processing error details |
| created_at | timestamptz | not null; default `now()` |
| started_at | timestamptz | set when worker starts processing |
| finished_at | timestamptz | set when worker finishes processing |

**Primary keys:** `id`.  
**Relationships:**
- Ingestion workers read `ingest_jobs` and write parsed output into `pending_festivals` (application-level workflow).

**Constraints / indexes visible:**
- `status` check constraint allows only `pending`, `processing`, `done`, `failed`
- `ingest_jobs_status_created_at_idx` on `(status, created_at desc)`
- unique index `ingest_jobs_source_url_unique_idx` on `(source_url)`
- RLS enabled with admin-only `SELECT`, `INSERT`, `UPDATE`, and `DELETE` policies (authenticated + `public.is_admin()`)

---

### festival_days

**Purpose:** Day-level breakdown for multi-day festivals.

| column | type | notes |
|---|---|---|
| id | uuid (inferred) | primary key (inferred) |
| festival_id | uuid | references `festivals.id` |
| date | date | calendar day |
| title | text | optional day label |

**Primary keys:** `id` (inferred).  
**Foreign keys:** `festival_id -> festivals.id` (inferred from queries).  
**Relationships:**
- `festival_days -> festivals` (N:1)
- `festival_days -> festival_schedule_items` (1:N)

**Constraints / indexes visible:** not defined in the checked migration files.

---

### festival_schedule_items

**Purpose:** Program/schedule entries within each festival day.

| column | type | notes |
|---|---|---|
| id | uuid (inferred) | primary key (inferred) |
| day_id | uuid | references `festival_days.id` |
| start_time | timestamptz / time (inferred) | schedule start |
| end_time | timestamptz / time (inferred) | schedule end |
| stage | text | optional stage/location |
| title | text | item title |
| description | text | item description |
| sort_order | integer | ordering hint |

**Primary keys:** `id` (inferred).  
**Foreign keys:** `day_id -> festival_days.id` (inferred).  
**Relationships:**
- `festival_schedule_items -> festival_days` (N:1)
- `festival_schedule_items -> user_plan_items` (1:N, inferred)

**Constraints / indexes visible:** not defined in the checked migration files.

---

### festival_media

**Purpose:** Media gallery items for festival detail pages.

| column | type | notes |
|---|---|---|
| id | uuid (inferred) | primary key (inferred) |
| festival_id | uuid | references `festivals.id` |
| url | text | media URL |
| type | text | media type (`image`, etc.) |
| caption | text | optional caption |
| sort_order | integer | display ordering |

**Primary keys:** `id` (inferred).  
**Foreign keys:** `festival_id -> festivals.id` (inferred).  
**Relationships:** `festival_media -> festivals` (N:1).

**Constraints / indexes visible:** not defined in the checked migration files.

---

### cities

**Purpose:** Canonical city directory used for SEO slugs and filtering.

| column | type | notes |
|---|---|---|
| slug | text | city slug; likely unique |
| name_bg | text | city name in Bulgarian |

**Primary keys:** not visible (likely `slug` or `id` in canonical schema).  
**Foreign keys:** none visible.  
**Relationships:**
- `festivals.city_id -> cities.id` (canonical FK)
- denormalized `festivals.city` stores `cities.slug` for route/filter convenience

**Constraints / indexes visible:** not defined in the checked migration files.

---

### organizers

**Purpose:** Organizer entities followed by users and linked to festivals.

| column | type | notes |
|---|---|---|
| id | uuid | referenced by `festivals.organizer_id` and `user_followed_organizers.organizer_id` |

**Primary keys:** `id` (inferred).  
**Foreign keys:** none visible on table definition (only referenced by others).  
**Relationships:**
- `organizers -> festivals` (1:N, inferred)
- `organizers -> user_followed_organizers` (1:N)

**Constraints / indexes visible:** not defined in the checked migration files.

## User plan, reminder, and notification tables

### user_plan_items

**Purpose:** User-selected schedule items in personal plan.

| column | type | notes |
|---|---|---|
| user_id | uuid | references `auth.users.id` (inferred) |
| schedule_item_id | uuid | references `festival_schedule_items.id` (inferred) |

**Primary keys:** likely composite `(user_id, schedule_item_id)` (inferred).  
**Foreign keys:**
- `user_id -> auth.users.id` (inferred)
- `schedule_item_id -> festival_schedule_items.id` (inferred)

**Relationships:**
- `user_plan_items -> auth.users` (N:1)
- `user_plan_items -> festival_schedule_items` (N:1)

**Constraints / indexes visible:** not defined in the checked migration files.

---

### user_plan_festivals

**Purpose:** Festival-level “saved to plan” records.

| column | type | notes |
|---|---|---|
| user_id | uuid | not null; FK to `auth.users(id)` |
| festival_id | uuid | not null; FK to `festivals(id)` |
| created_at | timestamptz | default `now()` |

**Primary keys:** composite `(user_id, festival_id)`.  
**Foreign keys:**
- `user_id -> auth.users.id` ON DELETE CASCADE
- `festival_id -> festivals.id` ON DELETE CASCADE

**Relationships:**
- `user_plan_festivals -> auth.users` (N:1)
- `user_plan_festivals -> festivals` (N:1)

**Constraints / indexes visible:**
- PK index on `(user_id, festival_id)`
- `user_plan_festivals_user_id_idx` on `(user_id)`
- `user_plan_festivals_festival_id_idx` on `(festival_id)`
- RLS enabled with per-user SELECT/INSERT/DELETE policies

---

### user_plan_reminders

**Purpose:** Reminder preferences per user+festival.

| column | type | notes |
|---|---|---|
| user_id | uuid | references `auth.users.id` (inferred) |
| festival_id | uuid | references `festivals.id` (inferred) |
| reminder_type | text | used values: `24h`, `same_day_09`, `none` (app-level) |

**Primary keys:** likely composite `(user_id, festival_id)` (inferred).  
**Foreign keys:** user and festival FKs are inferred from joins/usage.  
**Relationships:**
- `user_plan_reminders -> auth.users` (N:1)
- `user_plan_reminders -> festivals` (N:1)

**Constraints / indexes visible:** not defined in the checked migration files.

---

### user_notifications

**Purpose:** Notification outbox/history for reminder and new-festival alerts.

| column | type | notes |
|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` |
| user_id | uuid | not null; FK to `auth.users(id)` |
| festival_id | uuid | not null; FK to `festivals(id)` |
| type | text | notification type key |
| title | text | notification title |
| body | text | notification body |
| scheduled_for | timestamptz | scheduled send time |
| sent_at | timestamptz | null until sent |
| pushed_at | timestamptz (inferred) | null until push dispatch completed |
| created_at | timestamptz | default `now()` |

**Primary keys:** `id`.  
**Foreign keys:**
- `user_id -> auth.users.id` ON DELETE CASCADE
- `festival_id -> festivals.id` ON DELETE CASCADE

**Relationships:**
- `user_notifications -> auth.users` (N:1)
- `user_notifications -> festivals` (N:1)

**Constraints / indexes visible:**
- unique constraint on `(user_id, festival_id, scheduled_for)`
- unique index `user_notifications_user_festival_type_key` on `(user_id, festival_id, type)`
- `user_notifications_sent_at_idx` on `(sent_at)`
- `user_notifications_scheduled_for_idx` on `(scheduled_for)`
- `user_notifications_user_id_scheduled_for_idx` on `(user_id, scheduled_for)`
- RLS enabled; users can select own rows, inserts limited to `service_role`

---

### user_notification_settings

**Purpose:** Per-user notification preference flags.

| column | type | notes |
|---|---|---|
| user_id | uuid | PK; FK to `auth.users(id)` |
| notify_plan_reminders | boolean | default `true` |
| notify_new_festivals_city | boolean | default `true` |
| notify_new_festivals_category | boolean | default `false` |
| notify_followed_organizers | boolean | default `true` |
| notify_weekend_digest | boolean | default `false` |
| created_at | timestamptz | default `now()` |

**Primary keys:** `user_id`.  
**Foreign keys:** `user_id -> auth.users.id` ON DELETE CASCADE.  
**Relationships:** `user_notification_settings -> auth.users` (1:1).

**Constraints / indexes visible:** RLS enabled; per-user SELECT/INSERT/UPDATE policies.

---

### user_followed_cities

**Purpose:** Cities followed by each user for new festival notifications.

| column | type | notes |
|---|---|---|
| user_id | uuid | FK to `auth.users(id)` |
| city_slug | text | followed city slug |
| created_at | timestamptz | default `now()` |

**Primary keys:** composite `(user_id, city_slug)`.  
**Foreign keys:** `user_id -> auth.users.id` ON DELETE CASCADE.  
**Relationships:**
- `user_followed_cities -> auth.users` (N:1)
- logical link `city_slug -> cities.slug` (not declared in shown SQL)

**Constraints / indexes visible:**
- `user_followed_cities_user_id_idx` on `(user_id)`
- `user_followed_cities_city_slug_idx` on `(city_slug)`
- RLS enabled; per-user SELECT/INSERT/DELETE policies

---

### user_followed_categories

**Purpose:** Categories followed by each user for new festival notifications.

| column | type | notes |
|---|---|---|
| user_id | uuid | FK to `auth.users(id)` |
| category_slug | text | followed category slug |
| created_at | timestamptz | default `now()` |

**Primary keys:** composite `(user_id, category_slug)`.  
**Foreign keys:** `user_id -> auth.users.id` ON DELETE CASCADE.  
**Relationships:** `user_followed_categories -> auth.users` (N:1).

**Constraints / indexes visible:**
- `user_followed_categories_user_id_idx` on `(user_id)`
- `user_followed_categories_category_slug_idx` on `(category_slug)`
- RLS enabled; per-user SELECT/INSERT/DELETE policies

---

### user_followed_organizers

**Purpose:** Organizers followed by each user.

| column | type | notes |
|---|---|---|
| user_id | uuid | FK to `auth.users(id)` |
| organizer_id | uuid | FK to `organizers(id)` |
| created_at | timestamptz | default `now()` |

**Primary keys:** composite `(user_id, organizer_id)`.  
**Foreign keys:**
- `user_id -> auth.users.id` ON DELETE CASCADE
- `organizer_id -> organizers.id` ON DELETE CASCADE

**Relationships:**
- `user_followed_organizers -> auth.users` (N:1)
- `user_followed_organizers -> organizers` (N:1)

**Constraints / indexes visible:**
- `user_followed_organizers_user_id_idx` on `(user_id)`
- `user_followed_organizers_organizer_id_idx` on `(organizer_id)`
- RLS enabled; per-user SELECT/INSERT/DELETE policies

## Auth/admin/infra support tables

### user_roles

**Purpose:** Role assignments (e.g., admin authorization).

| column | type | notes |
|---|---|---|
| user_id | uuid | references authenticated user |
| role | text | role value (`admin` used) |

**Primary keys:** not visible.  
**Foreign keys:** likely `user_id -> auth.users.id` (inferred).  
**Relationships:** `user_roles -> auth.users` (N:1).

**Constraints / indexes visible:** RLS enabled; policy allows users to read only own rows.

---

### cron_locks

**Purpose:** Lightweight lock table for scheduled jobs.

| column | type | notes |
|---|---|---|
| name | text | lock key (`reminders_job`) |
| locked_at | timestamptz | lock timestamp |

**Primary keys:** likely `name` (inferred from upsert `onConflict: name`).  
**Foreign keys:** none.  
**Relationships:** none.

**Constraints / indexes visible:** uniqueness/PK on `name` is inferred from upsert conflict target.

---

### device_tokens

**Purpose:** Push notification device registration tokens.

| column | type | notes |
|---|---|---|
| user_id | uuid | token owner (inferred) |
| token | text | push token |

**Primary keys:** not visible.  
**Foreign keys:** likely `user_id -> auth.users.id` (inferred).  
**Relationships:** `device_tokens -> auth.users` (N:1).

**Constraints / indexes visible:** not defined in the checked migration files.

---

### auth.users (Supabase managed)

**Purpose:** Auth identity table owned by Supabase Auth.

| column | type | notes |
|---|---|---|
| id | uuid | primary key; referenced by most user-scoped tables |

**Primary keys:** `id`.  
**Foreign keys:** referenced by many `public.*` tables listed above.  
**Relationships:** parent side of all user-bound tables.

## Relationship notes (quick map)

- festivals → organizers  
- festivals → cities (via `city_id` FK + denormalized `city` slug)  
- festival_days → festivals  
- festival_schedule_items → festival_days  
- festival_media → festivals  
- user_plan_items → festival_schedule_items  
- user_plan_festivals → festivals  
- user_plan_reminders → festivals  
- user_notifications → festivals  
- user_followed_organizers → organizers  
- user-scoped tables → auth.users
