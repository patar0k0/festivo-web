-- Admin user hardening: sweep retry queue (survives auth.users delete CASCADE on public.users),
-- cleanup_pending flag on public.users, banned_until mirror for auth ban state.

-- ---------------------------------------------------------------------------
-- 1) public.users: cleanup flag + ban mirror (UI / middleware read alongside JWT)
-- ---------------------------------------------------------------------------
alter table public.users add column if not exists cleanup_pending boolean not null default false;
alter table public.users add column if not exists banned_until timestamptz null;

create index if not exists idx_users_cleanup_pending_true
  on public.users (cleanup_pending)
  where cleanup_pending = true;

comment on column public.users.cleanup_pending is
  'Set before destructive auth delete path; cleared when sweep succeeds or tracking is reset. Durable retries use user_sweep_retry_queue.';
comment on column public.users.banned_until is
  'Mirror of auth ban end time; kept in sync on admin ban/unban. Middleware treats JWT or this field as active ban.';

-- ---------------------------------------------------------------------------
-- 2) Retry queue: survives auth user removal (no FK to auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.user_sweep_retry_queue (
  user_id uuid primary key,
  enqueued_at timestamptz not null default now()
);

comment on table public.user_sweep_retry_queue is
  'Users needing post-auth data sweep; processed by cron job with service role.';

alter table public.user_sweep_retry_queue enable row level security;

revoke all on table public.user_sweep_retry_queue from anon;
revoke all on table public.user_sweep_retry_queue from authenticated;
grant select, insert, update, delete on table public.user_sweep_retry_queue to service_role;

-- ---------------------------------------------------------------------------
-- 3) RPC: mirror ban end time without clobbering deleted_at / other users cols
-- ---------------------------------------------------------------------------
create or replace function public.admin_sync_user_banned_until(
  p_user_id uuid,
  p_until timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, banned_until)
  values (p_user_id, p_until)
  on conflict (id) do update
    set banned_until = excluded.banned_until;
end;
$$;

revoke all on function public.admin_sync_user_banned_until(uuid, timestamptz) from public;
grant execute on function public.admin_sync_user_banned_until(uuid, timestamptz) to service_role;
