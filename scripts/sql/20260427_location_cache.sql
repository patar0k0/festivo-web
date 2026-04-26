create table if not exists public.location_cache (
  id uuid primary key default gen_random_uuid(),
  normalized_key text not null unique,
  location_name text,
  city_name text,
  latitude double precision not null,
  longitude double precision not null,
  confidence_score integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_location_cache_key on public.location_cache (normalized_key);

alter table public.location_cache enable row level security;
