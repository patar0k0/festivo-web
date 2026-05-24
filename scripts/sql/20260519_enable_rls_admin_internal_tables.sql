-- Enable RLS on admin/internal tables that were missing it.
--
-- Audit context (19 май 2026, launch sprint day 5):
-- 10 tables in `public` schema had `rowsecurity = false`. None of them are
-- intended to be readable by anon/authenticated PostgREST clients — all are
-- accessed exclusively via server-side code using the service_role key.
--
-- Strategy: enable RLS without adding any policies. Effect: anon/authenticated
-- clients get zero access; `service_role` continues to bypass RLS and works
-- normally. This is defense-in-depth — protects against accidental future
-- GRANTs exposing the tables.
--
-- Verified server-only via code grep:
--   - admin_audit_logs            → app/admin/api/*, lib/admin/*
--   - cron_locks                  → app/api/cron/*, lib/cron/*
--   - discovered_links            → app/admin/api/research-*, workers/*
--   - discovery_runs              → app/admin/api/research-*, workers/*
--   - discovery_sources           → app/admin/api/discovery-sources/*
--   - festival_source_evidence    → workers/, admin research routes
--   - ingest_job_artifacts        → workers/, admin ingest routes
--   - organizer_promotion_credits → lib/monetization.ts (server lib)
--   - source_pages                → workers/, admin research routes
--
-- Safe to run multiple times.

alter table public.admin_audit_logs            enable row level security;
alter table public.cron_locks                  enable row level security;
alter table public.discovered_links            enable row level security;
alter table public.discovery_runs              enable row level security;
alter table public.discovery_sources           enable row level security;
alter table public.festival_source_evidence    enable row level security;
alter table public.ingest_job_artifacts        enable row level security;
alter table public.organizer_promotion_credits enable row level security;
alter table public.source_pages                enable row level security;

-- Document intent so future maintainers don't add anon-readable policies casually.
comment on table public.admin_audit_logs            is 'admin-internal; server-only via service_role. RLS enabled with no policies (locked).';
comment on table public.cron_locks                  is 'cron coordination; server-only via service_role. RLS enabled with no policies (locked).';
comment on table public.discovered_links            is 'discovery pipeline; server-only via service_role. RLS enabled with no policies (locked).';
comment on table public.discovery_runs              is 'discovery pipeline; server-only via service_role. RLS enabled with no policies (locked).';
comment on table public.discovery_sources           is 'discovery config; server-only via service_role. RLS enabled with no policies (locked).';
comment on table public.festival_source_evidence    is 'source attribution; server-only via service_role. RLS enabled with no policies (locked).';
comment on table public.ingest_job_artifacts        is 'ingest internals; server-only via service_role. RLS enabled with no policies (locked).';
comment on table public.organizer_promotion_credits is 'billing data; server-only via lib/monetization.ts with service_role. RLS enabled with no policies (locked).';
comment on table public.source_pages                is 'discovery internals; server-only via service_role. RLS enabled with no policies (locked).';

-- Verify: re-query pg_tables for these names — all should now show rowsecurity = true.
-- Verify: re-run audit_rls.sql set 1 — should return zero rows.
