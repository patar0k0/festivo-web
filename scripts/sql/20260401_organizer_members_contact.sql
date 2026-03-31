-- Claim verification: contact fields on pending owner claims (admin-only visibility at Postgres layer).

alter table public.organizer_members
  add column if not exists contact_email text,
  add column if not exists contact_phone text;

-- JWT-authenticated clients may still SELECT own rows via RLS, but must not see verification contacts.
-- Service role (admin API routes) retains full row access.
revoke select on public.organizer_members from authenticated;

grant select (
  id,
  organizer_id,
  user_id,
  role,
  status,
  created_at,
  approved_at,
  approved_by
) on public.organizer_members to authenticated;
