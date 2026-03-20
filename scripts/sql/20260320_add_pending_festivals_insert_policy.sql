-- Allow admins to create moderation drafts in pending_festivals.
-- Existing table has RLS enabled; without INSERT policy draft creation fails.

drop policy if exists "pending_festivals_admin_insert" on public.pending_festivals;
create policy "pending_festivals_admin_insert"
  on public.pending_festivals
  for insert
  to authenticated
  with check (public.is_admin());
