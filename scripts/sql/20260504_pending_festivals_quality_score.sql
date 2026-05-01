-- Research / ingest handoff: deterministic quality score and moderator flag.

alter table public.pending_festivals
  add column if not exists confidence_score integer;

alter table public.pending_festivals
  add column if not exists needs_review boolean not null default false;

comment on column public.pending_festivals.confidence_score is
  '0–100 structural completeness score (title, date, city, venue, source) after post-AI enrich/validate.';

comment on column public.pending_festivals.needs_review is
  'True when required fields (title, start_date, city) are still missing after enrichment.';
