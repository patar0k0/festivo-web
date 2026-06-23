import type { SupabaseClient } from "@supabase/supabase-js";

import { logAdminAction } from "@/lib/admin/audit-log";
import { getBaseUrl } from "@/lib/config/baseUrl";
import { enqueueEmailJob } from "@/lib/email/enqueueEmail";
import {
  EMAIL_JOB_TYPE_ADMIN_FESTIVAL_CANCELLED,
  EMAIL_JOB_TYPE_FESTIVAL_CANCELLED,
} from "@/lib/email/emailJobTypes";

export type CancelledByType = "admin" | "organizer";

export type CancelFestivalInput = {
  festivalId: string;
  reason: string;
  cancelledByUserId: string;
  cancelledByType: CancelledByType;
  cancelledByDisplayName: string;
  organizerName?: string | null;
};

export type CancelFestivalResult = {
  planUsersNotified: number;
  adminAlertSent: boolean;
};

function formatBgDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("bg-BG", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Sofia",
    });
  } catch {
    return iso;
  }
}

/**
 * Core cancellation business logic.
 * Caller is responsible for auth checks and rate limiting.
 * Uses admin client (service role) to bypass RLS.
 */
export async function cancelFestival(
  admin: SupabaseClient,
  input: CancelFestivalInput,
): Promise<CancelFestivalResult> {
  const { festivalId, reason, cancelledByUserId, cancelledByType, cancelledByDisplayName, organizerName } = input;

  // 1. Load festival — must exist and not already cancelled
  const { data: festival, error: fetchErr } = await admin
    .from("festivals")
    .select("id, title, status, lifecycle_state, start_date, city_id, organizer_id")
    .eq("id", festivalId)
    .maybeSingle();

  if (fetchErr) throw new Error(fetchErr.message);
  if (!festival) throw Object.assign(new Error("festival_not_found"), { statusCode: 404 });
  if (festival.lifecycle_state === "cancelled") {
    throw Object.assign(new Error("already_cancelled"), { statusCode: 409 });
  }

  const now = new Date();
  const nowIso = now.toISOString();

  // 2. Mark as cancelled
  const { error: updateErr } = await admin
    .from("festivals")
    .update({
      lifecycle_state: "cancelled",
      cancelled_at: nowIso,
      cancellation_reason: reason.trim(),
      cancellation_announced_by: cancelledByUserId,
      updated_at: nowIso,
    })
    .eq("id", festivalId);

  if (updateErr) throw new Error(updateErr.message);

  // 3. Delete pending reminders for this festival
  const { error: reminderErr } = await admin
    .from("user_plan_reminders")
    .delete()
    .eq("festival_id", festivalId)
    .eq("status", "pending");

  if (reminderErr) {
    console.error("[cancelFestival] reminder delete failed", { festivalId, message: reminderErr.message });
  }

  // 4. Find plan users — join via public.users to get email
  const { data: planRows, error: planErr } = await admin
    .from("user_plan_festivals")
    .select("user_id, users!inner(email)")
    .eq("festival_id", festivalId);

  if (planErr) throw new Error(planErr.message);

  const planUsers = (planRows ?? []).map((row) => {
    const usersData = row.users as unknown as { email: string } | null;
    return {
      userId: row.user_id as string,
      email: usersData?.email ?? null,
    };
  }).filter((u): u is { userId: string; email: string } => Boolean(u.email));

  // 5. Build city name for CTAs
  let cityDisplay: string | null = null;
  let citySlug: string | null = null;
  if (festival.city_id) {
    const { data: city } = await admin
      .from("cities")
      .select("name, slug")
      .eq("id", festival.city_id)
      .maybeSingle();
    cityDisplay = city?.name ?? null;
    citySlug = city?.slug ?? null;
  }

  const base = getBaseUrl().replace(/\/$/, "");
  const alternativesUrl = citySlug
    ? `${base}/festivals?city=${citySlug}`
    : `${base}/festivals`;

  let calendarUrl = `${base}/calendar`;
  if (festival.start_date) {
    const month = (festival.start_date as string).slice(0, 7);
    calendarUrl = `${base}/calendar?month=${month}`;
  }

  const originalDateDisplay = festival.start_date
    ? formatBgDate(festival.start_date as string)
    : "Дата не е посочена";
  const cancellationDateDisplay = formatBgDate(nowIso);
  const festivalAdminUrl = `${base}/admin/festivals/${festivalId}`;

  // 6. Enqueue user emails (per-user, idempotent)
  let notifiedCount = 0;
  for (const u of planUsers) {
    try {
      const result = await enqueueEmailJob(admin, {
        type: EMAIL_JOB_TYPE_FESTIVAL_CANCELLED,
        recipientEmail: u.email,
        recipientUserId: u.userId,
        priority: "high",
        dedupeKey: `festival-cancelled:${festivalId}:${u.userId}`,
        payload: {
          festivalTitle: festival.title,
          cityDisplay,
          originalDateDisplay,
          cancellationDateDisplay,
          cancellationReason: reason.trim(),
          alternativesUrl,
          calendarUrl,
        },
      });
      if (result.outcome === "created") notifiedCount++;
    } catch (emailErr) {
      const message = emailErr instanceof Error ? emailErr.message : "unknown";
      console.error("[cancelFestival] email enqueue failed for user", { userId: u.userId, festivalId, message });
    }
  }

  // 7. Enqueue admin alert
  let adminAlertSent = false;
  const adminEmail = process.env.EMAIL_ADMIN?.trim();
  if (adminEmail) {
    try {
      await enqueueEmailJob(admin, {
        type: EMAIL_JOB_TYPE_ADMIN_FESTIVAL_CANCELLED,
        recipientEmail: adminEmail,
        priority: "normal",
        dedupeKey: `admin-festival-cancelled:${festivalId}:${nowIso.slice(0, 13)}`,
        payload: {
          festivalTitle: festival.title,
          festivalAdminUrl,
          cancelledByType,
          cancelledByDisplay: cancelledByDisplayName,
          organizerName: organizerName ?? null,
          cancellationReason: reason.trim(),
          planUsersCount: planUsers.length,
          cancelledAt: cancellationDateDisplay,
        },
      });
      adminAlertSent = true;
    } catch (alertErr) {
      const message = alertErr instanceof Error ? alertErr.message : "unknown";
      console.error("[cancelFestival] admin alert enqueue failed", { festivalId, message });
    }
  }

  // 8. Audit log
  try {
    await logAdminAction({
      actor_user_id: cancelledByUserId,
      action: cancelledByType === "organizer" ? "festival.cancelled_by_organizer" : "festival.cancelled",
      entity_type: "festival",
      entity_id: festivalId,
      route: cancelledByType === "organizer"
        ? "/api/organizer/festivals/[id]/cancel"
        : "/admin/api/festivals/[id]/cancel",
      method: "POST",
      details: {
        reason: reason.trim(),
        plan_users_notified: notifiedCount,
      },
    });
  } catch (auditErr) {
    const message = auditErr instanceof Error ? auditErr.message : "unknown";
    console.error("[cancelFestival] audit log failed", { festivalId, message });
  }

  return { planUsersNotified: notifiedCount, adminAlertSent };
}

/**
 * Reverses a cancellation. Admin only.
 * Does NOT send emails — user must manually re-add to plan.
 */
export async function uncancelFestival(
  admin: SupabaseClient,
  festivalId: string,
  adminUserId: string,
): Promise<void> {
  const { data: festival, error: fetchErr } = await admin
    .from("festivals")
    .select("id, lifecycle_state")
    .eq("id", festivalId)
    .maybeSingle();

  if (fetchErr) throw new Error(fetchErr.message);
  if (!festival) throw Object.assign(new Error("festival_not_found"), { statusCode: 404 });
  if (festival.lifecycle_state !== "cancelled") {
    throw Object.assign(new Error("not_cancelled"), { statusCode: 409 });
  }

  const { error: updateErr } = await admin
    .from("festivals")
    .update({
      lifecycle_state: "active",
      cancelled_at: null,
      cancellation_reason: null,
      cancellation_announced_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", festivalId);

  if (updateErr) throw new Error(updateErr.message);

  try {
    await logAdminAction({
      actor_user_id: adminUserId,
      action: "festival.uncancelled",
      entity_type: "festival",
      entity_id: festivalId,
      route: "/admin/api/festivals/[id]/uncancel",
      method: "POST",
      details: {},
    });
  } catch (auditErr) {
    const message = auditErr instanceof Error ? auditErr.message : "unknown";
    console.error("[uncancelFestival] audit log failed", { festivalId, message });
  }
}
