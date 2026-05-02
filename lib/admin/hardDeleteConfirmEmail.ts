import type { SupabaseClient } from "@supabase/supabase-js";

const BAD_CONFIRM_BG = "Потвърдете с точния имейл на потребителя.";

/**
 * Ensures `public.users.email` is set (lazy mirror from Auth when missing), then re-reads from DB
 * and compares `confirm_email` case-insensitively. Destructive routes must not trust client display.
 */
export async function validateHardDeleteConfirmEmailFromUsersTable(
  adminClient: SupabaseClient,
  userId: string,
  confirmEmail: string,
): Promise<{ ok: true; dbEmail: string } | { ok: false; status: number; message: string }> {
  const syncResult = await ensureUsersRowEmailFromDbOrAuth(adminClient, userId);
  if (!syncResult.ok) {
    return syncResult;
  }

  const { data: targetUser, error } = await adminClient
    .from("users")
    .select("email")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("[hardDeleteConfirmEmail] users re-select email", error);
    return { ok: false, status: 500, message: error.message };
  }

  const dbRaw = typeof targetUser?.email === "string" ? targetUser.email.trim() : "";
  if (!dbRaw) {
    return { ok: false, status: 400, message: BAD_CONFIRM_BG };
  }

  const confirm = confirmEmail.trim().toLowerCase();
  if (!confirm || dbRaw.toLowerCase() !== confirm) {
    return { ok: false, status: 400, message: BAD_CONFIRM_BG };
  }

  return { ok: true, dbEmail: dbRaw };
}

async function ensureUsersRowEmailFromDbOrAuth(
  adminClient: SupabaseClient,
  userId: string,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const { data: row, error } = await adminClient.from("users").select("email").eq("id", userId).maybeSingle();

  if (error) {
    console.error("[hardDeleteConfirmEmail] users select email", error);
    return { ok: false, status: 500, message: error.message };
  }

  const existing = typeof row?.email === "string" ? row.email.trim() : "";
  if (existing) {
    return { ok: true };
  }

  const { data: authData, error: authErr } = await adminClient.auth.admin.getUserById(userId);
  if (authErr || !authData.user) {
    return { ok: false, status: 404, message: "Not found" };
  }

  const authEmail = authData.user.email?.trim() ?? "";
  if (!authEmail) {
    return { ok: false, status: 400, message: BAD_CONFIRM_BG };
  }

  const { data: updated, error: upErr } = await adminClient
    .from("users")
    .update({ email: authEmail })
    .eq("id", userId)
    .select("id")
    .maybeSingle();

  if (upErr) {
    console.error("[hardDeleteConfirmEmail] users update email", upErr);
    return { ok: false, status: 500, message: upErr.message };
  }

  if (!updated) {
    const { error: insErr } = await adminClient.from("users").insert({ id: userId, email: authEmail });
    if (insErr) {
      console.error("[hardDeleteConfirmEmail] users insert email", insErr);
      return { ok: false, status: 500, message: insErr.message };
    }
  }

  return { ok: true };
}
