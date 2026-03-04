create table if not exists public.pending_festivals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text,
  description text,
  city_id bigint references public.cities(id),
  location_name text,
  latitude numeric,
  longitude numeric,
  start_date date,
  end_date date,
  organizer_name text,
  source_url text,
  is_free boolean not null default true,
  hero_image text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);

create index if not exists pending_festivals_status_idx
  on public.pending_festivals (status);

create unique index if not exists pending_festivals_source_url_unique_idx
  on public.pending_festivals (source_url)
  where source_url is not null;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = 'admin'
  );
$$;

alter table public.pending_festivals enable row level security;

drop policy if exists "pending_festivals_admin_select" on public.pending_festivals;
create policy "pending_festivals_admin_select"
  on public.pending_festivals
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "pending_festivals_admin_update" on public.pending_festivals;
create policy "pending_festivals_admin_update"
  on public.pending_festivals
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "pending_festivals_admin_delete" on public.pending_festivals;
create policy "pending_festivals_admin_delete"
  on public.pending_festivals
  for delete
  to authenticated
  using (public.is_admin());
