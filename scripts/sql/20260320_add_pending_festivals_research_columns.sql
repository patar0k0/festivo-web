-- Ensure pending_festivals has all columns expected by research draft creation.
-- Idempotent migration for environments that missed prior manual/partial updates.

alter table public.pending_festivals
  add column if not exists facebook_url text,
  add column if not exists instagram_url text,
  add column if not exists source_primary_url text,
  add column if not exists source_count integer,
  add column if not exists evidence_json jsonb,
  add column if not exists verification_status text,
  add column if not exists verification_score numeric,
  add column if not exists extraction_version text;
