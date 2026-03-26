-- Analytics tracking for push opens + follow-up actions.
-- Minimal append-only event stream; write path is server-side.

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event text not null,
  notification_id text,
  festival_id uuid references public.festivals(id) on delete set null,
  slug text,
  source text,
  metadata_json jsonb,
  created_at timestamptz not null default now(),
  constraint analytics_events_event_check
    check (event in ('push_open', 'festival_view', 'festival_saved', 'app_open'))
);

create index if not exists analytics_events_user_id_idx
  on public.analytics_events (user_id);

create index if not exists analytics_events_event_idx
  on public.analytics_events (event);

create index if not exists analytics_events_created_at_idx
  on public.analytics_events (created_at);

create index if not exists analytics_events_notification_id_idx
  on public.analytics_events (notification_id);

alter table public.analytics_events enable row level security;

drop policy if exists "analytics_events_insert_service_only" on public.analytics_events;
create policy "analytics_events_insert_service_only"
  on public.analytics_events
  for insert
  to service_role
  with check (true);

grant select, insert, update, delete on table public.analytics_events to service_role;

