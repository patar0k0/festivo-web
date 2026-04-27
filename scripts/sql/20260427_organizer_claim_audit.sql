-- Audit trail for admin approve/reject on organizer membership claims (organizer_members rows).

create table if not exists public.organizer_claim_audit (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null,
  organizer_id uuid not null references public.organizers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete restrict,
  action text not null check (action in ('approve', 'reject')),
  created_at timestamptz not null default now()
);

create index if not exists idx_claim_audit_claim_id
  on public.organizer_claim_audit (claim_id);

alter table public.organizer_claim_audit enable row level security;

grant select, insert on public.organizer_claim_audit to service_role;
