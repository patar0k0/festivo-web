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
  tokens?: string[];
};

/** Aggregated outcome from Expo Push API (also attached under `raw` for `sendPushToUser`). */
export type ExpoPushSendSummary = {
  success: number;
  failed: number;
  invalidTokens: string[];
};

const EXPO_PUSH_SEND_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_TOKEN_PREFIX = "ExponentPushToken";
const EXPO_BATCH_MAX = 100;

type ExpoPushTicket =
  | { status: "ok"; id: string }
  | { status: "error"; message?: string; details?: { error?: string } };

function expoTicketErrorCode(ticket: ExpoPushTicket): string {
  if (ticket.status !== "error") return "";
  const fromDetails = ticket.details?.error;
  if (fromDetails && typeof fromDetails === "string") return fromDetails;
  const msg = ticket.message;
  if (typeof msg === "string" && msg.includes("DeviceNotRegistered")) return "DeviceNotRegistered";
  return typeof msg === "string" && msg.length ? msg : "ExpoError";
}

function logExpoResponseErrors(raw: unknown, userId: string, notificationId: string | undefined): void {
  const errors = (raw as { errors?: unknown }).errors;
  if (!Array.isArray(errors)) return;
  for (const e of errors) {
    const code =
      typeof e === "object" && e !== null && "code" in e
        ? String((e as { code?: unknown }).code)
        : typeof e === "object" && e !== null && "errorCode" in e
          ? String((e as { errorCode?: unknown }).errorCode)
          : "";
    if (code === "MessageTooBig" || code === "InvalidCredentials") {
      console.warn("[push][expo][failed]", { userId, notification_id: notificationId, error: code, raw: e });
    }
  }
}

async function postExpoPushBatch(
  messages: Array<{ to: string; sound: string; title: string; body: string; data: Record<string, string> }>,
): Promise<{ httpOk: boolean; httpStatus: number; tickets: ExpoPushTicket[]; raw: unknown }> {
  const response = await fetch(EXPO_PUSH_SEND_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });

  const raw = (await response.json()) as {
    data?: ExpoPushTicket | ExpoPushTicket[];
    errors?: unknown;
  };

  if (!response.ok) {
    return { httpOk: false, httpStatus: response.status, tickets: [], raw };
  }

  const d = raw.data;
  let tickets: ExpoPushTicket[] = [];
  if (Array.isArray(d)) {
    tickets = d;
  } else if (d && typeof d === "object" && "status" in d) {
    tickets = [d as ExpoPushTicket];
  }

  return { httpOk: true, httpStatus: response.status, tickets, raw };
}

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

async function sendViaExpo(
  supabase: SupabaseClient,
  userId: string,
  tokens: string[],
  payload: NotificationPayloadV1,
): Promise<PushSendResult> {
  const expoTokens: string[] = [];
  for (const t of tokens) {
    const trimmed = t.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith(EXPO_TOKEN_PREFIX)) {
      expoTokens.push(trimmed);
    } else {
      console.info("[push][skipped]", {
        userId,
        reason: "non_expo_push_token",
        notification_id: payload.notification_id,
        token_prefix: trimmed.slice(0, 24),
      });
    }
  }

  if (!expoTokens.length) {
    console.info("[push][skipped]", {
      userId,
      reason: "no_valid_expo_push_tokens",
      notification_id: payload.notification_id,
    });
    const empty: ExpoPushSendSummary = { success: 0, failed: 0, invalidTokens: [] };
    return { ok: false, skipped: true, reason: "no_valid_expo_push_tokens", raw: empty };
  }

  const data = fcmDataPayload(payload);
  const messages = expoTokens.map((to) => ({
    to,
    sound: "default",
    title: payload.title,
    body: payload.body,
    data,
  }));

  console.info("[push][expo][start]", {
    userId,
    notification_id: payload.notification_id,
    token_count: expoTokens.length,
  });

  const t0 = Date.now();
  let success = 0;
  let failed = 0;
  const invalidTokens: string[] = [];
  const batchRaws: unknown[] = [];

  for (let offset = 0; offset < messages.length; offset += EXPO_BATCH_MAX) {
    const batch = messages.slice(offset, offset + EXPO_BATCH_MAX);
    const batchTokens = batch.map((m) => m.to);

    const send = await postExpoPushBatch(batch);
    batchRaws.push(send.raw);
    logExpoResponseErrors(send.raw, userId, payload.notification_id);

    if (!send.httpOk) {
      failed += batch.length;
      console.warn("[push][expo][failed]", {
        userId,
        notification_id: payload.notification_id,
        httpStatus: send.httpStatus,
        raw: send.raw,
      });
      continue;
    }

    if (send.tickets.length !== batchTokens.length) {
      console.warn("[push][expo][failed]", {
        userId,
        notification_id: payload.notification_id,
        reason: "expo_ticket_count_mismatch",
        expected: batchTokens.length,
        got: send.tickets.length,
      });
    }

    const results: FcmLegacyResult[] = [];
    for (let i = 0; i < batchTokens.length; i += 1) {
      const token = batchTokens[i];
      const ticket = send.tickets[i];

      if (!ticket) {
        failed += 1;
        results.push({ error: "MissingTicket" });
        console.warn("[push][expo][failed]", {
          userId,
          notification_id: payload.notification_id,
          error: "MissingTicket",
        });
        continue;
      }

      if (ticket.status === "ok") {
        success += 1;
        results.push({});
        continue;
      }

      failed += 1;
      const code = expoTicketErrorCode(ticket);
      results.push({ error: code });

      if (code === "DeviceNotRegistered") {
        invalidTokens.push(token);
        console.info("[push][expo][invalid_token]", {
          userId,
          notification_id: payload.notification_id,
        });
      } else {
        console.warn("[push][expo][failed]", {
          userId,
          notification_id: payload.notification_id,
          error: code,
        });
      }
    }

    await invalidateDeadTokens(supabase, userId, batchTokens, results);
  }

  const durationMs = Date.now() - t0;
  const summary: ExpoPushSendSummary = {
    success,
    failed,
    invalidTokens: [...new Set(invalidTokens)],
  };

  if (success > 0) {
    console.info("[push][expo][sent]", {
      userId,
      notification_id: payload.notification_id,
      duration_ms: durationMs,
      ...summary,
    });
    return {
      ok: true,
      raw: { ...summary, expo_batches: batchRaws },
      duration_ms: durationMs,
    };
  }

  console.warn("[push][expo][failed]", {
    userId,
    notification_id: payload.notification_id,
    duration_ms: durationMs,
    ...summary,
  });
  return {
    ok: false,
    raw: { ...summary, expo_batches: batchRaws },
    duration_ms: durationMs,
  };
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
    return { ok: false, skipped: false, error: tokenErr, tokens: [] };
  }

  if (!tokens.length) {
    console.info("[push][skipped]", { userId, reason: "no_tokens" });
    return { ok: false, skipped: true, reason: "no_tokens", tokens: [] };
  }

  // Explicit override (kill-switch / legacy single-provider deployments).
  const forcedProvider = (process.env.PUSH_PROVIDER || "").toLowerCase().trim();
  if (forcedProvider === "expo") {
    const res = await sendViaExpo(supabase, userId, tokens, payload);
    return { ...res, tokens };
  }
  if (forcedProvider === "fcm") {
    const res = await sendViaFcm(supabase, userId, tokens, payload);
    return { ...res, tokens };
  }
  if (forcedProvider) {
    console.warn("[push][skipped]", { userId, reason: "unknown_provider", provider: forcedProvider });
    return { ok: false, skipped: true, reason: "unknown_provider", raw: { provider: forcedProvider }, tokens };
  }

  // Default: route each token to its provider by token shape. A single user can
  // legitimately have both Expo tokens (mobile app) and raw FCM tokens, and the
  // old global default ("fcm") silently dropped every Expo token. Detecting per
  // token removes that whole class of silent push failures.
  const expoTokens = tokens.filter((t) => t.trim().startsWith(EXPO_TOKEN_PREFIX));
  const fcmTokens = tokens.filter((t) => !t.trim().startsWith(EXPO_TOKEN_PREFIX));

  const branches: PushSendResult[] = [];
  if (expoTokens.length) {
    branches.push(await sendViaExpo(supabase, userId, expoTokens, payload));
  }
  if (fcmTokens.length) {
    branches.push(await sendViaFcm(supabase, userId, fcmTokens, payload));
  }

  if (!branches.length) {
    console.info("[push][skipped]", { userId, reason: "no_tokens" });
    return { ok: false, skipped: true, reason: "no_tokens", tokens };
  }

  const ok = branches.some((b) => b.ok);
  const allSkipped = branches.every((b) => b.skipped);
  const durationMs = branches.reduce((sum, b) => sum + (b.duration_ms ?? 0), 0);

  return {
    ok,
    skipped: ok ? undefined : allSkipped,
    reason: ok ? undefined : branches.map((b) => b.reason).filter(Boolean).join(",") || undefined,
    raw: branches.map((b) => b.raw),
    duration_ms: durationMs || undefined,
    tokens,
  };
}
