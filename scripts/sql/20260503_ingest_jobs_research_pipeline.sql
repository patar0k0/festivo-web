-- Unified ingestion: research + discovery job types, payload_json on ingest_jobs,
-- submission_source includes discovery for pending rows created from discovery-sourced jobs.

alter table public.ingest_jobs
  add column if not exists payload_json jsonb not null default '{}'::jsonb;

comment on column public.ingest_jobs.payload_json is
  'Structured handoff for source_type=research (pending_row snapshot). Optional metadata for discovery/manual jobs.';

alter table public.ingest_jobs
  drop constraint if exists ingest_jobs_source_type_check;

alter table public.ingest_jobs
  add constraint ingest_jobs_source_type_check
  check (
    source_type in (
      'facebook_event',
      'web_event_page',
      'facebook_post',
      'research',
      'discovery'
    )
  );

alter table public.pending_festivals
  drop constraint if exists pending_festivals_submission_source_check;

alter table public.pending_festivals
  add constraint pending_festivals_submission_source_check
  check (
    submission_source is null
    or submission_source in (
      'organizer_portal',
      'admin',
      'ingest',
      'research',
      'discovery'
    )
  );
