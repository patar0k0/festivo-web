-- Fix cities with Cyrillic slugs → Latin slugs
-- These were ingested with Bulgarian transliteration bypassed, causing map centroid lookup to fail.
-- The CENTROIDS dictionary in lib/api/mobile/bulgariaSettlementCentroids.ts uses Latin keys only.

-- Велинград → velingrad (already in CENTROIDS)
UPDATE cities
SET slug = 'velingrad'
WHERE slug = 'велинград';

UPDATE festivals
SET city_slug = 'velingrad'
WHERE city_slug = 'велинград';

-- Първомай → parvomay (added to CENTROIDS in same PR)
UPDATE cities
SET slug = 'parvomay'
WHERE slug = 'първомай';

UPDATE festivals
SET city_slug = 'parvomay'
WHERE city_slug = 'първомай';
