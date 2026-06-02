-- RLS Performance Optimization
-- 1. Replace bare auth.uid() with (select auth.uid()) to prevent per-row re-evaluation
-- 2. Remove duplicate permissive policies (multiple policies on same table/role/action)
--
-- Supabase advisor reference:
--   auth_rls_initplan  — https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- ----------------------------------------------------------------
-- cookie_consents
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage own consent" ON public.cookie_consents;
CREATE POLICY "Users can manage own consent" ON public.cookie_consents
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ----------------------------------------------------------------
-- device_tokens
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS device_tokens_delete_own ON public.device_tokens;
CREATE POLICY device_tokens_delete_own ON public.device_tokens
  FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS device_tokens_insert_own ON public.device_tokens;
CREATE POLICY device_tokens_insert_own ON public.device_tokens
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS device_tokens_select_own ON public.device_tokens;
CREATE POLICY device_tokens_select_own ON public.device_tokens
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS device_tokens_update_own ON public.device_tokens;
CREATE POLICY device_tokens_update_own ON public.device_tokens
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ----------------------------------------------------------------
-- festival_days: fix admin policy + drop two identical duplicate SELECTs
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS festival_days_admin_modify ON public.festival_days;
CREATE POLICY festival_days_admin_modify ON public.festival_days
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = (select auth.uid()) AND ur.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = (select auth.uid()) AND ur.role = 'admin'
  ));

DROP POLICY IF EXISTS festival_days_read_verified_parent ON public.festival_days;
DROP POLICY IF EXISTS festival_days_select_verified_parent ON public.festival_days;
-- Kept: festival_days_select_verified (identical qual, no auth.uid())

-- ----------------------------------------------------------------
-- festival_likes
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS festival_likes_delete_own ON public.festival_likes;
CREATE POLICY festival_likes_delete_own ON public.festival_likes
  FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS festival_likes_insert_own ON public.festival_likes;
CREATE POLICY festival_likes_insert_own ON public.festival_likes
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

-- ----------------------------------------------------------------
-- festival_schedule_items: fix admin policy + drop two duplicate SELECTs
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS festival_schedule_items_admin_modify ON public.festival_schedule_items;
CREATE POLICY festival_schedule_items_admin_modify ON public.festival_schedule_items
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = (select auth.uid()) AND ur.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = (select auth.uid()) AND ur.role = 'admin'
  ));

DROP POLICY IF EXISTS schedule_items_read_verified_parent ON public.festival_schedule_items;
DROP POLICY IF EXISTS schedule_items_select_verified_parent ON public.festival_schedule_items;
-- Kept: festival_schedule_items_select_verified

-- ----------------------------------------------------------------
-- festivals: drop duplicate SELECTs + old admin policies + fix organizer policy
-- ----------------------------------------------------------------
-- festivals_select_verified already covers {anon,authenticated} with status='verified'
DROP POLICY IF EXISTS festivals_read_verified ON public.festivals;
DROP POLICY IF EXISTS "public can read verified festivals" ON public.festivals;
-- festivals_select_preview_admin_organizers + festivals_admin_update supersede these
DROP POLICY IF EXISTS "admins can read festivals" ON public.festivals;
DROP POLICY IF EXISTS "admins can update festivals" ON public.festivals;

DROP POLICY IF EXISTS festivals_select_preview_admin_organizers ON public.festivals;
CREATE POLICY festivals_select_preview_admin_organizers ON public.festivals
  FOR SELECT TO authenticated
  USING (
    is_admin() OR (
      EXISTS (
        SELECT 1 FROM organizer_members om
        WHERE om.user_id = (select auth.uid())
          AND om.status = 'active'
          AND (
            (festivals.organizer_id IS NOT NULL AND om.organizer_id = festivals.organizer_id)
            OR EXISTS (
              SELECT 1 FROM festival_organizers fo
              WHERE fo.festival_id = festivals.id AND fo.organizer_id = om.organizer_id
            )
          )
      )
    )
  );

-- ----------------------------------------------------------------
-- organizer_members
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS organizer_members_select_own_or_admin ON public.organizer_members;
CREATE POLICY organizer_members_select_own_or_admin ON public.organizer_members
  FOR SELECT TO authenticated
  USING ((user_id = (select auth.uid())) OR is_admin());

-- ----------------------------------------------------------------
-- profiles: drop duplicate SELECT, fix remaining
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS profiles_read_own ON public.profiles;  -- identical to profiles_select_own

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated USING (id = (select auth.uid()));

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

-- ----------------------------------------------------------------
-- push_delivery_audit
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS push_delivery_audit_select_own ON public.push_delivery_audit;
CREATE POLICY push_delivery_audit_select_own ON public.push_delivery_audit
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS push_delivery_audit_update_own ON public.push_delivery_audit;
CREATE POLICY push_delivery_audit_update_own ON public.push_delivery_audit
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ----------------------------------------------------------------
-- user_email_preferences
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS user_email_preferences_insert_own ON public.user_email_preferences;
CREATE POLICY user_email_preferences_insert_own ON public.user_email_preferences
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS user_email_preferences_select_own ON public.user_email_preferences;
CREATE POLICY user_email_preferences_select_own ON public.user_email_preferences
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS user_email_preferences_update_own ON public.user_email_preferences;
CREATE POLICY user_email_preferences_update_own ON public.user_email_preferences
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ----------------------------------------------------------------
-- user_favorites: drop 4 duplicate policies, fix the 3 canonical ones
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS favorites_delete_own ON public.user_favorites;
DROP POLICY IF EXISTS favorites_insert_own ON public.user_favorites;
DROP POLICY IF EXISTS favorites_read_own ON public.user_favorites;
DROP POLICY IF EXISTS favorites_select_own ON public.user_favorites;

DROP POLICY IF EXISTS user_favorites_delete_own ON public.user_favorites;
CREATE POLICY user_favorites_delete_own ON public.user_favorites
  FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS user_favorites_insert_own ON public.user_favorites;
CREATE POLICY user_favorites_insert_own ON public.user_favorites
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS user_favorites_select_own ON public.user_favorites;
CREATE POLICY user_favorites_select_own ON public.user_favorites
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));

-- ----------------------------------------------------------------
-- user_followed_categories
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS user_followed_categories_delete_own ON public.user_followed_categories;
CREATE POLICY user_followed_categories_delete_own ON public.user_followed_categories
  FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS user_followed_categories_insert_own ON public.user_followed_categories;
CREATE POLICY user_followed_categories_insert_own ON public.user_followed_categories
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS user_followed_categories_select_own ON public.user_followed_categories;
CREATE POLICY user_followed_categories_select_own ON public.user_followed_categories
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));

-- ----------------------------------------------------------------
-- user_followed_cities
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS user_followed_cities_delete_own ON public.user_followed_cities;
CREATE POLICY user_followed_cities_delete_own ON public.user_followed_cities
  FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS user_followed_cities_insert_own ON public.user_followed_cities;
CREATE POLICY user_followed_cities_insert_own ON public.user_followed_cities
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS user_followed_cities_select_own ON public.user_followed_cities;
CREATE POLICY user_followed_cities_select_own ON public.user_followed_cities
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));

-- ----------------------------------------------------------------
-- user_followed_organizers
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS user_followed_organizers_delete_own ON public.user_followed_organizers;
CREATE POLICY user_followed_organizers_delete_own ON public.user_followed_organizers
  FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS user_followed_organizers_insert_own ON public.user_followed_organizers;
CREATE POLICY user_followed_organizers_insert_own ON public.user_followed_organizers
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS user_followed_organizers_select_own ON public.user_followed_organizers;
CREATE POLICY user_followed_organizers_select_own ON public.user_followed_organizers
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));

-- ----------------------------------------------------------------
-- user_notification_settings
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS user_notification_settings_insert_own ON public.user_notification_settings;
CREATE POLICY user_notification_settings_insert_own ON public.user_notification_settings
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS user_notification_settings_select_own ON public.user_notification_settings;
CREATE POLICY user_notification_settings_select_own ON public.user_notification_settings
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS user_notification_settings_update_own ON public.user_notification_settings;
CREATE POLICY user_notification_settings_update_own ON public.user_notification_settings
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ----------------------------------------------------------------
-- user_notifications
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS user_notifications_select_own ON public.user_notifications;
CREATE POLICY user_notifications_select_own ON public.user_notifications
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));

-- ----------------------------------------------------------------
-- user_plan_festivals
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS user_plan_festivals_delete_own ON public.user_plan_festivals;
CREATE POLICY user_plan_festivals_delete_own ON public.user_plan_festivals
  FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS user_plan_festivals_insert_own ON public.user_plan_festivals;
CREATE POLICY user_plan_festivals_insert_own ON public.user_plan_festivals
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS user_plan_festivals_select_own ON public.user_plan_festivals;
CREATE POLICY user_plan_festivals_select_own ON public.user_plan_festivals
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));

-- ----------------------------------------------------------------
-- user_plan_items
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS user_plan_items_delete_own ON public.user_plan_items;
CREATE POLICY user_plan_items_delete_own ON public.user_plan_items
  FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS user_plan_items_insert_own ON public.user_plan_items;
CREATE POLICY user_plan_items_insert_own ON public.user_plan_items
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS user_plan_items_select_own ON public.user_plan_items;
CREATE POLICY user_plan_items_select_own ON public.user_plan_items
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS user_plan_items_update_own ON public.user_plan_items;
CREATE POLICY user_plan_items_update_own ON public.user_plan_items
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ----------------------------------------------------------------
-- user_plan_reminders: drop old {public} role duplicates + fix canonical ones
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS delete_own ON public.user_plan_reminders;
DROP POLICY IF EXISTS insert_own ON public.user_plan_reminders;
DROP POLICY IF EXISTS select_own ON public.user_plan_reminders;
DROP POLICY IF EXISTS update_own ON public.user_plan_reminders;

DROP POLICY IF EXISTS user_plan_reminders_delete_own ON public.user_plan_reminders;
CREATE POLICY user_plan_reminders_delete_own ON public.user_plan_reminders
  FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS user_plan_reminders_insert_own ON public.user_plan_reminders;
CREATE POLICY user_plan_reminders_insert_own ON public.user_plan_reminders
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS user_plan_reminders_select_own ON public.user_plan_reminders;
CREATE POLICY user_plan_reminders_select_own ON public.user_plan_reminders
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS user_plan_reminders_update_own ON public.user_plan_reminders;
CREATE POLICY user_plan_reminders_update_own ON public.user_plan_reminders
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ----------------------------------------------------------------
-- user_roles: drop two duplicate SELECTs, fix canonical one
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS roles_read_own ON public.user_roles;
DROP POLICY IF EXISTS user_roles_read_own ON public.user_roles;

DROP POLICY IF EXISTS user_roles_select_own ON public.user_roles;
CREATE POLICY user_roles_select_own ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));

-- ----------------------------------------------------------------
-- users
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS users_select_self ON public.users;
CREATE POLICY users_select_self ON public.users
  FOR SELECT TO authenticated USING (id = (select auth.uid()));
