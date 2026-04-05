-- Draft program (days + items) for moderation; published to festival_days / festival_schedule_items on approve.

alter table public.pending_festivals
  add column if not exists program_draft jsonb;

comment on column public.pending_festivals.program_draft is
  'Structured program draft for admin review. Shape: { version?: number, days: [{ date, title?, items: [{ title, start_time?, end_time?, stage?, description?, sort_order? }] }] }. Copied to festival_days and festival_schedule_items when pending is approved.';
