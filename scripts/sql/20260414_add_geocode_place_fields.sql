alter table public.pending_festivals
  add column if not exists place_id text,
  add column if not exists geocode_provider text;

alter table public.festivals
  add column if not exists place_id text,
  add column if not exists geocode_provider text;
