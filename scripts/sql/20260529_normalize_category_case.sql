-- Normalize festival category values to lowercase (trim + lower).
-- Ensures case-inconsistent duplicates ("Кулинарен фестивал" vs "кулинарен фестивал")
-- collapse to a single canonical form. Going forward, write paths apply normalizeCategory()
-- before insert/update, so new rows always arrive lowercase.

UPDATE festivals
SET category = LOWER(TRIM(category))
WHERE category IS NOT NULL
  AND category != LOWER(TRIM(category));

UPDATE pending_festivals
SET category = LOWER(TRIM(category))
WHERE category IS NOT NULL
  AND category != LOWER(TRIM(category));
