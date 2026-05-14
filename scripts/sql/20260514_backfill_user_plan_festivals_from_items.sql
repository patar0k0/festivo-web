-- Backfill user_plan_festivals for users who picked a schedule item without
-- explicitly saving the parent festival. The web/mobile UI now auto-adds the
-- festival when a schedule item is toggled on (see app/api/plan/items),
-- but rows created before that fix can have user_plan_items entries with no
-- matching user_plan_festivals row. The mobile Plan tab's "Програма" view
-- then can't fetch the festival detail and renders an empty calendar even
-- though the stats counter says "Точки: N".
--
-- Safe to re-run: ON CONFLICT DO NOTHING.

begin;

insert into public.user_plan_festivals (user_id, festival_id)
select distinct upi.user_id, fd.festival_id
from public.user_plan_items upi
join public.festival_schedule_items fsi on fsi.id = upi.schedule_item_id
join public.festival_days fd on fd.id = fsi.day_id
on conflict (user_id, festival_id) do nothing;

commit;
