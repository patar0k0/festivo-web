import type { SupabaseClient } from "@supabase/supabase-js";
import { isAuthUserNotFoundError } from "@/lib/admin/authAdminErrors";
import { postAuthUserSweep } from "@/lib/admin/postAuthUserSweep";
import {
  clearUserSweepTracking,
  enqueueUserSweepRetry,
  markUserCleanupPending,
} from "@/lib/admin/userSweepRetryQueue";

/**
 * Remove application data for a user (everything except the post-auth RPC sweep).
 * Safe to run when auth user is already gone.
 */
/** Tables that may not exist in every environment (legacy/phantom references in code). */
const OPTIONAL_TABLES = new Set([
  "profiles",
  "cookie_consents",
  "user_favorites",
]);

function isMissingRelationOrColumnError(message: string): boolean {
  // PostgREST surface for: relation "x" does not exist  |  column "x.y" does not exist
  return /does not exist/i.test(message);
}

export async function purgeUserApplicationData(admin: SupabaseClient, userId: string): Promise<void> {
  const del = async (table: string, column = "user_id") => {
    const { error } = await admin.from(table).delete().eq(column, userId);
    if (error) {
      if (OPTIONAL_TABLES.has(table) && isMissingRelationOrColumnError(error.message)) {
        console.warn(`[purgeUserApplicationData] skipping ${table} (not present in this env): ${error.message}`);
        return;
      }
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

  await del("profiles");
  await del("cookie_consents");

  await del("analytics_events");
  await del("outbound_clicks");
}

/**
 * Dev-only full removal (mirrors `POST /api/account/delete` ordering for a target user).
 * Idempotent when auth user is already deleted.
 */
export async function hardDeleteAuthUser(admin: SupabaseClient, userId: string): Promise<void> {
  const { data: authLookup, error: authLookupErr } = await admin.auth.admin.getUserById(userId);
  const authUser = authLookup?.user ?? null;

  if (authLookupErr && !isAuthUserNotFoundError(authLookupErr)) {
    throw new Error(authLookupErr.message);
  }

  if (!authUser) {
    await purgeUserApplicationData(admin, userId);
    await enqueueUserSweepRetry(admin, userId, { seenInAuthBefore: false });
    await markUserCleanupPending(admin, userId);
    try {
      await postAuthUserSweep(admin, userId, {
        label: "hard_delete_auth_already_missing",
        userId,
        authUserExistedBeforeSweep: false,
      });
    } catch (e) {
      console.error("[hardDeleteAuthUser] sweep failed (auth already missing)", { userId, message: (e as Error).message });
      throw e;
    }
    return;
  }

  await purgeUserApplicationData(admin, userId);

  await enqueueUserSweepRetry(admin, userId, { seenInAuthBefore: true });
  await markUserCleanupPending(admin, userId);

  const { error: authErr } = await admin.auth.admin.deleteUser(userId);
  if (authErr && !isAuthUserNotFoundError(authErr)) {
    await clearUserSweepTracking(admin, userId);
    throw new Error(authErr.message);
  }

  try {
    await postAuthUserSweep(admin, userId, {
      label: "hard_delete_after_auth_remove",
      userId,
      authUserExistedBeforeSweep: true,
    });
  } catch (e) {
    console.error("[hardDeleteAuthUser] sweep failed after auth delete", { userId, message: (e as Error).message });
    throw e;
  }
}
