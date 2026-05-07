-- Users hardening: audit fields on soft delete, RLS on user_roles (select own row only),
-- tighten public.users grants. Soft-delete + post-auth sweep RPCs: 20260503_admin_user_delete_uuid_compare.sql

-- ---------------------------------------------------------------------------
-- 1) public.users: who/when deleted (optional)
-- ---------------------------------------------------------------------------
alter table public.users add column if not exists deleted_by uuid references auth.users (id) on delete set null;
alter table public.users add column if not exists deleted_reason text;

-- ---------------------------------------------------------------------------
-- 2) Grants: users table — authenticated may only SELECT own row via RLS
-- ---------------------------------------------------------------------------
revoke all on table public.users from anon;
revoke all on table public.users from authenticated;
grant select on table public.users to authenticated;

drop policy if exists "users_select_self" on public.users;
create policy "users_select_self"
  on public.users
  for select
  to authenticated
  using (id = auth.uid());

-- No INSERT/UPDATE/DELETE policies for authenticated — only service_role (bypasses RLS).

-- ---------------------------------------------------------------------------
-- 3) user_roles — users may read own row only (admin APIs use service_role)
-- ---------------------------------------------------------------------------
alter table public.user_roles enable row level security;

revoke insert, update, delete on table public.user_roles from authenticated;
revoke insert, update, delete on table public.user_roles from anon;

grant select on table public.user_roles to authenticated;

drop policy if exists "user_roles_select_own" on public.user_roles;
create policy "user_roles_select_own"
  on public.user_roles
  for select
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Deprecated: replaced by 20260503_admin_user_delete_uuid_compare.sql
-- ---------------------------------------------------------------------------
