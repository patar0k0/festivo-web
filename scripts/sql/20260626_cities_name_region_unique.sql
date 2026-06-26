-- Relax cities.name_bg uniqueness to (name_bg, region), so two settlements that
-- share a name in different municipalities can eventually coexist once an admin
-- (or future tooling) assigns them distinct `region` values. `slug` stays globally
-- unique unchanged — it's the URL path component and must not collide regardless
-- of region.
--
-- This does NOT change automated city-resolution behavior: resolveOrCreateCity()
-- and resolveCityReference() both look up by slug (derived from name alone) before
-- ever attempting an insert, so they will still find an existing same-named city
-- first and never reach a path that needs this looser constraint. This migration
-- only unblocks a future *manual* insert of a second same-named row with a
-- distinct region (e.g. via Supabase MCP, once a real collision is reported).
--
-- Safe to run as-is: all 262 existing rows have region = NULL today, so dropping
-- and re-adding the constraint has nothing to reconcile.

alter table public.cities drop constraint if exists cities_name_bg_key;
alter table public.cities add constraint cities_name_region_key unique (name_bg, region);
