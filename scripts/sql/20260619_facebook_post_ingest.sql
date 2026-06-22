-- Allow the new dedicated job type used by the Telegram poster-bot's
-- Facebook-post scrape flow (festivo-workers will claim jobs with this type).
alter table public.ingest_jobs drop constraint if exists ingest_jobs_job_type_check;
alter table public.ingest_jobs
  add constraint ingest_jobs_job_type_check
  check (job_type is null or job_type in ('discover_source','discover_url','extract_url','verify_candidate','scrape_facebook_post'));

-- poster_ingest_jobs rows created from a submitted link (not a Telegram photo)
-- have no Telegram file identity.
alter table public.poster_ingest_jobs alter column tg_file_id drop not null;
alter table public.poster_ingest_jobs alter column tg_file_unique_id drop not null;
