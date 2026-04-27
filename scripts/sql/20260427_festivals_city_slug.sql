-- Derived slug from `festivals.city` for stable public filtering (see `lib/text/slugifyCity.ts`).
ALTER TABLE festivals
ADD COLUMN city_slug TEXT;

CREATE INDEX idx_festivals_city_slug ON festivals(city_slug);
