-- Reliability: sweep retry queue (backoff, lease claim with SKIP LOCKED), audit dedupe,
-- ban sync inconsistency flag.

-- ---------------------------------------------------------------------------
-- 1) user_sweep_retry_queue: backoff + lease (parallel cron safe)
-- user_id remains PRIMARY KEY (unique per user).
-- ---------------------------------------------------------------------------
alter table public.user_sweep_retry_queue
  add column if not exists attempts int not null default 0;

alter table public.user_sweep_retry_queue
  add column if not exists next_retry_at timestamptz not null default now();

alter table public.user_sweep_retry_queue
  add column if not exists locked_until timestamptz null;

comment on column public.user_sweep_retry_queue.attempts is
  'Number of failed sweep attempts; used with next_retry_at for exponential backoff.';
comment on column public.user_sweep_retry_queue.next_retry_at is
  'Cron processes rows where next_retry_at <= now().';
comment on column public.user_sweep_retry_queue.locked_until is
  'Lease end time set by admin_claim_user_sweep_retry_batch; prevents duplicate work across overlapping cron runs.';

create index if not exists idx_user_sweep_retry_queue_due
  on public.user_sweep_retry_queue (next_retry_at asc, enqueued_at asc);

-- ---------------------------------------------------------------------------
-- 2) Claim batch: FOR UPDATE SKIP LOCKED + lease
-- ---------------------------------------------------------------------------
create or replace function public.admin_claim_user_sweep_retry_batch(p_limit int)
returns table (user_id uuid, attempts int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 200));
begin
  return query
  update public.user_sweep_retry_queue q
  set locked_until = now() + interval '10 minutes'
  where q.ctid in (
    select q2.ctid
    from public.user_sweep_retry_queue q2
    where q2.next_retry_at <= now()
      and (q2.locked_until is null or q2.locked_until < now())
    order by q2.next_retry_at asc, q2.enqueued_at asc
    for update skip locked
    limit v_limit
  )
  returning q.user_id, q.attempts;
end;
$$;

revoke all on function public.admin_claim_user_sweep_retry_batch(int) from public;
grant execute on function public.admin_claim_user_sweep_retry_batch(int) to service_role;

-- ---------------------------------------------------------------------------
-- 3) public.users: Auth/DB ban mirror inconsistency
-- ---------------------------------------------------------------------------
alter table public.users add column if not exists ban_sync_error boolean not null default false;

comment on column public.users.ban_sync_error is
  'True when Auth ban state was updated but public.users.banned_until sync failed and Auth rollback also failed; requires manual reconciliation.';

-- ---------------------------------------------------------------------------
-- 4) admin_audit_logs: idempotent retries
-- ---------------------------------------------------------------------------
alter table public.admin_audit_logs add column if not exists dedupe_key text null;

create unique index if not exists admin_audit_logs_dedupe_key_uidx
  on public.admin_audit_logs (dedupe_key)
  where dedupe_key is not null;

comment on column public.admin_audit_logs.dedupe_key is
  'Optional stable key (hash) to deduplicate best-effort audit writes on retry.';
