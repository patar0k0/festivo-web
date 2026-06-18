-- Table for enrichment proposals targeting published festivals.
-- Pending festival enrichments are applied in-place (no proposal table needed).
CREATE TABLE IF NOT EXISTS festival_enrichment_proposals (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status               text NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'approved', 'rejected')),
  target_festival_id   uuid REFERENCES festivals(id) ON DELETE CASCADE,
  patch_json           jsonb NOT NULL,
  poster_ingest_job_id uuid REFERENCES poster_ingest_jobs(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  reviewed_at          timestamptz,
  reviewed_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS festival_enrichment_proposals_status_idx
  ON festival_enrichment_proposals (status);
CREATE INDEX IF NOT EXISTS festival_enrichment_proposals_target_idx
  ON festival_enrichment_proposals (target_festival_id);

-- RLS: only service-role; no public or authenticated access.
ALTER TABLE festival_enrichment_proposals ENABLE ROW LEVEL SECURITY;
-- No policies = no access for anon/authenticated JWT; service-role bypasses RLS.

-- Track which fields on a pending_festival were added by poster enrichment.
ALTER TABLE pending_festivals
  ADD COLUMN IF NOT EXISTS enriched_fields jsonb;
-- e.g. ["description", "facebook_url"]
