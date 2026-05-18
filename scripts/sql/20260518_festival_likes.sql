-- Festival likes: social "favorite" signal, separate from `user_plan_festivals`
-- (which models "added to my plan / agenda"). One row per (user, festival).
--
-- Read access: public (anyone, anon or authenticated) — needed for global
-- `likes_count` aggregations on the listing/detail endpoints.
-- Write access: authenticated users, own rows only.

begin;

create table if not exists public.festival_likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  festival_id uuid not null references public.festivals(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, festival_id)
);

create index if not exists festival_likes_festival_id_idx
  on public.festival_likes (festival_id);

create index if not exists festival_likes_user_id_idx
  on public.festival_likes (user_id);

alter table public.festival_likes enable row level security;

-- Public read: like counts are a public social signal.
drop policy if exists "festival_likes_select_public" on public.festival_likes;
create policy "festival_likes_select_public"
  on public.festival_likes
  for select
  to anon, authenticated
  using (true);

drop policy if exists "festival_likes_insert_own" on public.festival_likes;
create policy "festival_likes_insert_own"
  on public.festival_likes
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "festival_likes_delete_own" on public.festival_likes;
create policy "festival_likes_delete_own"
  on public.festival_likes
  for delete
  to authenticated
  using (user_id = auth.uid());

commit;
