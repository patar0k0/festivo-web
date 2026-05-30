-- Migration: 20260530_normalize_festival_categories
-- Maps free-form category strings in festivals and pending_festivals
-- to one of 7 canonical lowercase values.
-- Rows that cannot be mapped (generic "festival", "фестивал" etc.) are set to NULL
-- so admin can reclassify them via the new select UI.
-- Prerequisite: 20260529_normalize_category_case.sql must have run first (all values already lowercase).

-- ============================================================
-- FESTIVALS TABLE
-- ============================================================

UPDATE festivals SET category = 'фолклорен фестивал'
WHERE category IN (
  'фолклорен фестивал','фолк фестивал','folk festival',
  'фолклорен конкурс','конкурс-надиграване','фестивал-надиграване',
  'фолклорен танцов','фолклорен танцов фестивал','фолклор',
  'национален фолклорен','фолкорен фестивал',
  'международен фолклорен фестивал','фолклорен празник',
  'кукерски карнавал'
);

UPDATE festivals SET category = 'събор'
WHERE category IN ('събор','традиционен събор','събор-надпяване','фолклорен събор');

UPDATE festivals SET category = 'кулинарен фестивал'
WHERE category IN (
  'кулинарен фестивал','гастрономически фестивал',
  'кулинарно-фолклорен фестивал','кулинарен и фолклорен фестивал',
  'кулинарен фестивал / фолклорен празник','кулинарно-фолклорен',
  'кулинарно-фолклорен празник','кулинарен празник',
  'кулинарен празник / фолклорен празник','винен фестивал'
);

UPDATE festivals SET category = 'музикален фестивал'
WHERE category IN ('музикален фестивал','музика','концерт','празничен концерт');

UPDATE festivals SET category = 'танцов фестивал'
WHERE category IN ('танцов фестивал','танцово изкуство');

UPDATE festivals SET category = 'културен фестивал'
WHERE category IN ('културен фестивал','балкански фестивал','градски празник');

UPDATE festivals SET category = 'арт фестивал'
WHERE category IN ('арт фестивал');

-- Unrecognized → NULL (admin reclassifies via select UI)
UPDATE festivals SET category = NULL
WHERE category IN (
  'festival','фестивал','туристически фестивал','туристически',
  'екологичен фестивал','семеен','празничното събитие'
);

-- ============================================================
-- PENDING_FESTIVALS TABLE (same mapping)
-- ============================================================

UPDATE pending_festivals SET category = 'фолклорен фестивал'
WHERE category IN (
  'фолклорен фестивал','фолк фестивал','folk festival',
  'фолклорен конкурс','конкурс-надиграване','фестивал-надиграване',
  'фолклорен танцов','фолклорен танцов фестивал','фолклор',
  'национален фолклорен','фолкорен фестивал',
  'международен фолклорен фестивал','фолклорен празник',
  'кукерски карнавал'
);

UPDATE pending_festivals SET category = 'събор'
WHERE category IN ('събор','традиционен събор','събор-надпяване','фолклорен събор');

UPDATE pending_festivals SET category = 'кулинарен фестивал'
WHERE category IN (
  'кулинарен фестивал','гастрономически фестивал',
  'кулинарно-фолклорен фестивал','кулинарен и фолклорен фестивал',
  'кулинарен фестивал / фолклорен празник','кулинарно-фолклорен',
  'кулинарно-фолклорен празник','кулинарен празник',
  'кулинарен празник / фолклорен празник','винен фестивал'
);

UPDATE pending_festivals SET category = 'музикален фестивал'
WHERE category IN ('музикален фестивал','музика','концерт','празничен концерт');

UPDATE pending_festivals SET category = 'танцов фестивал'
WHERE category IN ('танцов фестивал','танцово изкуство');

UPDATE pending_festivals SET category = 'културен фестивал'
WHERE category IN ('културен фестивал','балкански фестивал','градски празник');

UPDATE pending_festivals SET category = 'арт фестивал'
WHERE category IN ('арт фестивал');

UPDATE pending_festivals SET category = NULL
WHERE category IN (
  'festival','фестивал','туристически фестивал','туристически',
  'екологичен фестивал','семеен','празничното събитие'
);
