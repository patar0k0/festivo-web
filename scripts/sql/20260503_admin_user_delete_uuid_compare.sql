-- Avoid "operator does not exist: character varying = uuid" when comparing
-- auth.refresh_tokens.user_id (varchar in some GoTrue schemas) and similar
-- to PL/pgSQL uuid parameters. Coerce uuid params to text for equality.

create or replace function public.admin_invalidate_auth_sessions(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = auth, public
as $$
begin
  delete from auth.refresh_tokens
  where user_id = target_user_id::text;
end;
$$;

revoke all on function public.admin_invalidate_auth_sessions(uuid) from public;
grant execute on function public.admin_invalidate_auth_sessions(uuid) to service_role;

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
    delete from auth.refresh_tokens where user_id = target_user_id::text;
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
  delete from auth.refresh_tokens where user_id = p_user_id::text;
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
