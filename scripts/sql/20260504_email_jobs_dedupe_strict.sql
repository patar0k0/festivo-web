-- Stricter idempotency for email_jobs: dedupe per (type, recipient identity, dedupe_key).
-- Does not change columns (attempts, scheduled_at, etc.).
--
-- Pre-flight (run in SQL editor if you need to inspect conflicts before deploy):
--   SELECT type,
--          coalesce(recipient_user_id::text, recipient_email) AS dedupe_identity,
--          dedupe_key,
--          count(*) AS n
--   FROM public.email_jobs
--   WHERE dedupe_key IS NOT NULL
--   GROUP BY 1, 2, 3
--   HAVING count(*) > 1;

DROP INDEX IF EXISTS public.email_jobs_dedupe_key_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS email_jobs_dedupe_strict
  ON public.email_jobs (
    type,
    (coalesce(recipient_user_id::text, recipient_email)),
    dedupe_key
  )
  WHERE dedupe_key IS NOT NULL;
