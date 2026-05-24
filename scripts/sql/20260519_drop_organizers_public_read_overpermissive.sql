-- Drop overly permissive SELECT policy on public.organizers.
--
-- Audit context (19 май 2026, launch sprint day 5):
-- `public.organizers` had two SELECT policies:
--   1) `organizers_select_public_active` — to anon,authenticated, USING (is_active = true)
--   2) `public_read_organizers`           — to public,             USING (true)
--
-- PostgreSQL OR-s SELECT policies, so (2) made (1) useless: anon clients could
-- read inactive / draft / unprovisioned organizers. We drop (2) so only active
-- rows are publicly readable, as originally intended in 20260321.
--
-- Safe to run multiple times.

drop policy if exists "public_read_organizers" on public.organizers;

-- Sanity: confirm the canonical active-only policy is still in place.
-- (No-op if already exists — matches 20260321_organizers_public_select_active.sql.)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'organizers'
      and policyname = 'organizers_select_public_active'
  ) then
    raise exception
      'organizers_select_public_active policy missing — run 20260321_organizers_public_select_active.sql first';
  end if;
end$$;
