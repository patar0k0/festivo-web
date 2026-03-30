-- Monetization schema: organizer plans, festival promotions, and yearly promotion credits.

alter table if exists public.organizers
  add column if not exists plan text not null default 'free',
  add column if not exists plan_started_at timestamptz null,
  add column if not exists plan_expires_at timestamptz null,
  add column if not exists included_promotions_per_year int not null default 0,
  add column if not exists organizer_rank int not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organizers_plan_check'
      and conrelid = 'public.organizers'::regclass
  ) then
    alter table public.organizers
      add constraint organizers_plan_check
      check (plan in ('free', 'vip'));
  end if;
end $$;

alter table if exists public.festivals
  add column if not exists promotion_status text not null default 'normal',
  add column if not exists promotion_started_at timestamptz null,
  add column if not exists promotion_expires_at timestamptz null,
  add column if not exists promotion_rank int not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'festivals_promotion_status_check'
      and conrelid = 'public.festivals'::regclass
  ) then
    alter table public.festivals
      add constraint festivals_promotion_status_check
      check (promotion_status in ('normal', 'promoted'));
  end if;
end $$;

create table if not exists public.organizer_promotion_credits (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizers(id) on delete cascade,
  credit_year int not null,
  included_total int not null default 0,
  used_total int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizer_promotion_credits_organizer_year_unique unique (organizer_id, credit_year)
);
