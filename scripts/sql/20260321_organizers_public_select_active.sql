-- Публично четене на активни организатори (anon/authenticated), за да работят:
-- - страница /organizers/[slug]
-- - имена при join от festival_organizers без service role
--
-- Ако вече имаш подобна политика, прескочи или коригирай конфликтите.
alter table public.organizers enable row level security;

drop policy if exists "organizers_select_public_active" on public.organizers;

create policy "organizers_select_public_active"
  on public.organizers
  for select
  to anon, authenticated
  using (is_active = true);
