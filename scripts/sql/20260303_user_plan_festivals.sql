create table if not exists public.user_plan_festivals (
  user_id uuid not null references auth.users(id) on delete cascade,
  festival_id uuid not null references public.festivals(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, festival_id)
);

create index if not exists user_plan_festivals_user_id_idx
  on public.user_plan_festivals (user_id);

create index if not exists user_plan_festivals_festival_id_idx
  on public.user_plan_festivals (festival_id);

alter table public.user_plan_festivals enable row level security;

drop policy if exists "user_plan_festivals_select_own" on public.user_plan_festivals;
create policy "user_plan_festivals_select_own"
  on public.user_plan_festivals
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_plan_festivals_insert_own" on public.user_plan_festivals;
create policy "user_plan_festivals_insert_own"
  on public.user_plan_festivals
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "user_plan_festivals_delete_own" on public.user_plan_festivals;
create policy "user_plan_festivals_delete_own"
  on public.user_plan_festivals
  for delete
  to authenticated
  using (user_id = auth.uid());
