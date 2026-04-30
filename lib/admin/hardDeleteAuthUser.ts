import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Dev-only full removal (mirrors `POST /api/account/delete` ordering for a target user).
 */
export async function hardDeleteAuthUser(admin: SupabaseClient, userId: string): Promise<void> {
  const del = async (table: string, column = "user_id") => {
    const { error } = await admin.from(table).delete().eq(column, userId);
    if (error) {
      throw new Error(`${table}: ${error.message}`);
    }
  };

  const { error: revErr } = await admin.from("pending_festivals").update({ reviewed_by: null }).eq("reviewed_by", userId);
  if (revErr) {
    throw new Error(`pending_festivals.reviewed_by: ${revErr.message}`);
  }

  const { error: subErr } = await admin
    .from("pending_festivals")
    .update({ submitted_by_user_id: null })
    .eq("submitted_by_user_id", userId);
  if (subErr) {
    throw new Error(`pending_festivals.submitted_by_user_id: ${subErr.message}`);
  }

  const { error: apprErr } = await admin.from("organizer_members").update({ approved_by: null }).eq("approved_by", userId);
  if (apprErr) {
    throw new Error(`organizer_members.approved_by: ${apprErr.message}`);
  }

  const { error: auditErr } = await admin.from("admin_audit_logs").update({ actor_user_id: null }).eq("actor_user_id", userId);
  if (auditErr) {
    throw new Error(`admin_audit_logs: ${auditErr.message}`);
  }

  const { error: emailJobErr } = await admin.from("email_jobs").update({ recipient_user_id: null }).eq("recipient_user_id", userId);
  if (emailJobErr) {
    throw new Error(`email_jobs: ${emailJobErr.message}`);
  }

  await del("notification_jobs");
  await del("user_notifications");
  await del("user_plan_reminders");
  await del("user_plan_items");
  await del("user_plan_festivals");
  await del("device_tokens");
  await del("user_followed_cities");
  await del("user_followed_categories");
  await del("user_followed_organizers");
  await del("user_notification_settings");
  await del("user_email_preferences");
  await del("user_roles");
  await del("organizer_members");
  await del("user_favorites");

  const { error: profErr } = await admin.from("profiles").delete().eq("user_id", userId);
  if (profErr) {
    throw new Error(`profiles: ${profErr.message}`);
  }

  const { error: cookieErr } = await admin.from("cookie_consents").delete().eq("user_id", userId);
  if (cookieErr) {
    throw new Error(`cookie_consents: ${cookieErr.message}`);
  }

  await del("analytics_events");
  await del("outbound_clicks");

  const { error: authErr } = await admin.auth.admin.deleteUser(userId);
  if (authErr) {
    throw new Error(authErr.message);
  }

  const { error: sweepErr } = await admin.rpc("admin_sweep_user_after_auth_delete", { p_user_id: userId });
  if (sweepErr) {
    throw new Error(`post-auth sweep: ${sweepErr.message}`);
  }
}
