-- Adds `synced_to_resend_at` to `newsletter_subscribers` so the Railway
-- sync service can incrementally push new subscribers to a Resend
-- Audience (source of truth remains Supabase).
--
-- Idempotent: ADD COLUMN IF NOT EXISTS.
--
-- After this migration:
--   `synced_to_resend_at IS NULL` → row not yet sent to Resend
--   `synced_to_resend_at` set     → contact created in Resend Audience
--
-- The sync worker (festivo-workers repo, `npm run start:newsletter-sync`)
-- claims `synced_to_resend_at IS NULL AND unsubscribed_at IS NULL` rows,
-- POSTs each to Resend, and stamps the timestamp on success.

alter table public.newsletter_subscribers
  add column if not exists synced_to_resend_at timestamptz;

-- Partial index for the sync worker's frequent lookup:
--   WHERE synced_to_resend_at IS NULL AND unsubscribed_at IS NULL
create index if not exists newsletter_subscribers_pending_sync_idx
  on public.newsletter_subscribers (created_at)
  where synced_to_resend_at is null and unsubscribed_at is null;
