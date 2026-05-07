import type { SupabaseClient } from "@supabase/supabase-js";

type LockResult =
  | { ok: true; lockToken: string }
  | { ok: false; reason: "lock_active" }
  | { ok: false; reason: "error"; message: string };

export async function acquireCronLock(
  supabase: SupabaseClient,
  name: string,
  now: Date,
  staleAfterMinutes = 10,
): Promise<LockResult> {
  const lockToken = now.toISOString();
  const lockCutoff = new Date(now.getTime() - staleAfterMinutes * 60 * 1000).toISOString();
  const { data: existing, error: existingError } = await supabase
    .from("cron_locks")
    .select("locked_at")
    .eq("name", name)
    .maybeSingle();
  if (existingError) {
    return { ok: false, reason: "error", message: existingError.message };
  }

  if (existing?.locked_at && existing.locked_at >= lockCutoff) {
    return { ok: false, reason: "lock_active" };
  }

  if (existing?.locked_at) {
    const { error: staleLockError } = await supabase
      .from("cron_locks")
      .delete()
      .eq("name", name)
      .eq("locked_at", existing.locked_at);
    if (staleLockError) {
      return { ok: false, reason: "error", message: staleLockError.message };
    }
  }

  const { error: insertError } = await supabase
    .from("cron_locks")
    .insert({ name, locked_at: lockToken });

  if (insertError) {
    if (insertError.code === "23505") {
      return { ok: false, reason: "lock_active" };
    }
    return { ok: false, reason: "error", message: insertError.message };
  }

  return { ok: true, lockToken };
}

export async function releaseCronLock(
  supabase: SupabaseClient,
  name: string,
  lockToken?: string,
): Promise<void> {
  let query = supabase.from("cron_locks").delete().eq("name", name);
  if (lockToken) {
    query = query.eq("locked_at", lockToken);
  }
  await query;
}
