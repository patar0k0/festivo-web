-- Phase 1: queue-first transactional email jobs (Resend), server-side only.
-- Idempotent pieces use IF NOT EXISTS / OR REPLACE where safe.

-- ---------------------------------------------------------------------------
-- email_jobs
-- ---------------------------------------------------------------------------
create table if not exists public.email_jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  recipient_email text not null,
  recipient_user_id uuid references auth.users (id) on delete set null,
  locale text not null default 'bg',
  subject text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  scheduled_at timestamptz not null default now(),
  dedupe_key text,
  provider text,
  provider_message_id text,
  last_error text,
  sent_at timestamptz,
  locked_at timestamptz,
  processing_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_jobs_status_check
    check (status in ('pending', 'processing', 'sent', 'failed'))
);

create unique index if not exists email_jobs_dedupe_key_uidx
  on public.email_jobs (dedupe_key)
  where dedupe_key is not null;

create index if not exists email_jobs_status_scheduled_idx
  on public.email_jobs (status, scheduled_at);

create index if not exists email_jobs_locked_at_idx
  on public.email_jobs (locked_at)
  where status = 'processing';

alter table public.email_jobs enable row level security;

grant select, insert, update, delete on public.email_jobs to service_role;

-- ---------------------------------------------------------------------------
-- Atomically claim due rows (SKIP LOCKED) for safe concurrent workers
-- ---------------------------------------------------------------------------
create or replace function public.claim_due_email_jobs(p_limit integer default 10)
returns setof public.email_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with picked as (
    select ej.id
    from public.email_jobs ej
    where ej.status = 'pending'
      and ej.scheduled_at <= now()
    order by ej.scheduled_at asc
    limit greatest(1, least(coalesce(p_limit, 10), 100))
    for update skip locked
  )
  update public.email_jobs j
  set
    status = 'processing',
    locked_at = now(),
    processing_started_at = now(),
    updated_at = now()
  from picked
  where j.id = picked.id
  returning j.*;
end;
$$;

revoke all on function public.claim_due_email_jobs(integer) from public;
grant execute on function public.claim_due_email_jobs(integer) to service_role;
