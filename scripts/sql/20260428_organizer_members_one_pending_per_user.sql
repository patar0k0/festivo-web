-- At most one pending organizer_members row per auth user (claims for any organizer).

create unique index if not exists organizer_members_one_pending_per_user
  on public.organizer_members (user_id)
  where status = 'pending';
