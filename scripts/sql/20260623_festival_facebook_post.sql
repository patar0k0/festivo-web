-- 20260623_festival_facebook_post.sql
-- Track manual Facebook Page posts made from the admin festival edit page.

alter table public.festivals
  add column if not exists facebook_post_id text,
  add column if not exists facebook_posted_at timestamptz;

comment on column public.festivals.facebook_post_id is
  'Graph API post id of the most recent manual Facebook Page post (admin edit page).';
comment on column public.festivals.facebook_posted_at is
  'Timestamp of the most recent manual Facebook Page post.';

-- No new RLS policies: these columns are written only by the service-role
-- admin route; existing festivals RLS is unchanged. No index: not used in
-- filter/sort paths.
