-- Migration: 20260602_research_smart_cache
-- Caches Smart Research pipeline results keyed by normalized query, to avoid
-- spending SerpAPI credits + Gemini tokens on repeated identical searches.
-- Only accessible via service_role (no public/authenticated policies).

CREATE TABLE research_smart_cache (
  query_key      text        PRIMARY KEY,        -- normalized query (lowercase, collapsed whitespace)
  query_original text        NOT NULL,           -- the query as typed, for display/debug
  result         jsonb       NOT NULL,           -- serialized SmartResearchResult
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Lets a periodic cleanup job (or manual prune) drop stale rows efficiently.
CREATE INDEX idx_research_smart_cache_created_at ON research_smart_cache (created_at);

ALTER TABLE research_smart_cache ENABLE ROW LEVEL SECURITY;
-- No policies → only service_role can read/write.
