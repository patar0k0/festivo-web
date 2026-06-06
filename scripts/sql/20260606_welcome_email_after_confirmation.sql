-- Send welcome email after email confirmation, not immediately on signup.
--
-- Previously the trigger fired on INSERT → welcome email arrived before
-- the user confirmed their address (both emails in inbox simultaneously).
--
-- New behaviour:
--   INSERT  → only for OAuth / auto-confirmed users (email_confirmed_at already set)
--   UPDATE  → when email_confirmed_at transitions NULL → non-NULL (email/password signup)

-- Drop existing INSERT-only trigger
DROP TRIGGER IF EXISTS trg_enqueue_welcome_email ON auth.users;

-- Replace function to handle both INSERT and UPDATE paths
CREATE OR REPLACE FUNCTION public.enqueue_welcome_email_on_user_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_dedupe text;
begin
  -- INSERT path: only proceed for auto-confirmed users (OAuth, magic link, etc.)
  if TG_OP = 'INSERT' and NEW.email_confirmed_at IS NULL then
    return new;
  end if;

  -- UPDATE path: only proceed when email_confirmed_at transitions NULL → non-NULL
  if TG_OP = 'UPDATE' then
    if OLD.email_confirmed_at IS NOT NULL or NEW.email_confirmed_at IS NULL then
      return new;
    end if;
  end if;

  -- Need a valid email to send to.
  if NEW.email is null or btrim(NEW.email) = '' then
    return new;
  end if;

  v_dedupe := 'welcome:' || NEW.id::text;

  -- Idempotent: skip if already enqueued.
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
    lower(btrim(NEW.email)),
    NEW.id,
    'bg',
    '{}'::jsonb,
    v_dedupe,
    now(),
    3,
    'high',
    'pending'
  );

  return new;
exception
  when others then
    raise warning 'enqueue_welcome_email_on_user_insert failed for user %: %', NEW.id, sqlerrm;
    return new;
end;
$function$;

-- INSERT trigger: covers OAuth / auto-confirmed signups
CREATE TRIGGER trg_enqueue_welcome_email
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_welcome_email_on_user_insert();

-- UPDATE trigger: covers email/password signups confirming their address
CREATE TRIGGER trg_enqueue_welcome_email_on_confirm
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_welcome_email_on_user_insert();
