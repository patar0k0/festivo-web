create table if not exists public.user_followed_cities (
  user_id uuid not null references auth.users(id) on delete cascade,
  city_slug text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, city_slug)
);

create table if not exists public.user_followed_categories (
  user_id uuid not null references auth.users(id) on delete cascade,
  category_slug text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, category_slug)
);

create table if not exists public.user_followed_organizers (
  user_id uuid not null references auth.users(id) on delete cascade,
  organizer_id uuid not null references public.organizers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, organizer_id)
);

create table if not exists public.user_notification_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  notify_plan_reminders boolean not null default true,
  notify_new_festivals_city boolean not null default true,
  notify_new_festivals_category boolean not null default false,
  notify_followed_organizers boolean not null default true,
  notify_weekend_digest boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists user_followed_cities_user_id_idx
  on public.user_followed_cities (user_id);

create index if not exists user_followed_categories_user_id_idx
  on public.user_followed_categories (user_id);

create index if not exists user_followed_organizers_user_id_idx
  on public.user_followed_organizers (user_id);

create index if not exists user_followed_cities_city_slug_idx
  on public.user_followed_cities (city_slug);

create index if not exists user_followed_categories_category_slug_idx
  on public.user_followed_categories (category_slug);

create index if not exists user_followed_organizers_organizer_id_idx
  on public.user_followed_organizers (organizer_id);

create unique index if not exists user_notifications_user_festival_type_key
  on public.user_notifications (user_id, festival_id, type);

alter table public.user_followed_cities enable row level security;
alter table public.user_followed_categories enable row level security;
alter table public.user_followed_organizers enable row level security;
alter table public.user_notification_settings enable row level security;

drop policy if exists "user_followed_cities_select_own" on public.user_followed_cities;
create policy "user_followed_cities_select_own"
  on public.user_followed_cities
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_followed_cities_insert_own" on public.user_followed_cities;
create policy "user_followed_cities_insert_own"
  on public.user_followed_cities
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "user_followed_cities_delete_own" on public.user_followed_cities;
create policy "user_followed_cities_delete_own"
  on public.user_followed_cities
  for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_followed_categories_select_own" on public.user_followed_categories;
create policy "user_followed_categories_select_own"
  on public.user_followed_categories
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_followed_categories_insert_own" on public.user_followed_categories;
create policy "user_followed_categories_insert_own"
  on public.user_followed_categories
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "user_followed_categories_delete_own" on public.user_followed_categories;
create policy "user_followed_categories_delete_own"
  on public.user_followed_categories
  for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_followed_organizers_select_own" on public.user_followed_organizers;
create policy "user_followed_organizers_select_own"
  on public.user_followed_organizers
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_followed_organizers_insert_own" on public.user_followed_organizers;
create policy "user_followed_organizers_insert_own"
  on public.user_followed_organizers
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "user_followed_organizers_delete_own" on public.user_followed_organizers;
create policy "user_followed_organizers_delete_own"
  on public.user_followed_organizers
  for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_notification_settings_select_own" on public.user_notification_settings;
create policy "user_notification_settings_select_own"
  on public.user_notification_settings
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_notification_settings_insert_own" on public.user_notification_settings;
create policy "user_notification_settings_insert_own"
  on public.user_notification_settings
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "user_notification_settings_update_own" on public.user_notification_settings;
create policy "user_notification_settings_update_own"
  on public.user_notification_settings
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
