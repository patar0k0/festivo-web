-- Phase 5: user-owned email preferences + global unsubscribe token for optional emails.
-- Required transactional / admin alert emails are not gated by this table.

create table if not exists public.user_email_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reminder_emails_enabled boolean not null default true,
  organizer_update_emails_enabled boolean not null default true,
  marketing_emails_enabled boolean not null default true,
  unsubscribed_all_optional boolean not null default false,
  unsubscribe_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_email_preferences_unsubscribe_token_key
  on public.user_email_preferences (unsubscribe_token);

alter table public.user_email_preferences enable row level security;

drop policy if exists "user_email_preferences_select_own" on public.user_email_preferences;
create policy "user_email_preferences_select_own"
  on public.user_email_preferences
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_email_preferences_insert_own" on public.user_email_preferences;
create policy "user_email_preferences_insert_own"
  on public.user_email_preferences
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "user_email_preferences_update_own" on public.user_email_preferences;
create policy "user_email_preferences_update_own"
  on public.user_email_preferences
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on table public.user_email_preferences to authenticated;
grant all on table public.user_email_preferences to service_role;
