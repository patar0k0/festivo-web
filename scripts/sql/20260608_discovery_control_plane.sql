-- scripts/sql/20260608_discovery_control_plane.sql
-- Discovery Control Plane: admin-tunable config + run-request queue.

-- 1. Singleton config table -------------------------------------------------
create table if not exists public.discovery_config (
  id smallint primary key default 1,
  score_threshold integer not null default 65,
  max_sources_per_run integer not null default 10,
  max_links_per_source integer not null default 40,
  max_jobs_per_run integer not null default 30,
  fetch_timeout_ms integer not null default 12000,
  soft_disable_approval_floor numeric not null default 0.05,
  soft_disable_min_enqueued integer not null default 30,
  recovery_every integer not null default 5,
  cron_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint discovery_config_singleton check (id = 1),
  constraint discovery_config_score_threshold_range check (score_threshold between 0 and 200),
  constraint discovery_config_approval_floor_range check (soft_disable_approval_floor between 0 and 1),
  constraint discovery_config_positive_ints check (
    max_sources_per_run > 0
    and max_links_per_source > 0
    and max_jobs_per_run > 0
    and fetch_timeout_ms >= 1000
    and soft_disable_min_enqueued >= 0
    and recovery_every >= 2
  )
);

-- Seed the singleton row (idempotent).
insert into public.discovery_config (id)
values (1)
on conflict (id) do nothing;

-- 2. Run-request queue ------------------------------------------------------
create table if not exists public.discovery_run_requests (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'requested',
  mode text not null default 'full',
  source_id bigint references public.discovery_sources(id) on delete set null,
  requested_by uuid,
  requested_at timestamptz not null default now(),
  lock_token uuid,
  claimed_at timestamptz,
  finished_at timestamptz,
  run_id bigint references public.discovery_runs(id) on delete set null,
  error text,
  constraint discovery_run_requests_status_chk
    check (status in ('requested', 'claimed', 'done', 'failed')),
  constraint discovery_run_requests_mode_chk
    check (mode in ('full', 'single_source'))
);

-- Prevent piling up duplicate pending requests for the same target.
create unique index if not exists discovery_run_requests_pending_uq
  on public.discovery_run_requests (mode, coalesce(source_id, -1))
  where status = 'requested';

-- Claim ordering / dashboard listing.
create index if not exists discovery_run_requests_status_requested_at_idx
  on public.discovery_run_requests (status, requested_at desc);

-- 3. RLS --------------------------------------------------------------------
alter table public.discovery_config enable row level security;
alter table public.discovery_run_requests enable row level security;

-- Admin-only access (service role bypasses RLS automatically).
-- Mirrors the existing admin check: public.user_roles.role = 'admin'.
create policy discovery_config_admin_all on public.discovery_config
  for all
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  );

create policy discovery_run_requests_admin_all on public.discovery_run_requests
  for all
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  );
