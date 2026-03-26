import type { SupabaseClient } from "@supabase/supabase-js";

type LockResult =
  | { ok: true }
  | { ok: false; reason: "lock_active" }
  | { ok: false; reason: "error"; message: string };

export async function acquireCronLock(
  supabase: SupabaseClient,
  name: string,
  now: Date,
  staleAfterMinutes = 10,
): Promise<LockResult> {
  const lockCutoff = new Date(now.getTime() - staleAfterMinutes * 60 * 1000).toISOString();
  const { error: staleLockError } = await supabase.from("cron_locks").delete().lt("locked_at", lockCutoff);
  if (staleLockError) {
    return { ok: false, reason: "error", message: staleLockError.message };
  }

  const { data: lockRows, error: lockError } = await supabase
    .from("cron_locks")
    .upsert({ name, locked_at: now.toISOString() }, { onConflict: "name", ignoreDuplicates: true })
    .select("name");

  if (lockError) {
    return { ok: false, reason: "error", message: lockError.message };
  }

  if (!lockRows?.length) {
    return { ok: false, reason: "lock_active" };
  }

  return { ok: true };
}

export async function releaseCronLock(supabase: SupabaseClient, name: string): Promise<void> {
  await supabase.from("cron_locks").delete().eq("name", name);
}
