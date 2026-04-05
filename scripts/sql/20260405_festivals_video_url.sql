-- Optional embedded promo video for published festivals: external YouTube/Facebook page URL only.
-- `festival_media` remains image/gallery only (CHECK enforces type = 'image' in production).

alter table public.festivals
  add column if not exists video_url text;

comment on column public.festivals.video_url is 'External YouTube or Facebook watch/page URL; not uploaded media.';

comment on column public.pending_festivals.video_url is 'YouTube or Facebook watch URL; copied to festivals.video_url on approve (not stored in festival_media).';
