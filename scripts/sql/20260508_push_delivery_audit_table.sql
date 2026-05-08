-- Durable push delivery audit log for debugging, analytics and dedupe safety.
-- Additive migration, no destructive operations.

create table if not exists public.push_delivery_audit (
  id uuid primary key default gen_random_uuid(),
  notification_job_id uuid null references public.notification_jobs (id) on delete set null,
  notification_type text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  device_token text null,
  device_platform text null,
  payload_summary text not null,
  deep_link text null,
  send_status text not null check (send_status in ('sent', 'failed', 'skipped')),
  provider_name text null,
  provider_response jsonb not null default '{}'::jsonb,
  opened_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists push_delivery_audit_user_created_idx
  on public.push_delivery_audit (user_id, created_at desc);

create index if not exists push_delivery_audit_job_idx
  on public.push_delivery_audit (notification_job_id, created_at desc);

create index if not exists push_delivery_audit_type_status_created_idx
  on public.push_delivery_audit (notification_type, send_status, created_at desc);

create index if not exists push_delivery_audit_opened_idx
  on public.push_delivery_audit (opened_at);

create index if not exists push_delivery_audit_token_created_idx
  on public.push_delivery_audit (device_token, created_at desc);

alter table public.push_delivery_audit enable row level security;

drop policy if exists push_delivery_audit_select_own on public.push_delivery_audit;
create policy push_delivery_audit_select_own
  on public.push_delivery_audit
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists push_delivery_audit_update_own on public.push_delivery_audit;
create policy push_delivery_audit_update_own
  on public.push_delivery_audit
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
