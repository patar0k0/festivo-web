-- Admin users: soft-delete shadow table, app roles on user_roles, organizer viewer role,
-- is_admin() includes super_admin. Force-logout RPC: 20260503_admin_user_delete_uuid_compare.sql

-- 1) public.users: optional row per auth user; deleted_at set => soft-deleted (blocked at middleware).
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  deleted_at timestamptz null
);

create index if not exists idx_users_deleted_at
  on public.users (deleted_at);

alter table public.users enable row level security;

drop policy if exists "users_select_self" on public.users;
create policy "users_select_self"
  on public.users
  for select
  to authenticated
  using (id = auth.uid());

-- 2) user_roles: one row per user (app role). Migrate from admin-only rows.
alter table public.user_roles drop constraint if exists user_roles_role_check;

delete from public.user_roles ur
using public.user_roles ur2
where ur.user_id = ur2.user_id
  and ur.ctid < ur2.ctid;

create unique index if not exists user_roles_user_id_unique
  on public.user_roles (user_id);

alter table public.user_roles
  add constraint user_roles_role_check
  check (role in ('user', 'organizer', 'admin', 'super_admin'));

-- 3) Organizer memberships: viewer (read-oriented portal role).
alter table public.organizer_members drop constraint if exists organizer_members_role_check;
alter table public.organizer_members
  add constraint organizer_members_role_check
  check (role in ('owner', 'admin', 'editor', 'viewer'));

-- 4) is_admin(): staff admin or super_admin
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'super_admin')
  );
$$;

-- Deprecated: replaced by 20260503_admin_user_delete_uuid_compare.sql
