-- Festival merge: archived loser points to the winner it was merged into.
-- Audit + future 301 redirect from the archived slug.

alter table public.festivals
  add column if not exists merged_into_festival_id uuid
  references public.festivals(id) on delete set null;

create index if not exists festivals_merged_into_idx
  on public.festivals (merged_into_festival_id)
  where merged_into_festival_id is not null;

comment on column public.festivals.merged_into_festival_id is
  'When set: this festival was merged into the referenced festival and archived.';
