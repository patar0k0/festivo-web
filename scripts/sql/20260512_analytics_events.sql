-- Create the analytics_events table referenced by:
--   - POST /api/analytics/track
--   - POST /api/mobile/follow-feed (event filtering)
--   - POST /api/mobile/recommendations (event filtering)
--   - account hard-delete / soft-delete sweepers
--
-- Until now the table did not exist and every analytics insert logged
-- "Could not find the table 'public.analytics_events' in the schema cache".

begin;

create table if not exists public.analytics_events (
  id              bigserial primary key,
  user_id         uuid references auth.users(id) on delete set null,
  event           text not null,
  notification_id text,
  festival_id     uuid,
  slug            text,
  source          text,
  metadata_json   jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists analytics_events_user_id_created_at_idx
  on public.analytics_events (user_id, created_at desc);

create index if not exists analytics_events_event_created_at_idx
  on public.analytics_events (event, created_at desc);

create index if not exists analytics_events_festival_id_idx
  on public.analytics_events (festival_id);

-- Locked down to service-role only (admin writes from server routes).
-- The client never reads this table directly.
alter table public.analytics_events enable row level security;

drop policy if exists "analytics_events_no_anon" on public.analytics_events;
create policy "analytics_events_no_anon"
  on public.analytics_events
  for select
  to authenticated
  using (false);

commit;
