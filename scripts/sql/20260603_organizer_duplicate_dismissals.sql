-- organizer_duplicate_dismissals
-- Stores admin-dismissed false-positive organizer duplicate pairs.
-- RLS enabled, no public policies — service-role only.
-- Canonical order: organizer_a < organizer_b (lexical UUID comparison).

create table if not exists public.organizer_duplicate_dismissals (
  id            uuid        primary key default gen_random_uuid(),
  organizer_a   uuid        not null references public.organizers(id) on delete cascade,
  organizer_b   uuid        not null references public.organizers(id) on delete cascade,
  dismissed_by  uuid        references auth.users(id),
  created_at    timestamptz not null default now(),

  constraint organizer_duplicate_dismissals_ordered
    check (organizer_a < organizer_b),
  constraint organizer_duplicate_dismissals_unique
    unique (organizer_a, organizer_b)
);

-- organizer_a is already covered by the unique index.
-- Add index on organizer_b for reverse lookups and cascade scans.
create index if not exists idx_org_dup_dismissals_b
  on public.organizer_duplicate_dismissals (organizer_b);

alter table public.organizer_duplicate_dismissals enable row level security;
-- No public policies: anon and authenticated roles cannot access this table.
-- All access goes through the service-role client in admin API routes.
