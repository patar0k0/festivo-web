-- Migration: 20260530_festival_categories_table
-- Creates a managed festival_categories table so admins can
-- add/rename/deactivate categories without code changes.

CREATE TABLE festival_categories (
  slug       text        PRIMARY KEY,          -- lowercase, stored in festivals.category
  label_bg   text        NOT NULL,             -- Bulgarian display label
  sort_order integer     NOT NULL DEFAULT 0,
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE festival_categories ENABLE ROW LEVEL SECURITY;

-- Public and authenticated users can read active categories (for organizer form + public filter)
CREATE POLICY "Anyone can read active festival categories"
  ON festival_categories FOR SELECT
  USING (is_active = true);

-- Seed with 7 canonical categories from previous migration
INSERT INTO festival_categories (slug, label_bg, sort_order) VALUES
  ('фолклорен фестивал', 'Фолклорен фестивал', 1),
  ('събор',              'Събор',               2),
  ('кулинарен фестивал', 'Кулинарен фестивал', 3),
  ('музикален фестивал', 'Музикален фестивал', 4),
  ('танцов фестивал',    'Танцов фестивал',    5),
  ('културен фестивал',  'Културен фестивал',  6),
  ('арт фестивал',       'Арт фестивал',       7);
