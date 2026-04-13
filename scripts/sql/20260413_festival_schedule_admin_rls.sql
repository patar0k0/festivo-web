-- Allow authenticated admins (public.user_roles.role = 'admin') to manage published program rows.
-- Existing policies only expose SELECT for verified festivals; without these, INSERT/UPDATE/DELETE fail under RLS.
-- Idempotent: safe to re-run (drops named policies first).

drop policy if exists "festival_days_admin_modify" on public.festival_days;
drop policy if exists "festival_schedule_items_admin_modify" on public.festival_schedule_items;

alter table public.festival_days enable row level security;
alter table public.festival_schedule_items enable row level security;

create policy "festival_days_admin_modify"
on public.festival_days
for all
to authenticated
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
);

create policy "festival_schedule_items_admin_modify"
on public.festival_schedule_items
for all
to authenticated
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
);
