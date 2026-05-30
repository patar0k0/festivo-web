-- Migration: 20260530_admin_config
-- Generic key-value config for admin settings (e.g. active SerpAPI key).
-- Only accessible via service_role (no public/authenticated policies).

CREATE TABLE admin_config (
  key        text        PRIMARY KEY,
  value      text        NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;
-- No policies → only service_role can read/write.

-- Seed: default to first SerpAPI key
INSERT INTO admin_config (key, value) VALUES ('serpapi_active_key', '1')
  ON CONFLICT (key) DO NOTHING;
