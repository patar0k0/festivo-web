create table if not exists public.festival_organizers (
  festival_id uuid not null references public.festivals(id) on delete cascade,
  organizer_id uuid not null references public.organizers(id) on delete cascade,
  role text null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint festival_organizers_unique unique (festival_id, organizer_id)
);

create index if not exists festival_organizers_festival_id_idx
  on public.festival_organizers (festival_id);

create index if not exists festival_organizers_organizer_id_idx
  on public.festival_organizers (organizer_id);

create index if not exists festival_organizers_sort_order_idx
  on public.festival_organizers (festival_id, sort_order);

insert into public.festival_organizers (festival_id, organizer_id, sort_order)
select f.id, f.organizer_id, 0
from public.festivals f
where f.organizer_id is not null
on conflict (festival_id, organizer_id) do nothing;

alter table public.festival_organizers enable row level security;

drop policy if exists "festival_organizers_public_read" on public.festival_organizers;

create policy "festival_organizers_public_read"
  on public.festival_organizers
  for select
  using (true);
