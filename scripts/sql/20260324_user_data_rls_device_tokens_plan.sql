-- RLS for user-owned tables that were missing policies in-repo.
-- Apply in Supabase SQL editor or your migration runner after confirming tables exist.

-- ---------------------------------------------------------------------------
-- public.device_tokens (mobile push registration; upsert from authenticated API)
-- ---------------------------------------------------------------------------
alter table public.device_tokens enable row level security;

drop policy if exists "device_tokens_select_own" on public.device_tokens;
create policy "device_tokens_select_own"
  on public.device_tokens
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "device_tokens_insert_own" on public.device_tokens;
create policy "device_tokens_insert_own"
  on public.device_tokens
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "device_tokens_update_own" on public.device_tokens;
create policy "device_tokens_update_own"
  on public.device_tokens
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "device_tokens_delete_own" on public.device_tokens;
create policy "device_tokens_delete_own"
  on public.device_tokens
  for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- public.user_plan_items (authenticated plan toggles per schedule item)
-- ---------------------------------------------------------------------------
alter table public.user_plan_items enable row level security;

drop policy if exists "user_plan_items_select_own" on public.user_plan_items;
create policy "user_plan_items_select_own"
  on public.user_plan_items
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_plan_items_insert_own" on public.user_plan_items;
create policy "user_plan_items_insert_own"
  on public.user_plan_items
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "user_plan_items_delete_own" on public.user_plan_items;
create policy "user_plan_items_delete_own"
  on public.user_plan_items
  for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- public.user_plan_reminders (authenticated reminder prefs; upsert + delete)
-- ---------------------------------------------------------------------------
alter table public.user_plan_reminders enable row level security;

drop policy if exists "user_plan_reminders_select_own" on public.user_plan_reminders;
create policy "user_plan_reminders_select_own"
  on public.user_plan_reminders
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_plan_reminders_insert_own" on public.user_plan_reminders;
create policy "user_plan_reminders_insert_own"
  on public.user_plan_reminders
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "user_plan_reminders_update_own" on public.user_plan_reminders;
create policy "user_plan_reminders_update_own"
  on public.user_plan_reminders
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "user_plan_reminders_delete_own" on public.user_plan_reminders;
create policy "user_plan_reminders_delete_own"
  on public.user_plan_reminders
  for delete
  to authenticated
  using (user_id = auth.uid());
