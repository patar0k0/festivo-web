-- Persist internal research evidence on published festivals.
-- These fields are for admin/backoffice diagnostics and are not required in public UI.

alter table public.festivals
  add column if not exists source_primary_url text,
  add column if not exists source_count integer,
  add column if not exists evidence_json jsonb,
  add column if not exists verification_status text,
  add column if not exists verification_score numeric,
  add column if not exists extraction_version text;
