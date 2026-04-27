-- Organizer portal: allow persisted preview drafts before submission.
alter table public.pending_festivals
  drop constraint if exists pending_festivals_status_check;

alter table public.pending_festivals
  add constraint pending_festivals_status_check
  check (status in ('draft', 'pending', 'approved', 'rejected'));
