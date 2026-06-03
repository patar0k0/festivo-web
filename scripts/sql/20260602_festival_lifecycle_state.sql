-- scripts/sql/20260602_festival_lifecycle_state.sql

-- Lifecycle state — отделно от status (catalog moderation).
-- 'active' е default; 'cancelled' означава отменен от admin/organizer.
-- Дизайнирано за бъдещо добавяне на 'postponed' без втора миграция.

ALTER TABLE festivals
  ADD COLUMN IF NOT EXISTS lifecycle_state text NOT NULL DEFAULT 'active'
    CHECK (lifecycle_state IN ('active', 'cancelled')),
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancellation_announced_by uuid REFERENCES auth.users(id);

-- Partial index — само за cancelled (малка fraction от таблицата)
CREATE INDEX IF NOT EXISTS festivals_lifecycle_state_idx
  ON festivals(lifecycle_state)
  WHERE lifecycle_state <> 'active';

-- RLS: lifecycle_state е public readable (за listings/detail pages)
-- Не е нужна промяна на RLS — колоната е в съществуващата festivals таблица
-- и existing SELECT policies я покриват автоматично.
