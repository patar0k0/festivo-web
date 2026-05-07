-- High-confidence ingest rows: optional moderator shortcut (set by worker heuristic).

alter table public.pending_festivals
  add column if not exists ready_for_auto_approve boolean not null default false;

comment on column public.pending_festivals.ready_for_auto_approve is
  'Worker sets true when confidence_score > 85 and source_url is a public http(s) URL (not research.festivo handoff).';
