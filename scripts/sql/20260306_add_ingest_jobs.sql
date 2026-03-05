create table if not exists public.ingest_jobs (
  id uuid primary key default gen_random_uuid(),
  source_url text not null,
  source_type text not null default 'facebook_event',
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists ingest_jobs_status_created_at_idx
  on public.ingest_jobs (status, created_at desc);

create unique index if not exists ingest_jobs_source_url_unique_idx
  on public.ingest_jobs (source_url);

alter table public.ingest_jobs enable row level security;

drop policy if exists "ingest_jobs_admin_select" on public.ingest_jobs;
create policy "ingest_jobs_admin_select"
  on public.ingest_jobs
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "ingest_jobs_admin_insert" on public.ingest_jobs;
create policy "ingest_jobs_admin_insert"
  on public.ingest_jobs
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "ingest_jobs_admin_update" on public.ingest_jobs;
create policy "ingest_jobs_admin_update"
  on public.ingest_jobs
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "ingest_jobs_admin_delete" on public.ingest_jobs;
create policy "ingest_jobs_admin_delete"
  on public.ingest_jobs
  for delete
  to authenticated
  using (public.is_admin());
