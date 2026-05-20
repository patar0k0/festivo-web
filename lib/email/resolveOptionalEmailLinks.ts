import type { SupabaseClient } from "@supabase/supabase-js";

import { getBaseUrl } from "@/lib/config/baseUrl";
import { getOrCreateUserEmailPreferences } from "./emailPreferences";

export type OptionalEmailLinks = {
  unsubscribeUrl: string;
  managePreferencesUrl: string;
};

/**
 * Resolve the unsubscribe + manage-preferences URLs for a given user.
 *
 * Provisions a `user_email_preferences` row on first call (server-side worker
 * uses service_role, so RLS is not an obstacle). Returns null when:
 *   - no userId provided
 *   - row exists but has no unsubscribe_token (legacy data or insert failure)
 *
 * Callers should fall back to "no footer links" rather than fail the send.
 */
export async function resolveOptionalEmailLinks(
  supabase: SupabaseClient,
  userId: string | null | undefined,
): Promise<OptionalEmailLinks | null> {
  const uid = userId?.trim();
  if (!uid) return null;

  let token: string;
  try {
    const prefs = await getOrCreateUserEmailPreferences(supabase, uid);
    token = prefs.unsubscribe_token?.trim() ?? "";
  } catch {
    return null;
  }

  if (!token) return null;

  const base = getBaseUrl().replace(/\/$/, "");
  return {
    unsubscribeUrl: `${base}/unsubscribe/${token}`,
    managePreferencesUrl: `${base}/profile`,
  };
}
