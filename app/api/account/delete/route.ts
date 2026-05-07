import { NextResponse } from "next/server";
import { nextResponseForRequireActiveUserError, requireActiveUser } from "@/lib/auth/requireActiveUser";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isAuthUserNotFoundError } from "@/lib/admin/authAdminErrors";
import { postAuthUserSweep } from "@/lib/admin/postAuthUserSweep";
import {
  clearUserSweepTracking,
  enqueueUserSweepRetry,
  markUserCleanupPending,
} from "@/lib/admin/userSweepRetryQueue";

export async function POST(request: Request) {
  let userId: string;
  try {
    const user = await requireActiveUser(request);
    userId = user.id;
  } catch (e) {
    const r = nextResponseForRequireActiveUserError(e);
    if (r) return r;
    console.error("[account/delete] auth", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch (e) {
    console.error("[account/delete] missing service role", e);
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 503 });
  }

  const del = async (table: string, column = "user_id") => {
    const { error } = await admin.from(table).delete().eq(column, userId);
    if (error) {
      console.error(`[account/delete] ${table}`, error);
      throw new Error(`${table}: ${error.message}`);
    }
  };

  try {
    const { error: revErr } = await admin.from("pending_festivals").update({ reviewed_by: null }).eq("reviewed_by", userId);
    if (revErr) {
      console.error("[account/delete] pending_festivals reviewed_by", revErr);
      throw new Error(`pending_festivals.reviewed_by: ${revErr.message}`);
    }

    const { error: subErr } = await admin
      .from("pending_festivals")
      .update({ submitted_by_user_id: null })
      .eq("submitted_by_user_id", userId);
    if (subErr) {
      console.error("[account/delete] pending_festivals submitted_by", subErr);
      throw new Error(`pending_festivals.submitted_by_user_id: ${subErr.message}`);
    }

    const { error: apprErr } = await admin.from("organizer_members").update({ approved_by: null }).eq("approved_by", userId);
    if (apprErr) {
      console.error("[account/delete] organizer_members approved_by", apprErr);
      throw new Error(`organizer_members.approved_by: ${apprErr.message}`);
    }

    const { error: auditErr } = await admin.from("admin_audit_logs").update({ actor_user_id: null }).eq("actor_user_id", userId);
    if (auditErr) {
      console.error("[account/delete] admin_audit_logs", auditErr);
      throw new Error(`admin_audit_logs: ${auditErr.message}`);
    }

    const { error: emailJobErr } = await admin.from("email_jobs").update({ recipient_user_id: null }).eq("recipient_user_id", userId);
    if (emailJobErr) {
      console.error("[account/delete] email_jobs", emailJobErr);
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
      console.error("[account/delete] profiles", profErr);
      throw new Error(`profiles: ${profErr.message}`);
    }

    const { error: cookieErr } = await admin.from("cookie_consents").delete().eq("user_id", userId);
    if (cookieErr) {
      console.error("[account/delete] cookie_consents", cookieErr);
      throw new Error(`cookie_consents: ${cookieErr.message}`);
    }

    await del("analytics_events");
    await del("outbound_clicks");

    await enqueueUserSweepRetry(admin, userId, { seenInAuthBefore: true });
    await markUserCleanupPending(admin, userId);

    const { error: authErr } = await admin.auth.admin.deleteUser(userId);
    if (authErr && !isAuthUserNotFoundError(authErr)) {
      console.error("[account/delete] auth.admin.deleteUser", authErr);
      await clearUserSweepTracking(admin, userId);
      throw new Error(authErr.message);
    }

    await postAuthUserSweep(admin, userId, {
      label: "account_self_delete",
      userId,
      authUserExistedBeforeSweep: true,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
