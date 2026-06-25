alter table public.festivals
  add column if not exists last_edited_by_organizer_at timestamptz null;

create index if not exists idx_festivals_last_edited_by_organizer_at
  on public.festivals (last_edited_by_organizer_at)
  where last_edited_by_organizer_at is not null;
