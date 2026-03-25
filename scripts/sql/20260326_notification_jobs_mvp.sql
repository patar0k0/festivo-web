-- MVP notification jobs + logs; extend device_tokens and user_notification_settings.
-- Run against Supabase Postgres; service_role used by server jobs.

-- ---------------------------------------------------------------------------
-- device_tokens: soft-invalidate tokens when FCM reports permanent failure
-- ---------------------------------------------------------------------------
alter table public.device_tokens
  add column if not exists invalidated_at timestamptz;

create index if not exists device_tokens_user_valid_idx
  on public.device_tokens (user_id)
  where invalidated_at is null;

-- ---------------------------------------------------------------------------
-- user_notification_settings: push + quiet hours + weekend scope
-- ---------------------------------------------------------------------------
alter table public.user_notification_settings
  add column if not exists push_enabled boolean not null default true;

alter table public.user_notification_settings
  add column if not exists only_saved boolean not null default false;

alter table public.user_notification_settings
  add column if not exists quiet_hours_start time;

alter table public.user_notification_settings
  add column if not exists quiet_hours_end time;

-- Optional region slugs for weekend/discovery (e.g. matches festivals.region text)
alter table public.user_notification_settings
  add column if not exists region_slugs text[] not null default '{}';

-- ---------------------------------------------------------------------------
-- user_notifications: delivery marker (may already exist in prod)
-- ---------------------------------------------------------------------------
alter table public.user_notifications
  add column if not exists pushed_at timestamptz;

-- ---------------------------------------------------------------------------
-- notification_jobs: durable scheduled work
-- ---------------------------------------------------------------------------
create table if not exists public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  festival_id uuid references public.festivals(id) on delete cascade,
  job_type text not null,
  scheduled_for timestamptz not null,
  dedupe_key text not null,
  payload_json jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_jobs_job_type_check
    check (job_type in ('reminder', 'update', 'weekend', 'new_city')),
  constraint notification_jobs_status_check
    check (status in ('pending', 'sent', 'failed', 'cancelled'))
);

create unique index if not exists notification_jobs_dedupe_key_idx
  on public.notification_jobs (dedupe_key);

create index if not exists notification_jobs_due_idx
  on public.notification_jobs (scheduled_for, status)
  where status = 'pending';

create index if not exists notification_jobs_user_idx
  on public.notification_jobs (user_id, created_at desc);

alter table public.notification_jobs enable row level security;

-- ---------------------------------------------------------------------------
-- notification_logs: per-send audit
-- ---------------------------------------------------------------------------
create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.notification_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null,
  response jsonb,
  created_at timestamptz not null default now()
);

create index if not exists notification_logs_job_id_idx
  on public.notification_logs (job_id);

create index if not exists notification_logs_user_created_idx
  on public.notification_logs (user_id, created_at desc);

alter table public.notification_logs enable row level security;

-- Grants: server-side jobs only (authenticated clients use existing APIs)
grant select, insert, update, delete on public.notification_jobs to service_role;
grant select, insert, update, delete on public.notification_logs to service_role;
