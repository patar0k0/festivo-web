-- Supabase Data API GRANT hardening.
-- From May 30 2026 new projects require explicit GRANTs on public schema tables.
-- From October 30 2026 this is enforced on all existing projects.
-- This migration adds the missing grants for tables created without them.
--
-- Safe to run multiple times (GRANTs are idempotent in Postgres).

-- user_plan_festivals (user's saved/planned festival list)
grant select, insert, delete on table public.user_plan_festivals to authenticated;
grant all on table public.user_plan_festivals to service_role;

-- user_notifications (per-user push notification records; server inserts, client reads own)
grant select on table public.user_notifications to authenticated;
grant all on table public.user_notifications to service_role;

-- pending_festivals (moderated submissions; RLS restricts by role)
grant select, insert, update, delete on table public.pending_festivals to authenticated;
grant all on table public.pending_festivals to service_role;

-- user_followed_cities / user_followed_categories / user_followed_organizers
grant select, insert, delete on table public.user_followed_cities to authenticated;
grant all on table public.user_followed_cities to service_role;

grant select, insert, delete on table public.user_followed_categories to authenticated;
grant all on table public.user_followed_categories to service_role;

grant select, insert, delete on table public.user_followed_organizers to authenticated;
grant all on table public.user_followed_organizers to service_role;

-- ingest_jobs (backend ingestion queue — no client access)
revoke all on table public.ingest_jobs from anon;
revoke all on table public.ingest_jobs from authenticated;
grant all on table public.ingest_jobs to service_role;

-- festival_organizers (public M2M — read-only for clients)
grant select on table public.festival_organizers to anon;
grant select on table public.festival_organizers to authenticated;
grant all on table public.festival_organizers to service_role;

-- organizer_members (column-level SELECT was added in 20260401; service_role grant was missing)
grant all on table public.organizer_members to service_role;

-- organizer_promotion_credits (billing — backend only)
revoke all on table public.organizer_promotion_credits from anon;
revoke all on table public.organizer_promotion_credits from authenticated;
grant all on table public.organizer_promotion_credits to service_role;

-- admin_audit_logs (backend audit log — no client access)
revoke all on table public.admin_audit_logs from anon;
revoke all on table public.admin_audit_logs from authenticated;
grant select, insert on table public.admin_audit_logs to service_role;

-- location_cache (internal geocoding cache — no client access)
revoke all on table public.location_cache from anon;
revoke all on table public.location_cache from authenticated;
grant all on table public.location_cache to service_role;

-- push_delivery_audit (users can read and acknowledge their own delivery records)
grant select, update on table public.push_delivery_audit to authenticated;
grant all on table public.push_delivery_audit to service_role;

-- analytics_events (server-side writes only; 20260512 created the table without the
-- service_role grant that 20260326 had on the earlier schema version)
revoke all on table public.analytics_events from anon;
revoke all on table public.analytics_events from authenticated;
grant all on table public.analytics_events to service_role;
