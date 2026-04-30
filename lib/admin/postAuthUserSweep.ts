import type { SupabaseClient } from "@supabase/supabase-js";

export type PostAuthUserSweepResult = {
  organizer_members_deleted: number;
  user_roles_deleted: number;
  reminders_deleted: number;
  devices_deleted: number;
  sessions_deleted: number;
  users_deleted: number;
};

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export function parsePostAuthUserSweepResult(raw: unknown): PostAuthUserSweepResult | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    organizer_members_deleted: num(o.organizer_members_deleted),
    user_roles_deleted: num(o.user_roles_deleted),
    reminders_deleted: num(o.reminders_deleted),
    devices_deleted: num(o.devices_deleted),
    sessions_deleted: num(o.sessions_deleted),
    users_deleted: num(o.users_deleted),
  };
}

function totalDeletes(s: PostAuthUserSweepResult): number {
  return (
    s.organizer_members_deleted +
    s.user_roles_deleted +
    s.reminders_deleted +
    s.devices_deleted +
    s.sessions_deleted +
    s.users_deleted
  );
}

export type SweepLogContext = {
  label: string;
  userId: string;
  /** When false, all-zero counts only emit a debug log (idempotent re-sweep). */
  warnOnAllZero?: boolean;
};

/**
 * Runs `admin_sweep_user_after_auth_delete` with a short retry if the RPC errors (transient).
 */
export async function postAuthUserSweep(
  admin: SupabaseClient,
  userId: string,
  logCtx?: SweepLogContext,
): Promise<PostAuthUserSweepResult> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 80 * attempt));
    }
    const { data, error } = await admin.rpc("admin_sweep_user_after_auth_delete", { p_user_id: userId });
    if (!error) {
      const parsed = parsePostAuthUserSweepResult(data);
      if (!parsed) {
        console.error("[postAuthUserSweep] unparseable RPC result", { userId, data, label: logCtx?.label });
        throw new Error("post-auth sweep: invalid RPC payload");
      }
      if (logCtx) {
        console.info("[postAuthUserSweep]", logCtx.label, { userId, ...parsed });
        const sum = totalDeletes(parsed);
        if (sum === 0 && logCtx.warnOnAllZero !== false) {
          console.warn("[postAuthUserSweep] zero row deletes (idempotent or already clean)", {
            userId,
            label: logCtx.label,
          });
        }
      }
      return parsed;
    }
    lastErr = new Error(error.message);
  }
  throw new Error(`post-auth sweep: ${lastErr?.message ?? "failed after retries"}`);
}
