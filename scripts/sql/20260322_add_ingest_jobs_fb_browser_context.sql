-- How the worker opened Facebook/web pages: Playwright with FB storage state vs anonymous.
alter table public.ingest_jobs
  add column if not exists fb_browser_context text;

comment on column public.ingest_jobs.fb_browser_context is
  'Set by festivo-workers when the browser context starts: authenticated (FB_STORAGE_STATE_B64) or anonymous.';
