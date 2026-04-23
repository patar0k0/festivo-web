ALTER TABLE festivals
ADD COLUMN settlement_type text;

-- allowed values:
-- 'city' | 'village' | 'resort' | null
