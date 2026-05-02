-- Authenticated users may insert their own public.users shadow row (id + optional email).
-- Middleware upserts (on conflict do nothing via client) so sessions always have a row
-- before gate reads; see lib/ensurePublicUserRowForSession.ts.

grant insert on table public.users to authenticated;

drop policy if exists "users_insert_own_row" on public.users;
create policy "users_insert_own_row"
  on public.users
  for insert
  to authenticated
  with check (id = auth.uid());
