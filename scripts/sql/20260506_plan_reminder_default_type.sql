-- Extend default_plan_reminder_type to include `default` (24h + 2h push reminders for new saves).
-- Idempotent; no new tables.

alter table public.user_notification_settings
  drop constraint if exists user_notification_settings_default_plan_reminder_type_check;

alter table public.user_notification_settings
  add constraint user_notification_settings_default_plan_reminder_type_check
  check (default_plan_reminder_type in ('none', '24h', 'same_day_09', 'default'));

comment on column public.user_notification_settings.default_plan_reminder_type is
  'Default for newly saved plan festivals: none | default (24h+2h) | legacy 24h | legacy same_day_09 (all non-none schedule both push reminders).';
