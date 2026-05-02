-- Mirror auth.users.email on public.users for server-side confirmation of destructive actions
-- (compare against DB, not admin UI / client-supplied display fields).

alter table public.users add column if not exists email text;

comment on column public.users.email is
  'Login email mirrored from auth.users; used for hard-delete confirmation against public.users.';

update public.users u
set email = au.email::text
from auth.users au
where u.id = au.id
  and (u.email is distinct from au.email::text);

-- ---------------------------------------------------------------------------
-- Soft delete / restore: keep email in sync when touching public.users
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
  v_email text;
begin
  select au.email::text into v_email from auth.users au where au.id = target_user_id;

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
    insert into public.users (id, deleted_at, deleted_by, deleted_reason, email)
    values (target_user_id, now(), actor_user_id, v_reason, v_email)
    on conflict (id) do update set
      deleted_at = excluded.deleted_at,
      deleted_by = excluded.deleted_by,
      deleted_reason = excluded.deleted_reason,
      email = coalesce(excluded.email, v_email, public.users.email);
  else
    insert into public.users (id, deleted_at, deleted_by, deleted_reason, email)
    values (target_user_id, null, null, null, v_email)
    on conflict (id) do update set
      deleted_at = null,
      deleted_by = null,
      deleted_reason = null,
      email = coalesce(v_email, public.users.email);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ban mirror upsert: include email when inserting/updating shadow row
-- ---------------------------------------------------------------------------
create or replace function public.admin_sync_user_banned_until(
  p_user_id uuid,
  p_until timestamptz
)
returns void
language plpgsql
security definer
set search_path = auth, public
as $$
declare
  v_email text;
begin
  select au.email::text into v_email from auth.users au where au.id = p_user_id;

  insert into public.users (id, banned_until, email)
  values (p_user_id, p_until, v_email)
  on conflict (id) do update
    set banned_until = excluded.banned_until,
        email = coalesce(v_email, public.users.email);
end;
$$;
