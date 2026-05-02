-- Block soft-deleted accounts at the database for authenticated (anon JWT) access.
-- RESTRICTIVE policies AND with existing permissive row policies — they do not widen access.
-- service_role bypasses RLS. public.users is intentionally excluded.

-- ---------------------------------------------------------------------------
-- Helper expression (documented inline per policy for clarity in pg_policies).
-- ---------------------------------------------------------------------------
-- exists (
--   select 1 from public.users u
--   where u.id = (select auth.uid())
--   and u.deleted_at is null
-- )

-- ---------------------------------------------------------------------------
-- Plan & device data
-- ---------------------------------------------------------------------------
drop policy if exists "block_deleted_users" on public.user_plan_festivals;
create policy "block_deleted_users"
  on public.user_plan_festivals
  as restrictive
  for all
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
      and u.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
      and u.deleted_at is null
    )
  );

drop policy if exists "block_deleted_users" on public.user_plan_items;
create policy "block_deleted_users"
  on public.user_plan_items
  as restrictive
  for all
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
      and u.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
      and u.deleted_at is null
    )
  );

drop policy if exists "block_deleted_users" on public.user_plan_reminders;
create policy "block_deleted_users"
  on public.user_plan_reminders
  as restrictive
  for all
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
      and u.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
      and u.deleted_at is null
    )
  );

drop policy if exists "block_deleted_users" on public.device_tokens;
create policy "block_deleted_users"
  on public.device_tokens
  as restrictive
  for all
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
      and u.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
      and u.deleted_at is null
    )
  );

-- ---------------------------------------------------------------------------
-- Follows & notification / email preferences
-- ---------------------------------------------------------------------------
drop policy if exists "block_deleted_users" on public.user_followed_cities;
create policy "block_deleted_users"
  on public.user_followed_cities
  as restrictive
  for all
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
      and u.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
      and u.deleted_at is null
    )
  );

drop policy if exists "block_deleted_users" on public.user_followed_categories;
create policy "block_deleted_users"
  on public.user_followed_categories
  as restrictive
  for all
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
      and u.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
      and u.deleted_at is null
    )
  );

drop policy if exists "block_deleted_users" on public.user_followed_organizers;
create policy "block_deleted_users"
  on public.user_followed_organizers
  as restrictive
  for all
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
      and u.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
      and u.deleted_at is null
    )
  );

drop policy if exists "block_deleted_users" on public.user_notification_settings;
create policy "block_deleted_users"
  on public.user_notification_settings
  as restrictive
  for all
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
      and u.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
      and u.deleted_at is null
    )
  );

drop policy if exists "block_deleted_users" on public.user_email_preferences;
create policy "block_deleted_users"
  on public.user_email_preferences
  as restrictive
  for all
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
      and u.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
      and u.deleted_at is null
    )
  );

-- ---------------------------------------------------------------------------
-- Roles, notifications, organizer membership
-- ---------------------------------------------------------------------------
drop policy if exists "block_deleted_users" on public.user_roles;
create policy "block_deleted_users"
  on public.user_roles
  as restrictive
  for all
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
      and u.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
      and u.deleted_at is null
    )
  );

drop policy if exists "block_deleted_users" on public.user_notifications;
create policy "block_deleted_users"
  on public.user_notifications
  as restrictive
  for all
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
      and u.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
      and u.deleted_at is null
    )
  );

drop policy if exists "block_deleted_users" on public.organizer_members;
create policy "block_deleted_users"
  on public.organizer_members
  as restrictive
  for all
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
      and u.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
      and u.deleted_at is null
    )
  );
