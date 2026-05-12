-- Extend the reminder_type check on user_plan_reminders to include 'default'.
--
-- POST /api/mobile/plan/festivals upserts a row with reminder_type='default'
-- whenever the user's user_notification_settings.default_plan_reminder_type
-- is not 'none'. The existing check predates that wiring and only allowed
-- ('none', '24h', 'same_day_09'), so the upsert failed silently in the
-- best-effort reminder sync and the reminder row was never written.

begin;

alter table public.user_plan_reminders
  drop constraint if exists user_plan_reminders_reminder_type_check;

alter table public.user_plan_reminders
  add constraint user_plan_reminders_reminder_type_check
  check (reminder_type in ('none', '24h', 'same_day_09', 'default'));

commit;
