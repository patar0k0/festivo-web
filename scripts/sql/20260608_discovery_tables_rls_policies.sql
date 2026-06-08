-- scripts/sql/20260608_discovery_tables_rls_policies.sql
-- Fix: discovery_sources / discovery_runs / discovered_links had RLS ENABLED but
-- ZERO policies, so the admin dashboard (which reads via the user-session client,
-- not service role) saw 0 rows and source create/update/delete silently failed.
-- Add admin-only policies mirroring discovery_config (service role still bypasses RLS).

-- discovery_sources -----------------------------------------------------------
drop policy if exists discovery_sources_admin_all on public.discovery_sources;
create policy discovery_sources_admin_all on public.discovery_sources
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

-- discovery_runs --------------------------------------------------------------
drop policy if exists discovery_runs_admin_all on public.discovery_runs;
create policy discovery_runs_admin_all on public.discovery_runs
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

-- discovered_links ------------------------------------------------------------
drop policy if exists discovered_links_admin_all on public.discovered_links;
create policy discovered_links_admin_all on public.discovered_links
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
