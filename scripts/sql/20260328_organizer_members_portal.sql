-- Organizer portal MVP: memberships linking auth users to public organizer profiles,
-- plus traceability columns on pending_festivals for organizer-submitted drafts.

create table if not exists public.organizer_members (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'editor')),
  status text not null check (status in ('pending', 'active', 'revoked')),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users (id) on delete set null,
  constraint organizer_members_organizer_user_unique unique (organizer_id, user_id)
);

create index if not exists organizer_members_user_id_idx
  on public.organizer_members (user_id);

create index if not exists organizer_members_organizer_id_idx
  on public.organizer_members (organizer_id);

create index if not exists organizer_members_status_idx
  on public.organizer_members (status);

alter table public.organizer_members enable row level security;

drop policy if exists "organizer_members_select_own_or_admin" on public.organizer_members;
create policy "organizer_members_select_own_or_admin"
  on public.organizer_members
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Writes go through server routes with service role (or admin session); no broad user insert/update policies.

alter table public.pending_festivals
  add column if not exists organizer_id uuid references public.organizers (id) on delete set null;

alter table public.pending_festivals
  add column if not exists submitted_by_user_id uuid references auth.users (id) on delete set null;

alter table public.pending_festivals
  add column if not exists submission_source text;

alter table public.pending_festivals
  add column if not exists city_name_display text;

alter table public.pending_festivals
  drop constraint if exists pending_festivals_submission_source_check;

alter table public.pending_festivals
  add constraint pending_festivals_submission_source_check
  check (
    submission_source is null
    or submission_source in ('organizer_portal', 'admin', 'ingest', 'research')
  );

create index if not exists pending_festivals_organizer_id_idx
  on public.pending_festivals (organizer_id);

create index if not exists pending_festivals_submitted_by_user_id_idx
  on public.pending_festivals (submitted_by_user_id);

create index if not exists pending_festivals_submission_source_idx
  on public.pending_festivals (submission_source);
