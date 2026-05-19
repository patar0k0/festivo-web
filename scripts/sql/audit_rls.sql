-- RLS Security Audit
-- Run in Supabase SQL Editor (production). Read-only — does not modify schema.
-- Returns 4 result sets. Review each. Anything in result set 1 or 2 is a launch blocker.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Tables in `public` schema WITHOUT RLS enabled (🚨 BLOCKERS)
-- ─────────────────────────────────────────────────────────────────────────────
select
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  '🚨 RLS DISABLED' as severity
from pg_tables
where schemaname = 'public'
  and rowsecurity = false
order by tablename;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Tables with RLS enabled but ZERO policies (effectively locked — anon/auth
--    cannot read or write; sometimes intentional for admin-only tables, but
--    must be confirmed table-by-table)
-- ─────────────────────────────────────────────────────────────────────────────
select
  t.schemaname,
  t.tablename,
  '⚠️ RLS on, no policies' as severity,
  'Confirm: admin-only via service_role, or missing policy?' as note
from pg_tables t
left join pg_policies p
  on p.schemaname = t.schemaname and p.tablename = t.tablename
where t.schemaname = 'public'
  and t.rowsecurity = true
  and p.policyname is null
order by t.tablename;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) All policies on `public` tables — review for overly permissive rules
--    (look for: `USING (true)`, role=`anon` on write, missing `auth.uid()` check)
-- ─────────────────────────────────────────────────────────────────────────────
select
  tablename,
  policyname,
  cmd                as command,
  array_to_string(roles, ',') as roles,
  permissive,
  qual               as using_expression,
  with_check         as with_check_expression
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Suspicious patterns flagged automatically
-- ─────────────────────────────────────────────────────────────────────────────
select
  tablename,
  policyname,
  cmd,
  array_to_string(roles, ',') as roles,
  case
    when qual = 'true' and cmd in ('SELECT')
      then '🟡 USING (true) on SELECT — public read; confirm intentional'
    when (qual = 'true' or with_check = 'true') and cmd in ('INSERT','UPDATE','DELETE','ALL')
      then '🚨 USING/WITH CHECK = true on write op'
    when 'anon' = any(roles) and cmd in ('INSERT','UPDATE','DELETE','ALL')
      then '🚨 anon role can WRITE'
    when qual is null and with_check is null and cmd <> 'SELECT'
      then '🟡 no USING/WITH CHECK on write op — verify'
  end as finding
from pg_policies
where schemaname = 'public'
  and (
    qual = 'true'
    or with_check = 'true'
    or 'anon' = any(roles)
    or (qual is null and with_check is null and cmd <> 'SELECT')
  )
order by
  case when 'anon' = any(roles) and cmd <> 'SELECT' then 0
       when qual = 'true' and cmd <> 'SELECT' then 0
       else 1 end,
  tablename;
