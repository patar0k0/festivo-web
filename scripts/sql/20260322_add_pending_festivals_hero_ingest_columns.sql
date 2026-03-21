-- Hero metadata columns used by festivo-workers ingest (upsertPendingFestival) and admin UI.
-- Without these, PostgREST can return PGRST204 (schema cache) and the worker falls back to a reduced payload.
-- After applying in Supabase: Settings → API → reload schema (or brief wait for cache refresh).

alter table public.pending_festivals
  add column if not exists hero_image_source text,
  add column if not exists hero_image_original_url text,
  add column if not exists hero_image_score numeric,
  add column if not exists hero_image_fallback_reason text;

comment on column public.pending_festivals.hero_image_fallback_reason is
  'Set by ingest worker when hero rehost fails (e.g. disallowed_content_type_text_html, http_403).';
