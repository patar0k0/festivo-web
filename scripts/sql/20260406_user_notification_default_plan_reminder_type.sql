-- Default reminder timing for newly saved plan festivals (user preference).
-- Applied on POST /api/plan/festivals; editable from /profile via notification settings API.

alter table public.user_notification_settings
  add column if not exists default_plan_reminder_type text not null default '24h';

alter table public.user_notification_settings
  drop constraint if exists user_notification_settings_default_plan_reminder_type_check;

alter table public.user_notification_settings
  add constraint user_notification_settings_default_plan_reminder_type_check
  check (default_plan_reminder_type in ('none', '24h', 'same_day_09'));

comment on column public.user_notification_settings.default_plan_reminder_type is
  'Reminder timing applied automatically when the user saves a festival to their plan; also edited from /profile.';
