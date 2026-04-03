-- Phase 4: Resend webhook delivery visibility — email_events + summary columns on email_jobs.
-- Idempotent pieces use IF NOT EXISTS / OR REPLACE where safe.

-- ---------------------------------------------------------------------------
-- email_jobs: operational summary (full history lives in email_events)
-- ---------------------------------------------------------------------------
alter table public.email_jobs
  add column if not exists delivery_status text,
  add column if not exists delivered_at timestamptz,
  add column if not exists bounced_at timestamptz,
  add column if not exists last_event_type text,
  add column if not exists last_event_at timestamptz;

create index if not exists email_jobs_provider_message_id_idx
  on public.email_jobs (provider_message_id)
  where provider_message_id is not null;

create index if not exists email_jobs_delivery_status_idx
  on public.email_jobs (delivery_status)
  where delivery_status is not null;

-- ---------------------------------------------------------------------------
-- email_events
-- ---------------------------------------------------------------------------
create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  email_job_id uuid references public.email_jobs (id) on delete set null,
  provider text not null,
  provider_message_id text,
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  -- Svix delivery id (Resend docs: unique per webhook delivery; dedupe retries)
  webhook_delivery_id text
);

create unique index if not exists email_events_webhook_delivery_id_uidx
  on public.email_events (webhook_delivery_id)
  where webhook_delivery_id is not null;

create index if not exists email_events_email_job_id_idx
  on public.email_events (email_job_id);

create index if not exists email_events_provider_message_id_idx
  on public.email_events (provider_message_id);

create index if not exists email_events_event_type_idx
  on public.email_events (event_type);

create index if not exists email_events_occurred_at_desc_idx
  on public.email_events (occurred_at desc);

alter table public.email_events enable row level security;

grant select, insert, update, delete on public.email_events to service_role;
