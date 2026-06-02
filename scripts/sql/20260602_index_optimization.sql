-- Index Optimization
-- 1. Drop confirmed duplicate indexes (same definition, different name from old migrations)
-- 2. Add missing FK indexes (18 unindexed foreign keys)
-- 3. Promote festival_organizers unique constraint to primary key

-- ================================================================
-- PART 1: Drop duplicate indexes
-- In each group, the named (non-idx_ prefix) index is kept.
-- ================================================================

-- discovered_links
DROP INDEX IF EXISTS public.discovered_links_normalized_url_uidx;  -- dup of discovered_links_normalized_url_key

-- festival_media
DROP INDEX IF EXISTS public.idx_festival_media_festival_sort;      -- dup of festival_media_festival_sort_idx
DROP INDEX IF EXISTS public.idx_media_festival_sort;               -- dup of festival_media_festival_sort_idx

-- festivals (6 duplicate groups — keep the descriptively-named index in each)
DROP INDEX IF EXISTS public.idx_festivals_category_start_date;     -- dup of festivals_category_start_date_idx
DROP INDEX IF EXISTS public.idx_festivals_city_slug;               -- dup of festivals_city_slug_idx
DROP INDEX IF EXISTS public.idx_festivals_city_date;               -- dup of festivals_city_start_date_idx
DROP INDEX IF EXISTS public.idx_festivals_city_start_date;         -- dup of festivals_city_start_date_idx
DROP INDEX IF EXISTS public.festivals_lat_lng_idx;                 -- dup of idx_festivals_lat_lng AND unused
DROP INDEX IF EXISTS public.idx_festivals_lat_lng;                 -- both halves of this pair are unused
DROP INDEX IF EXISTS public.idx_festivals_organizer_status_start;  -- dup of festivals_organizer_status_start_date_idx
DROP INDEX IF EXISTS public.idx_festivals_status_start;            -- dup of festivals_status_start_date_idx
DROP INDEX IF EXISTS public.idx_festivals_status_start_date;       -- dup of festivals_status_start_date_idx

-- user_favorites
DROP INDEX IF EXISTS public.idx_user_favorites_festival;           -- dup of user_favorites_festival_id_idx
DROP INDEX IF EXISTS public.idx_user_favorites_festival_id;        -- dup of user_favorites_festival_id_idx

-- ================================================================
-- PART 2: Add missing FK indexes
-- ================================================================

-- discovered_links
CREATE INDEX IF NOT EXISTS discovered_links_enqueued_job_id_idx ON public.discovered_links (enqueued_job_id);
CREATE INDEX IF NOT EXISTS discovered_links_ingest_job_id_idx    ON public.discovered_links (ingest_job_id);

-- discovery_sources
CREATE INDEX IF NOT EXISTS discovery_sources_city_id_idx ON public.discovery_sources (city_id);

-- email_jobs
CREATE INDEX IF NOT EXISTS email_jobs_recipient_user_id_idx ON public.email_jobs (recipient_user_id);

-- festival_reports
CREATE INDEX IF NOT EXISTS festival_reports_reviewed_by_idx ON public.festival_reports (reviewed_by);

-- festival_source_evidence
CREATE INDEX IF NOT EXISTS festival_source_evidence_ingest_job_id_idx ON public.festival_source_evidence (ingest_job_id);

-- ingest_jobs
CREATE INDEX IF NOT EXISTS ingest_jobs_parent_job_id_idx ON public.ingest_jobs (parent_job_id);

-- notification_jobs
CREATE INDEX IF NOT EXISTS notification_jobs_festival_id_idx ON public.notification_jobs (festival_id);

-- organizer_claim_audit
CREATE INDEX IF NOT EXISTS organizer_claim_audit_organizer_id_idx ON public.organizer_claim_audit (organizer_id);
CREATE INDEX IF NOT EXISTS organizer_claim_audit_user_id_idx      ON public.organizer_claim_audit (user_id);

-- organizer_members
CREATE INDEX IF NOT EXISTS organizer_members_approved_by_idx ON public.organizer_members (approved_by);

-- outbound_clicks
CREATE INDEX IF NOT EXISTS outbound_clicks_user_id_idx ON public.outbound_clicks (user_id);

-- pending_festivals
CREATE INDEX IF NOT EXISTS pending_festivals_city_id_idx      ON public.pending_festivals (city_id);
CREATE INDEX IF NOT EXISTS pending_festivals_duplicate_of_idx ON public.pending_festivals (duplicate_of);
CREATE INDEX IF NOT EXISTS pending_festivals_reviewed_by_idx  ON public.pending_festivals (reviewed_by);

-- user_notifications
CREATE INDEX IF NOT EXISTS user_notifications_festival_id_idx ON public.user_notifications (festival_id);

-- user_plan_reminders
CREATE INDEX IF NOT EXISTS user_plan_reminders_festival_id_idx ON public.user_plan_reminders (festival_id);

-- users
CREATE INDEX IF NOT EXISTS users_deleted_by_idx ON public.users (deleted_by);

-- ================================================================
-- PART 3: Promote festival_organizers unique constraint → primary key
-- ================================================================
ALTER TABLE public.festival_organizers
  DROP CONSTRAINT IF EXISTS festival_organizers_unique;

ALTER TABLE public.festival_organizers
  ADD CONSTRAINT festival_organizers_pkey PRIMARY KEY (festival_id, organizer_id);
