-- Fast-review queue: skip/next touches row so it is not immediately re-selected (10-minute window in app query).

alter table public.pending_festivals
  add column if not exists last_reviewed_at timestamptz null;

comment on column public.pending_festivals.last_reviewed_at is
  'Set when an admin skips/next in fast review; rows with a recent touch are excluded from the next pick for a short cooldown.';
