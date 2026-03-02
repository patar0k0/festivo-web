alter table public.user_roles enable row level security;

drop policy if exists "user_roles_read_own" on public.user_roles;

create policy "user_roles_read_own"
on public.user_roles
for select
to authenticated
using (auth.uid() = user_id);
