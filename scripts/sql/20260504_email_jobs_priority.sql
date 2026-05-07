-- email_jobs: enqueue priority for worker ordering (high → normal → low), then scheduled_at.
-- Replaces claim ordering only; batch size still capped inside claim_due_email_jobs.

ALTER TABLE public.email_jobs
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_jobs_priority_check'
  ) THEN
    ALTER TABLE public.email_jobs
      ADD CONSTRAINT email_jobs_priority_check
      CHECK (priority IN ('high', 'normal', 'low'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS email_jobs_priority_idx
  ON public.email_jobs (status, priority, scheduled_at);

CREATE OR REPLACE FUNCTION public.claim_due_email_jobs(p_limit integer default 10)
RETURNS SETOF public.email_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT ej.id
    FROM public.email_jobs ej
    WHERE ej.status = 'pending'
      AND ej.scheduled_at <= now()
    ORDER BY
      CASE ej.priority
        WHEN 'high' THEN 1
        WHEN 'normal' THEN 2
        WHEN 'low' THEN 3
        ELSE 2
      END,
      ej.scheduled_at ASC
    LIMIT greatest(1, least(coalesce(p_limit, 10), 100))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.email_jobs j
  SET
    status = 'processing',
    locked_at = now(),
    processing_started_at = now(),
    updated_at = now()
  FROM picked
  WHERE j.id = picked.id
  RETURNING j.*;
END;
$$;
