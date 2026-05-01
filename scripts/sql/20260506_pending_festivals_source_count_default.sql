-- Ingest dedup: default source_count for new pending rows (worker sets explicitly on merge/insert).

alter table public.pending_festivals
  add column if not exists source_count integer;

alter table public.pending_festivals
  alter column source_count set default 1;

comment on column public.pending_festivals.source_count is
  'Number of distinct ingest sources merged into this pending row; worker increments on conservative dedup merge.';
