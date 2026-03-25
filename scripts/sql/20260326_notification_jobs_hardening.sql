-- Hardening: priority, retry_count (rename from attempts), dedupe indexes, notification_logs audit fields.
-- Idempotent; safe to re-run.

-- ---------------------------------------------------------------------------
-- notification_jobs: priority
-- ---------------------------------------------------------------------------
alter table public.notification_jobs
  add column if not exists priority text;

update public.notification_jobs
set priority = 'normal'
where priority is null;

alter table public.notification_jobs
  alter column priority set default 'normal';

alter table public.notification_jobs
  alter column priority set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'notification_jobs_priority_check'
  ) then
    alter table public.notification_jobs
      add constraint notification_jobs_priority_check
      check (priority in ('high', 'normal'));
  end if;
end $$;

update public.notification_jobs
set priority = case job_type
  when 'reminder' then 'high'
  when 'update' then 'high'
  when 'weekend' then 'normal'
  when 'new_city' then 'normal'
  else 'normal'
end;

-- ---------------------------------------------------------------------------
-- notification_jobs: attempts -> retry_count
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notification_jobs' and column_name = 'attempts'
  ) then
    alter table public.notification_jobs rename column attempts to retry_count;
  end if;
end $$;

alter table public.notification_jobs
  add column if not exists retry_count int not null default 0;

-- Dedupe / rate-limit lookups
create index if not exists notification_jobs_dedupe_window_idx
  on public.notification_jobs (user_id, job_type, festival_id, created_at desc);

create index if not exists notification_jobs_due_priority_idx
  on public.notification_jobs (priority asc, scheduled_for asc)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- notification_logs: duration, priority, notification_type
-- ---------------------------------------------------------------------------
alter table public.notification_logs
  add column if not exists duration_ms integer;

alter table public.notification_logs
  add column if not exists priority text;

alter table public.notification_logs
  add column if not exists notification_type text;

create index if not exists notification_logs_user_sent_created_idx
  on public.notification_logs (user_id, created_at desc)
  where status = 'sent';
