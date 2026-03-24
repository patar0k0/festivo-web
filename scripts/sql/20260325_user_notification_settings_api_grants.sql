-- PREREQUISITE: `public.user_notification_settings` must exist.
-- If you see: relation "public.user_notification_settings" does not exist (42P01),
-- run FIRST (whole file, in Supabase SQL Editor):
--   scripts/sql/20260305_notification_preferences_and_follows.sql
-- Then run this file.
--
-- Without these grants, PostgREST can return 500 on insert/update
-- ("permission denied for table user_notification_settings") even when RLS policies exist.

grant select, insert, update on table public.user_notification_settings to authenticated;
grant all on table public.user_notification_settings to service_role;
