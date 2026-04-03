import type { SupabaseClient } from "@supabase/supabase-js";

import type { EmailJobType } from "./emailJobTypes";
import { getEmailTypeCategory } from "./emailTypeCategory";

export type UserEmailPreferencesRow = {
  user_id: string;
  reminder_emails_enabled: boolean;
  organizer_update_emails_enabled: boolean;
  marketing_emails_enabled: boolean;
  unsubscribed_all_optional: boolean;
  unsubscribe_token: string;
  created_at: string;
  updated_at: string;
};

const PREF_SELECT = [
  "user_id",
  "reminder_emails_enabled",
  "organizer_update_emails_enabled",
  "marketing_emails_enabled",
  "unsubscribed_all_optional",
  "unsubscribe_token",
  "created_at",
  "updated_at",
].join(",");

/** In-memory defaults when no DB row exists (matches column defaults). */
export function defaultUserEmailPreferences(userId: string): UserEmailPreferencesRow {
  return {
    user_id: userId,
    reminder_emails_enabled: true,
    organizer_update_emails_enabled: true,
    marketing_emails_enabled: true,
    unsubscribed_all_optional: false,
    unsubscribe_token: "",
    created_at: "",
    updated_at: "",
  };
}

function mergeWithDefaults(userId: string, row: UserEmailPreferencesRow | null): UserEmailPreferencesRow {
  const d = defaultUserEmailPreferences(userId);
  if (!row) return d;
  return {
    ...d,
    ...row,
    user_id: row.user_id,
  };
}

/**
 * Returns existing row or inserts defaults. Caller must use a client allowed to read/write the table
 * (authenticated user for self, or service_role in jobs).
 */
export async function getOrCreateUserEmailPreferences(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserEmailPreferencesRow> {
  const { data: existing, error: selErr } = await supabase
    .from("user_email_preferences")
    .select(PREF_SELECT)
    .eq("user_id", userId)
    .maybeSingle();

  if (selErr) {
    console.warn("[email_prefs] select failed", { user_id: userId, message: selErr.message });
    return mergeWithDefaults(userId, null);
  }

  if (existing && typeof (existing as { user_id?: unknown }).user_id === "string") {
    return existing as unknown as UserEmailPreferencesRow;
  }

  const { data: inserted, error: insErr } = await supabase
    .from("user_email_preferences")
    .insert({ user_id: userId })
    .select(PREF_SELECT)
    .single();

  if (!insErr && inserted) {
    return inserted as unknown as UserEmailPreferencesRow;
  }

  const isDup =
    insErr?.code === "23505" ||
    (typeof insErr?.message === "string" && insErr.message.toLowerCase().includes("duplicate"));

  if (isDup) {
    const { data: again } = await supabase.from("user_email_preferences").select(PREF_SELECT).eq("user_id", userId).single();
    if (again) return again as unknown as UserEmailPreferencesRow;
  }

  console.warn("[email_prefs] insert failed", { user_id: userId, message: insErr?.message });
  return mergeWithDefaults(userId, null);
}

/**
 * Loads prefs for reminder runners: fills missing users via get-or-create so `unsubscribe_token` exists for email footers.
 */
export async function loadEmailPreferencesMapForReminderUsers(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, UserEmailPreferencesRow>> {
  const map = await fetchUserEmailPreferencesMap(supabase, userIds);
  const unique = [...new Set(userIds.filter(Boolean))];
  for (const uid of unique) {
    if (!map.has(uid)) {
      const row = await getOrCreateUserEmailPreferences(supabase, uid);
      map.set(uid, row);
    }
  }
  return map;
}

export async function fetchUserEmailPreferencesMap(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, UserEmailPreferencesRow>> {
  const map = new Map<string, UserEmailPreferencesRow>();
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return map;

  const { data, error } = await supabase.from("user_email_preferences").select(PREF_SELECT).in("user_id", unique);

  if (error) {
    console.warn("[email_prefs] batch select failed", { message: error.message });
    return map;
  }

  for (const row of (data ?? []) as unknown as UserEmailPreferencesRow[]) {
    if (row?.user_id) map.set(row.user_id, row);
  }
  return map;
}

/**
 * Whether an email of this type may be enqueued/sent to a user, given preference row (or null = defaults).
 */
export function canSendEmailTypeToUser(type: EmailJobType, prefs: UserEmailPreferencesRow | null, userId: string): boolean {
  const category = getEmailTypeCategory(type);
  if (category === "required_transactional" || category === "admin_alert") {
    return true;
  }

  const p = mergeWithDefaults(userId, prefs);

  if (p.unsubscribed_all_optional) {
    return false;
  }

  if (category === "optional_reminder") {
    return p.reminder_emails_enabled;
  }

  if (category === "optional_marketing") {
    return p.marketing_emails_enabled;
  }

  return true;
}

export type UnsubscribeAction = "reminder_emails_off" | "all_optional_off";

/**
 * Service-role (or definer) client: update preferences by secret link token. Does not throw on missing token.
 */
export async function applyUnsubscribeByToken(
  supabase: SupabaseClient,
  token: string,
  action: UnsubscribeAction,
): Promise<{ ok: true } | { ok: false; reason: "invalid_token" }> {
  const t = token.trim();
  if (!t || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t)) {
    return { ok: false, reason: "invalid_token" };
  }

  const nowIso = new Date().toISOString();

  if (action === "all_optional_off") {
    const { data, error } = await supabase
      .from("user_email_preferences")
      .update({
        unsubscribed_all_optional: true,
        reminder_emails_enabled: false,
        marketing_emails_enabled: false,
        organizer_update_emails_enabled: false,
        updated_at: nowIso,
      })
      .eq("unsubscribe_token", t)
      .select("user_id")
      .maybeSingle();

    if (error || !data?.user_id) {
      return { ok: false, reason: "invalid_token" };
    }
    return { ok: true };
  }

  const { data, error } = await supabase
    .from("user_email_preferences")
    .update({
      reminder_emails_enabled: false,
      updated_at: nowIso,
    })
    .eq("unsubscribe_token", t)
    .select("user_id")
    .maybeSingle();

  if (error || !data?.user_id) {
    return { ok: false, reason: "invalid_token" };
  }
  return { ok: true };
}
