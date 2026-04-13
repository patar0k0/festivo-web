-- Backfill festivals.city_id from legacy text `city` (keep `city` column until a later verified drop).
-- cities.id is bigint in this project (not UUID).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'festivals'
      AND column_name = 'city_id'
  ) THEN
    ALTER TABLE public.festivals
      ADD COLUMN city_id bigint REFERENCES public.cities (id);
  END IF;
END $$;

UPDATE public.festivals f
SET city_id = c.id
FROM public.cities c
WHERE f.city_id IS NULL
  AND f.city IS NOT NULL
  AND btrim(f.city) <> ''
  AND lower(btrim(f.city)) = lower(btrim(c.name_bg));

UPDATE public.festivals f
SET city_id = c.id
FROM public.cities c
WHERE f.city_id IS NULL
  AND f.city IS NOT NULL
  AND btrim(f.city) <> ''
  AND lower(btrim(f.city)) = lower(btrim(c.slug));

DO $$
DECLARE
  r record;
  n integer := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT btrim(f.city) AS city
    FROM public.festivals f
    WHERE f.city_id IS NULL
      AND f.city IS NOT NULL
      AND btrim(f.city) <> ''
  LOOP
    n := n + 1;
    RAISE NOTICE '[festivals city_id backfill] unmatched city text: %', r.city;
  END LOOP;
  RAISE NOTICE '[festivals city_id backfill] unmatched distinct city values: %', n;
END $$;
