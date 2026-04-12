import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

async function requireUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user?.id) return null;
  return user.id;
}

export async function POST() {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const { error: authErr } = await admin.auth.admin.deleteUser(userId);
    if (authErr) {
      console.error("[account/delete] auth.admin.deleteUser", authErr);
      throw new Error(authErr.message);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
