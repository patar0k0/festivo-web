-- Address Supabase security advisors:
--   1. function_search_path_mutable: set search_path on trigger/utility functions
--   2. anon/authenticated SECURITY DEFINER executable: revoke EXECUTE from anon/authenticated
--      on admin-only and job-only RPC functions (still callable by service_role).
--
-- NOT touched on purpose:
--   - public.is_admin()  -> used by many RLS policies; authenticated MUST keep EXECUTE
--     or RLS evaluation will fail for admin users.

-- ---------------------------------------------------------------------------
-- 1. Pin search_path on functions flagged as mutable
-- ---------------------------------------------------------------------------

ALTER FUNCTION public.set_updated_at()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.set_festival_city_slug()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.touch_newsletter_subscribers_updated_at()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.is_admin(p_user_id uuid)
  SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 2. Lock down SECURITY DEFINER RPC functions
--    Service role bypasses GRANTs, so server-side code keeps working.
-- ---------------------------------------------------------------------------

-- Admin-only sweep/auth helpers (callable today via /rest/v1/rpc/... by anon)
REVOKE EXECUTE ON FUNCTION public.admin_claim_user_sweep_retry_batch(integer)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_invalidate_auth_sessions(uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_set_user_soft_deleted(uuid, boolean, uuid, text)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_sweep_user_after_auth_delete(uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_sync_user_banned_until(uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;

-- Job-runner only
REVOKE EXECUTE ON FUNCTION public.claim_due_email_jobs(integer)
  FROM PUBLIC, anon, authenticated;

-- Trigger-only functions on auth.users (fired by the trigger system, not via REST)
REVOKE EXECUTE ON FUNCTION public.handle_new_user()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.enqueue_welcome_email_on_user_insert()
  FROM PUBLIC, anon, authenticated;
