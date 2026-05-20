-- Enqueue welcome email when a new public.users row is created.
--
-- Why a DB trigger (not app code):
--   `public.users` rows are created in multiple places — most notably via
--   `ensurePublicUserRowForSession` in middleware, which runs on every
--   authenticated request and uses upsert+ignoreDuplicates (cannot tell
--   "newly inserted" from "already existed" without a refactor). A trigger
--   guarantees exactly-once enqueue, atomic with the row creation, regardless
--   of which code path inserted the row (auth callback, middleware, OAuth,
--   manual admin creation).
--
-- Idempotent: re-running this migration drops and recreates the trigger.
--             The trigger itself checks for an existing dedupe_key row, so
--             back-filled users won't double-enqueue if this runs in the
--             middle of a deploy where some users have already received
--             welcome emails via earlier app-side code.

create or replace function public.enqueue_welcome_email_on_user_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_dedupe text;
begin
  -- Need a valid email to send to.
  if new.email is null or btrim(new.email) = '' then
    return new;
  end if;

  v_dedupe := 'welcome:' || new.id::text;

  -- Idempotent: skip if already enqueued (covers manual back-fills and
  -- re-runs of this migration).
  if exists (
    select 1 from public.email_jobs where dedupe_key = v_dedupe limit 1
  ) then
    return new;
  end if;

  insert into public.email_jobs (
    type,
    recipient_email,
    recipient_user_id,
    locale,
    payload,
    dedupe_key,
    scheduled_at,
    max_attempts,
    priority,
    status
  ) values (
    'welcome',
    lower(btrim(new.email)),
    new.id,
    'bg',
    '{}'::jsonb,
    v_dedupe,
    now(),
    3,
    'high',          -- first impression — process ahead of routine reminders
    'pending'
  );

  return new;
exception
  -- Never block user-row insertion if the email enqueue fails. Log to PG
  -- and let the user signup succeed; we'll lose one welcome email rather
  -- than break onboarding.
  when others then
    raise warning 'enqueue_welcome_email_on_user_insert failed for user %: %', new.id, sqlerrm;
    return new;
end;
$$;

drop trigger if exists trg_enqueue_welcome_email on public.users;
create trigger trg_enqueue_welcome_email
  after insert on public.users
  for each row
  execute function public.enqueue_welcome_email_on_user_insert();

comment on function public.enqueue_welcome_email_on_user_insert()
  is 'Trigger function: enqueues a welcome email_jobs row exactly once per new public.users row. Dedupe key welcome:<user_id>. Fails open on email_jobs errors.';
