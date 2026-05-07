-- Manual discovery source controls (skip worker auto-disable or force skip).
-- manual_disabled: always skipped by discovery worker.
-- manual_override: soft-disable and approval-rate penalties bypassed; still subject to global caps.

alter table public.discovery_sources
  add column if not exists manual_disabled boolean not null default false;

alter table public.discovery_sources
  add column if not exists manual_override boolean not null default false;

comment on column public.discovery_sources.manual_disabled is
  'When true, discovery worker skips this source every run (admin manual off).';

comment on column public.discovery_sources.manual_override is
  'When true, discovery worker ignores auto soft-disable and approval-rate penalties for this source.';
