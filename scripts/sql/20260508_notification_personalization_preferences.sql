-- Personalized push preferences + additional notification job types.
-- Safe additive migration (no destructive changes).

alter table public.user_notification_settings
  add column if not exists notify_nearby_discovery boolean not null default true;

alter table public.user_notification_settings
  add column if not exists notify_trending_alerts boolean not null default true;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'notification_jobs_job_type_check'
  ) then
    alter table public.notification_jobs
      drop constraint notification_jobs_job_type_check;
  end if;
end $$;

alter table public.notification_jobs
  add constraint notification_jobs_job_type_check
  check (
    job_type in (
      'reminder',
      'update',
      'weekend',
      'new_city',
      'followed_organizer',
      'trending'
    )
  );

create index if not exists user_followed_organizers_organizer_user_idx
  on public.user_followed_organizers (organizer_id, user_id);

