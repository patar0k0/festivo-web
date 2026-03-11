-- pending_festivals schema sync for moderation/admin runtime parity.
-- Production required manual hotfix columns for pending review, canonical mapping,
-- approve flow, normalization suggestion UI, and normalization/decision metadata.
-- This migration keeps fresh environments in sync using additive, idempotent alters only.

alter table public.pending_festivals
  add column if not exists address text,
  add column if not exists website_url text,
  add column if not exists ticket_url text,
  add column if not exists price_range text,
  add column if not exists category text,
  add column if not exists region text,
  add column if not exists source_type text,
  add column if not exists tags text[],
  add column if not exists title_clean text,
  add column if not exists description_clean text,
  add column if not exists description_short text,
  add column if not exists category_guess text,
  add column if not exists tags_guess jsonb,
  add column if not exists city_guess text,
  add column if not exists location_guess text,
  add column if not exists date_guess text,
  add column if not exists is_free_guess boolean,
  add column if not exists normalization_version text,
  add column if not exists deterministic_guess_json jsonb,
  add column if not exists ai_guess_json jsonb,
  add column if not exists merge_decisions_json jsonb,
  add column if not exists latitude_guess numeric,
  add column if not exists longitude_guess numeric,
  add column if not exists lat_guess numeric,
  add column if not exists lng_guess numeric;
