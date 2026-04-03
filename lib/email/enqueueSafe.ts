import type { SupabaseClient } from "@supabase/supabase-js";

import type { EnqueueEmailJobInput } from "./enqueueEmail";
import { enqueueEmailJob } from "./enqueueEmail";
import { getEmailAdmin } from "./config";

/**
 * Enqueue without breaking the caller flow. Logs failures at error level.
 */
export async function enqueueEmailJobSafe(
  supabase: SupabaseClient,
  input: EnqueueEmailJobInput,
  logLabel: string,
): Promise<void> {
  try {
    await enqueueEmailJob(supabase, input);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[email_jobs] enqueue failed (${logLabel})`, { message, type: input.type });
  }
}

/**
 * Admin inbox alert: no-op when `EMAIL_ADMIN` is unset (info log, not an error).
 */
export async function enqueueAdminEmailJobSafe(
  supabase: SupabaseClient,
  input: Omit<EnqueueEmailJobInput, "recipientEmail"> & { recipientEmail?: string },
  logLabel: string,
): Promise<void> {
  const adminEmail = getEmailAdmin();
  if (!adminEmail) {
    console.info(`[email_jobs] skip admin enqueue (${logLabel}): EMAIL_ADMIN not set`, {
      type: input.type,
    });
    return;
  }
  await enqueueEmailJobSafe(
    supabase,
    { ...input, recipientEmail: adminEmail },
    logLabel,
  );
}
