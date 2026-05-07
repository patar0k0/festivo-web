-- Manual map pin / admin coordinate override: persisted flag so ingest and resolvers
-- treat stored lat/lng as authoritative.

ALTER TABLE festivals
ADD COLUMN IF NOT EXISTS coords_override boolean DEFAULT false;

ALTER TABLE pending_festivals
ADD COLUMN IF NOT EXISTS coords_override boolean DEFAULT false;
