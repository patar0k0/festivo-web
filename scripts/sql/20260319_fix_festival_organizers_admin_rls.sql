-- Allow admin moderation flows to manage festival_organizers links under RLS.
-- Keeps public reads while restricting writes to authenticated admins.

alter table public.festival_organizers enable row level security;

drop policy if exists "festival_organizers_admin_insert" on public.festival_organizers;
create policy "festival_organizers_admin_insert"
  on public.festival_organizers
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "festival_organizers_admin_update" on public.festival_organizers;
create policy "festival_organizers_admin_update"
  on public.festival_organizers
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "festival_organizers_admin_delete" on public.festival_organizers;
create policy "festival_organizers_admin_delete"
  on public.festival_organizers
  for delete
  to authenticated
  using (public.is_admin());
