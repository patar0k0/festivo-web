-- Outbound click tracking: append-only rows written from GET /out (service role); admins read via RLS.

create table if not exists public.outbound_clicks (
  id uuid primary key default gen_random_uuid(),
  festival_id uuid references public.festivals (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  destination_type text not null,
  target_url text not null,
  source text not null,
  created_at timestamptz not null default now()
);

create index if not exists outbound_clicks_created_at_idx
  on public.outbound_clicks (created_at desc);

create index if not exists outbound_clicks_festival_id_idx
  on public.outbound_clicks (festival_id);

create index if not exists outbound_clicks_destination_type_idx
  on public.outbound_clicks (destination_type);

alter table public.outbound_clicks enable row level security;

drop policy if exists "outbound_clicks_insert_service_only" on public.outbound_clicks;
create policy "outbound_clicks_insert_service_only"
  on public.outbound_clicks
  for insert
  to service_role
  with check (true);

drop policy if exists "outbound_clicks_admin_select" on public.outbound_clicks;
create policy "outbound_clicks_admin_select"
  on public.outbound_clicks
  for select
  to authenticated
  using (public.is_admin());

grant select, insert, update, delete on table public.outbound_clicks to service_role;
grant select on table public.outbound_clicks to authenticated;
