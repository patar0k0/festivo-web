-- Users hardening: audit fields on soft delete, RPC for atomic soft-delete + session revoke,
-- post-auth orphan sweep (returns jsonb delete counts), RLS on user_roles (select own row only),
-- tighten public.users grants. Soft-delete reason: HTML-like tags stripped server-side, max 2000 chars.

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
declare
  v_reason text;
begin
  if is_deleted then
    v_reason := nullif(
      left(
        trim(
          regexp_replace(coalesce(p_reason, ''), '<[^>]*>', '', 'gi')
        ),
        2000
      ),
      ''
    );
    delete from auth.refresh_tokens where user_id = target_user_id;
    insert into public.users (id, deleted_at, deleted_by, deleted_reason)
    values (target_user_id, now(), actor_user_id, v_reason)
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
drop function if exists public.admin_sweep_user_after_auth_delete(uuid);

create or replace function public.admin_sweep_user_after_auth_delete(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = auth, public
as $$
declare
  n_organ int := 0;
  n_roles int := 0;
  n_reminders int := 0;
  n_devices int := 0;
  n_sessions int := 0;
  n_users int := 0;
begin
  delete from auth.refresh_tokens where user_id = p_user_id;
  get diagnostics n_sessions = row_count;

  delete from public.organizer_members where user_id = p_user_id;
  get diagnostics n_organ = row_count;

  delete from public.user_roles where user_id = p_user_id;
  get diagnostics n_roles = row_count;

  delete from public.user_plan_reminders where user_id = p_user_id;
  get diagnostics n_reminders = row_count;

  delete from public.device_tokens where user_id = p_user_id;
  get diagnostics n_devices = row_count;

  delete from public.users where id = p_user_id;
  get diagnostics n_users = row_count;

  return jsonb_build_object(
    'organizer_members_deleted', n_organ,
    'user_roles_deleted', n_roles,
    'reminders_deleted', n_reminders,
    'devices_deleted', n_devices,
    'sessions_deleted', n_sessions,
    'users_deleted', n_users
  );
end;
$$;

revoke all on function public.admin_sweep_user_after_auth_delete(uuid) from public;
grant execute on function public.admin_sweep_user_after_auth_delete(uuid) to service_role;
