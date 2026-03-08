alter table public.pending_festivals
  add column if not exists address text,
  add column if not exists website_url text,
  add column if not exists tags text[];
