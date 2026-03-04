create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  festival_id uuid not null references public.festivals(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, festival_id, scheduled_for)
);

create index if not exists user_notifications_sent_at_idx
  on public.user_notifications (sent_at);

create index if not exists user_notifications_scheduled_for_idx
  on public.user_notifications (scheduled_for);

create index if not exists user_notifications_user_id_scheduled_for_idx
  on public.user_notifications (user_id, scheduled_for);

alter table public.user_notifications enable row level security;

drop policy if exists "user_notifications_select_own" on public.user_notifications;
create policy "user_notifications_select_own"
  on public.user_notifications
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_notifications_insert_service_only" on public.user_notifications;
create policy "user_notifications_insert_service_only"
  on public.user_notifications
  for insert
  to service_role
  with check (true);
