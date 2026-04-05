-- Gallery + video support: festival_media uses sort_order as display position (see app types).
-- Optional is_hero marks a gallery row used when festivals.hero_image is empty (see getFestivalHeroImage).

alter table public.festival_media
  add column if not exists is_hero boolean not null default false;

alter table public.pending_festivals
  add column if not exists video_url text;

alter table public.pending_festivals
  add column if not exists gallery_image_urls jsonb not null default '[]'::jsonb;

create index if not exists idx_festival_media_festival_sort on public.festival_media (festival_id, sort_order);

comment on column public.festival_media.is_hero is 'When true, this image may fill the public hero slot if festivals.hero_image is null.';
comment on column public.pending_festivals.gallery_image_urls is 'JSON array of hosted image URLs; copied to festival_media on approve.';
comment on column public.pending_festivals.video_url is 'YouTube or Facebook watch URL; copied to festivals.video_url on approve (see scripts/sql/20260405_festivals_video_url.sql).';
