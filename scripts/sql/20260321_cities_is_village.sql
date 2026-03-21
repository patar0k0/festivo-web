-- Маркира села; градове остават с default false.
alter table public.cities
  add column if not exists is_village boolean not null default false;

comment on column public.cities.is_village is 'true = село (показва се с префикс „с.“ на сайта)';
