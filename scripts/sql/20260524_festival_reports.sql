-- Migration: festival_reports table
-- 2026-05-24

create table if not exists public.festival_reports (
  id           uuid primary key default gen_random_uuid(),
  festival_id  uuid not null references public.festivals(id) on delete cascade,
  category     text not null check (category in (
                  'wrong_info', 'wrong_location', 'broken_link',
                  'event_cancelled', 'other'
               )),
  message      text not null check (char_length(message) between 1 and 1000),
  reporter_ip  text,
  created_at   timestamptz not null default now(),
  reviewed     boolean not null default false,
  reviewed_at  timestamptz,
  reviewed_by  uuid references auth.users(id)
);

create index if not exists festival_reports_festival_id_idx
  on public.festival_reports(festival_id);

create index if not exists festival_reports_created_at_idx
  on public.festival_reports(created_at desc);

create index if not exists festival_reports_reviewed_idx
  on public.festival_reports(reviewed)
  where reviewed = false;

-- RLS: само service role достъпва таблицата
alter table public.festival_reports enable row level security;

-- No policies -- service role bypasses RLS; anon insert only via /api/festivals/[id]/report
