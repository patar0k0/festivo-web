create unique index if not exists festivals_source_url_unique_idx
  on public.festivals (source_url)
  where source_url is not null;
