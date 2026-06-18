-- scripts/sql/20260601_festival_organizers_role_constraint.sql
-- Per-festival роли (owner + co_host) за multi-organizer фестивали.
-- Колоната role вече съществува от 20260319 (nullable text, неизползвана).
-- Тук я ограничаваме до { owner, co_host } с default 'co_host' и
-- forcing-ваме точно един owner на фестивал.

-- 1) Нормализирай NULL към 'co_host' (исторически редове).
update public.festival_organizers
set role = 'co_host'
where role is null;

-- 2) Default + NOT NULL + check.
alter table public.festival_organizers
  alter column role set default 'co_host',
  alter column role set not null;

alter table public.festival_organizers
  drop constraint if exists festival_organizers_role_check;

alter table public.festival_organizers
  add constraint festival_organizers_role_check
  check (role in ('owner', 'co_host'));

-- 3) Точно един owner на фестивал.
create unique index if not exists festival_organizers_one_owner_idx
  on public.festival_organizers (festival_id)
  where role = 'owner';

comment on column public.festival_organizers.role is
  'Per-festival роля: owner (пълни edit права, най-много един) или co_host (display-only). Default co_host.';
