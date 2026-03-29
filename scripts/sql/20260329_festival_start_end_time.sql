-- Festival clock times (local wall-clock, stored without timezone; UI interprets with Europe/Sofia).
ALTER TABLE public.festivals
  ADD COLUMN IF NOT EXISTS start_time time without time zone NULL,
  ADD COLUMN IF NOT EXISTS end_time time without time zone NULL;

ALTER TABLE public.pending_festivals
  ADD COLUMN IF NOT EXISTS start_time time without time zone NULL,
  ADD COLUMN IF NOT EXISTS end_time time without time zone NULL;

COMMENT ON COLUMN public.festivals.start_time IS 'Optional local start clock time (same calendar day as start_date).';
COMMENT ON COLUMN public.festivals.end_time IS 'Optional local end clock time (same day as start when paired with start_time).';
COMMENT ON COLUMN public.pending_festivals.start_time IS 'Optional local start clock time for moderation drafts.';
COMMENT ON COLUMN public.pending_festivals.end_time IS 'Optional local end clock time; must be >= start_time when both set.';
