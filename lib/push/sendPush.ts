import type { SupabaseClient } from "@supabase/supabase-js";

import type { NotificationPayloadV1 } from "@/lib/notifications/types";

export type FcmLegacyResult = {
  message_id?: string;
  error?: string;
};

type FcmLegacyResponse = {
  failure?: number;
  success?: number;
  results?: FcmLegacyResult[];
};

export type PushSendResult = {
  ok: boolean;
  /** True when we intentionally did not call a provider (no tokens, kill switch, etc.). */
  skipped?: boolean;
  /** Machine reason for skip or provider branch. */
  reason?: string;
  raw?: unknown;
  results?: FcmLegacyResult[];
  duration_ms?: number;
  /** Supabase / token query failure — caller should retry the job. */
  error?: string;
};

const PERMANENT_TOKEN_ERROR =
  /NotRegistered|InvalidRegistration|MismatchSenderId|InvalidPackageName|Unregistered|NotFound|InvalidApnsCredentials/i;

function fcmDataPayload(data: NotificationPayloadV1): Record<string, string> {
  const priority = data.priority ?? "normal";
  const notificationType = data.notification_type ?? data.type;
  const out: Record<string, string> = {
    type: String(data.type),
    festival_id: String(data.festival_id),
    slug: String(data.slug),
    deep_link: String(data.deep_link),
    title: String(data.title),
    body: String(data.body),
    source: data.source ?? "push",
    notification_type: String(notificationType),
    priority: String(priority),
  };

  if (data.notification_id) {
    out.notification_id = String(data.notification_id);
  }

  return out;
}

/** Legacy FCM HTTP API (registration_ids). */
export async function sendFcmToTokensInternal(
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
      data: fcmDataPayload(data),
    }),
  });

  const raw = (await response.json()) as FcmLegacyResponse;

  if (!response.ok) {
    return { ok: false, raw };
  }

  const success = raw.success ?? 0;
  return { ok: success > 0, raw, results: raw.results };
}

export function getFcmServerKey(): string | null {
  const key = process.env.FCM_SERVER_KEY;
  return key?.trim() ? key : null;
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
    if (PERMANENT_TOKEN_ERROR.test(err)) {
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
      console.warn("[push] invalidate token failed", { userId, message: error.message });
    }
  }
}

/**
 * Active device tokens for push (invalidated rows excluded).
 * Returns DB error string if the query failed.
 */
export async function getUserPushTokens(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ tokens: string[]; error: string | null }> {
  const { data: tokenRows, error: tokenErr } = await supabase
    .from("device_tokens")
    .select("token,invalidated_at")
    .eq("user_id", userId);

  if (tokenErr) {
    return { tokens: [], error: tokenErr.message };
  }

  const tokens = (tokenRows ?? [])
    .filter((r: { invalidated_at?: string | null }) => !r.invalidated_at)
    .map((r: { token: string }) => r.token.trim())
    .filter(Boolean);

  return { tokens, error: null };
}

async function sendViaFcm(
  supabase: SupabaseClient,
  userId: string,
  tokens: string[],
  payload: NotificationPayloadV1,
): Promise<PushSendResult> {
  const fcmKey = getFcmServerKey();
  if (!fcmKey) {
    console.info("[push][skipped]", {
      userId,
      reason: "fcm_not_configured",
      notification_id: payload.notification_id,
    });
    return { ok: false, skipped: true, reason: "fcm_not_configured" };
  }

  const t0 = Date.now();
  const sendResult = await sendFcmToTokensInternal(
    tokens,
    payload.title,
    payload.body,
    payload,
    fcmKey,
  );
  const durationMs = Date.now() - t0;
  await invalidateDeadTokens(supabase, userId, tokens, sendResult.results);

  if (sendResult.ok) {
    console.info("[push][sent]", {
      userId,
      notification_id: payload.notification_id,
      duration_ms: durationMs,
    });
    return { ok: true, raw: sendResult.raw, results: sendResult.results, duration_ms: durationMs };
  }

  console.warn("[push][failed]", {
    userId,
    notification_id: payload.notification_id,
    duration_ms: durationMs,
    raw: sendResult.raw,
  });
  return { ok: false, raw: sendResult.raw, results: sendResult.results, duration_ms: durationMs };
}

/** Placeholder for Expo Push API integration (see TODO in repo docs). */
async function sendViaExpo(
  _supabase: SupabaseClient,
  userId: string,
  _tokens: string[],
  payload: NotificationPayloadV1,
): Promise<PushSendResult> {
  console.warn("[push][skipped]", {
    userId,
    reason: "expo_not_implemented",
    notification_id: payload.notification_id,
  });
  return { ok: false, skipped: true, reason: "expo_not_implemented", raw: { error: "expo_stub" } };
}

export type SendPushToUserOptions = {
  /** When false, skips send (user_notification_settings.push_enabled). */
  pushEnabled?: boolean;
};

/**
 * Load tokens, choose provider from env, send push. Does not throw on send failure;
 * returns structured result. May throw only on unexpected internal errors (avoid in callers).
 */
export async function sendPushToUser(
  supabase: SupabaseClient,
  userId: string,
  payload: NotificationPayloadV1,
  options?: SendPushToUserOptions,
): Promise<PushSendResult> {
  if (options?.pushEnabled === false) {
    console.info("[push][skipped]", { userId, reason: "user_push_disabled" });
    return { ok: false, skipped: true, reason: "user_push_disabled" };
  }

  if (process.env.PUSH_ENABLED === "false") {
    console.info("[push][skipped]", { userId, reason: "push_globally_disabled" });
    return { ok: false, skipped: true, reason: "push_globally_disabled" };
  }

  console.info("[push][start]", { userId, notification_id: payload.notification_id });

  const { tokens, error: tokenErr } = await getUserPushTokens(supabase, userId);
  if (tokenErr) {
    console.error("[push][failed]", { userId, reason: "token_load", message: tokenErr });
    return { ok: false, skipped: false, error: tokenErr };
  }

  if (!tokens.length) {
    console.info("[push][skipped]", { userId, reason: "no_tokens" });
    return { ok: false, skipped: true, reason: "no_tokens" };
  }

  const provider = (process.env.PUSH_PROVIDER || "fcm").toLowerCase().trim();

  if (provider === "expo") {
    return sendViaExpo(supabase, userId, tokens, payload);
  }

  if (provider === "fcm") {
    return sendViaFcm(supabase, userId, tokens, payload);
  }

  console.warn("[push][skipped]", { userId, reason: "unknown_provider", provider });
  return { ok: false, skipped: true, reason: "unknown_provider", raw: { provider } };
}
