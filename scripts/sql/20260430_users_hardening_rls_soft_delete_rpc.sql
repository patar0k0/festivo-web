-- Users hardening: audit fields on soft delete, RPC for atomic soft-delete + session revoke,
-- post-auth orphan sweep, RLS on user_roles (select own row only), tighten public.users grants.

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
-- 4) Soft delete / restore (refresh token revoke + users row) in one transaction
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_user_soft_deleted(
  target_user_id uuid,
  is_deleted boolean,
  actor_user_id uuid default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = auth, public
as $$
begin
  if is_deleted then
    delete from auth.refresh_tokens where user_id = target_user_id;
    insert into public.users (id, deleted_at, deleted_by, deleted_reason)
    values (target_user_id, now(), actor_user_id, nullif(trim(p_reason), ''))
    on conflict (id) do update set
      deleted_at = excluded.deleted_at,
      deleted_by = excluded.deleted_by,
      deleted_reason = excluded.deleted_reason;
  else
    insert into public.users (id, deleted_at, deleted_by, deleted_reason)
    values (target_user_id, null, null, null)
    on conflict (id) do update set
      deleted_at = null,
      deleted_by = null,
      deleted_reason = null;
  end if;
end;
$$;

revoke all on function public.admin_set_user_soft_deleted(uuid, boolean, uuid, text) from public;
grant execute on function public.admin_set_user_soft_deleted(uuid, boolean, uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 5) After auth.admin.deleteUser: sweep public/orphan rows (do not rely on FK cascade)
-- ---------------------------------------------------------------------------
create or replace function public.admin_sweep_user_after_auth_delete(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = auth, public
as $$
begin
  delete from auth.refresh_tokens where user_id = p_user_id;
  delete from public.organizer_members where user_id = p_user_id;
  delete from public.user_roles where user_id = p_user_id;
  delete from public.user_plan_reminders where user_id = p_user_id;
  delete from public.device_tokens where user_id = p_user_id;
  delete from public.users where id = p_user_id;
end;
$$;

revoke all on function public.admin_sweep_user_after_auth_delete(uuid) from public;
grant execute on function public.admin_sweep_user_after_auth_delete(uuid) to service_role;
