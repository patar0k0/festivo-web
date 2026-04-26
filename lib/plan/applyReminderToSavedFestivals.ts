import type { SupabaseClient } from "@supabase/supabase-js";
import { isFestivalPast } from "@/lib/festival/isFestivalPast";
import { syncReminderJobsForPreference } from "@/lib/notifications/triggers";
import type { ReminderType } from "@/lib/plan/server";

export type SavedReminderTimingSummary = {
  savedFestivalCount: number;
  /** Unified timing when every saved festival resolves the same; otherwise `mixed`. */
  timing: ReminderType | "mixed" | null;
};

/**
 * Effective reminder type per saved festival (matches plan UI: missing row → `none`).
 */
export async function getSavedReminderTimingSummary(
  userId: string,
  supabase: SupabaseClient,
): Promise<SavedReminderTimingSummary | { error: string }> {
  const { data: planRows, error: planErr } = await supabase
    .from("user_plan_festivals")
    .select("festival_id")
    .eq("user_id", userId);

  if (planErr) {
    return { error: planErr.message };
  }

  const festivalIds = [...new Set((planRows ?? []).map((r) => String(r.festival_id)))];
  if (!festivalIds.length) {
    return { savedFestivalCount: 0, timing: null };
  }

  const { data: remRows, error: remErr } = await supabase
    .from("user_plan_reminders")
    .select("festival_id,reminder_type")
    .eq("user_id", userId)
    .in("festival_id", festivalIds);

  if (remErr) {
    return { error: remErr.message };
  }

  const byFestival = new Map<string, ReminderType>();
  (remRows ?? []).forEach((r) => {
    const t = r.reminder_type as ReminderType;
    byFestival.set(String(r.festival_id), t);
  });

  const effective = festivalIds.map((id) => byFestival.get(id) ?? "none");
  const unique = new Set(effective);
  if (unique.size === 1) {
    return { savedFestivalCount: festivalIds.length, timing: effective[0]! };
  }
  return { savedFestivalCount: festivalIds.length, timing: "mixed" };
}

/**
 * Applies the same reminder timing to every festival in the user's plan and
 * aligns pending `notification_jobs` via `syncReminderJobsForPreference` (no scheduler changes).
 */
export async function applyReminderTypeToAllSavedFestivals(
  userId: string,
  reminderType: ReminderType,
  supabase: SupabaseClient,
): Promise<{ ok: true; festivalCount: number } | { ok: false; error: string }> {
  const { data: planRows, error: planErr } = await supabase
    .from("user_plan_festivals")
    .select("festival_id")
    .eq("user_id", userId);

  if (planErr) {
    return { ok: false, error: planErr.message };
  }

  const festivalIds = [...new Set((planRows ?? []).map((r) => String(r.festival_id)))];
  if (!festivalIds.length) {
    return { ok: true, festivalCount: 0 };
  }

  let eligibleFestivalIds = festivalIds;
  if (reminderType !== "none") {
    const { data: festivalRows, error: festivalError } = await supabase
      .from("festivals")
      .select("id,start_date,end_date")
      .in("id", festivalIds);

    if (festivalError) {
      return { ok: false, error: festivalError.message };
    }

    const eligibleSet = new Set(
      (festivalRows ?? [])
        .filter((row) =>
          !isFestivalPast({
            start_date: (row as { start_date: string | null }).start_date,
            end_date: (row as { end_date: string | null }).end_date,
          }),
        )
        .map((row) => String((row as { id: string }).id)),
    );

    eligibleFestivalIds = festivalIds.filter((id) => eligibleSet.has(id));
  }

  if (reminderType === "none") {
    const { error: delErr } = await supabase
      .from("user_plan_reminders")
      .delete()
      .eq("user_id", userId)
      .in("festival_id", festivalIds);

    if (delErr) {
      return { ok: false, error: delErr.message };
    }

    for (const festivalId of festivalIds) {
      const syncResult = await syncReminderJobsForPreference(userId, festivalId, "none");
      if (!syncResult.ok) {
        return { ok: false, error: syncResult.error ?? "Failed to sync reminder jobs" };
      }
    }
    return { ok: true, festivalCount: festivalIds.length };
  }

  if (!eligibleFestivalIds.length) {
    return { ok: true, festivalCount: 0 };
  }

  const upsertPayload = eligibleFestivalIds.map((festival_id) => ({
    user_id: userId,
    festival_id,
    reminder_type: reminderType,
  }));

  const { error: upErr } = await supabase.from("user_plan_reminders").upsert(upsertPayload, {
    onConflict: "user_id,festival_id",
  });

  if (upErr) {
    return { ok: false, error: upErr.message };
  }

  for (const festivalId of eligibleFestivalIds) {
    const syncResult = await syncReminderJobsForPreference(userId, festivalId, reminderType);
    if (!syncResult.ok) {
      return { ok: false, error: syncResult.error ?? "Failed to sync reminder jobs" };
    }
  }

  return { ok: true, festivalCount: eligibleFestivalIds.length };
}
