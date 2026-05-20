-- Newsletter signup: collects email addresses from public footer form
-- (and future popup/landing surfaces). Source of truth in Supabase; can
-- be exported to Resend audience later. No login required to subscribe.
--
-- Read access: SERVICE ROLE ONLY (no public reads — emails are PII).
-- Write access: SERVICE ROLE ONLY (route handler uses admin client).
--
-- Unsubscribe: GET /unsubscribe/[token] flow (already exists for
-- user_email_preferences) does NOT apply here — this is a separate
-- list for never-logged-in subscribers. Marketing emails sent to this
-- list MUST include an unsubscribe link with the token below.

begin;

create table if not exists public.newsletter_subscribers (
  id bigserial primary key,
  email text not null,
  email_lower text generated always as (lower(email)) stored,
  source text not null default 'footer',
  ip_address inet,
  user_agent text,
  consented_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  unsubscribe_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Case-insensitive uniqueness on email (e.g. Foo@bar.com == foo@bar.com).
create unique index if not exists newsletter_subscribers_email_lower_unique_idx
  on public.newsletter_subscribers (email_lower);

create index if not exists newsletter_subscribers_unsubscribe_token_idx
  on public.newsletter_subscribers (unsubscribe_token);

create index if not exists newsletter_subscribers_created_at_idx
  on public.newsletter_subscribers (created_at desc);

-- RLS: deny everything to anon/authenticated. Only service role bypasses
-- (route handler must use createSupabaseAdmin).
alter table public.newsletter_subscribers enable row level security;

-- Explicit deny policies (no anon/authenticated access).
drop policy if exists "newsletter_no_select" on public.newsletter_subscribers;
create policy "newsletter_no_select"
  on public.newsletter_subscribers
  for select
  to anon, authenticated
  using (false);

drop policy if exists "newsletter_no_insert" on public.newsletter_subscribers;
create policy "newsletter_no_insert"
  on public.newsletter_subscribers
  for insert
  to anon, authenticated
  with check (false);

drop policy if exists "newsletter_no_update" on public.newsletter_subscribers;
create policy "newsletter_no_update"
  on public.newsletter_subscribers
  for update
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "newsletter_no_delete" on public.newsletter_subscribers;
create policy "newsletter_no_delete"
  on public.newsletter_subscribers
  for delete
  to anon, authenticated
  using (false);

-- Auto-update updated_at on UPDATE.
create or replace function public.touch_newsletter_subscribers_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_newsletter_subscribers_updated_at on public.newsletter_subscribers;
create trigger trg_newsletter_subscribers_updated_at
  before update on public.newsletter_subscribers
  for each row
  execute function public.touch_newsletter_subscribers_updated_at();

commit;
