-- Remove oblast/region fields from catalog and weekend notification preferences.
-- Apply after web code no longer selects or writes these columns.

alter table public.festivals drop column if exists region;
alter table public.pending_festivals drop column if exists region;
alter table public.user_notification_settings drop column if exists region_slugs;
