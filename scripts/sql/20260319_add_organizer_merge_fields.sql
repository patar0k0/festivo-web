alter table public.organizers
  add column if not exists merged_into uuid references public.organizers(id) on delete set null;

alter table public.organizers
  add column if not exists is_active boolean not null default true;

create index if not exists organizers_is_active_idx on public.organizers (is_active);
create index if not exists organizers_merged_into_idx on public.organizers (merged_into);
