import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationPayloadV1 } from "./types";

type FcmLegacyResult = {
  message_id?: string;
  error?: string;
};

type FcmLegacyResponse = {
  failure?: number;
  success?: number;
  results?: FcmLegacyResult[];
};

const MAX_RETRIES = 3;

export async function sendFcmToTokens(
  tokens: string[],
  title: string,
  body: string,
  data: NotificationPayloadV1,
  fcmServerKey: string,
): Promise<{ ok: boolean; raw: unknown; results?: FcmLegacyResult[] }> {
  if (!tokens.length) {
    return { ok: false, raw: { error: "no_tokens" } };
  }

  const response = await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      Authorization: `key=${fcmServerKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      registration_ids: tokens,
      notification: { title, body },
      data: {
        type: data.type,
        festival_id: data.festival_id,
        slug: data.slug,
        deep_link: data.deep_link,
        title: data.title,
        body: data.body,
      },
    }),
  });

  const raw = (await response.json()) as FcmLegacyResponse;

  if (!response.ok) {
    return { ok: false, raw };
  }

  const success = raw.success ?? 0;
  return { ok: success > 0, raw, results: raw.results };
}

export async function invalidateDeadTokens(
  supabase: SupabaseClient,
  userId: string,
  tokens: string[],
  results: FcmLegacyResult[] | undefined,
): Promise<void> {
  if (!results || results.length !== tokens.length) {
    return;
  }

  const dead = new Set<string>();
  for (let i = 0; i < tokens.length; i += 1) {
    const err = results[i]?.error;
    if (!err) continue;
    if (/NotRegistered|InvalidRegistration|MismatchSenderId/i.test(err)) {
      dead.add(tokens[i]);
    }
  }

  if (!dead.size) {
    return;
  }

  const now = new Date().toISOString();
  for (const token of dead) {
    const { error } = await supabase
      .from("device_tokens")
      .update({ invalidated_at: now })
      .eq("user_id", userId)
      .eq("token", token);

    if (error) {
      console.warn("[notifications] invalidate token failed", { userId, message: error.message });
    }
  }
}

export function getFcmServerKey(): string | null {
  const key = process.env.FCM_SERVER_KEY;
  return key?.trim() ? key : null;
}

export { MAX_RETRIES };
