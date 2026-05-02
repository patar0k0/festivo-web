import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

function staffRoleFromRows(roles: { role: string }[] | null | undefined): string | null {
  if (roles?.some((r) => r.role === "super_admin")) {
    return "super_admin";
  }
  if (roles?.some((r) => r.role === "admin")) {
    return "admin";
  }
  return null;
}

/**
 * Mirrors `public.user_roles` staff roles into Auth `app_metadata.role` for JWT fast-path checks.
 * Merges into existing `app_metadata` so other keys are preserved.
 */
export async function syncUserRoleToJwt(userId: string) {
  const admin = createSupabaseAdmin();

  const { data: roles, error } = await admin.from("user_roles").select("role").eq("user_id", userId);

  if (error) {
    throw new Error(`syncUserRoleToJwt: user_roles: ${error.message}`);
  }

  const role = staffRoleFromRows(roles);

  const { data: authData, error: getErr } = await admin.auth.admin.getUserById(userId);
  if (getErr || !authData?.user) {
    throw getErr ?? new Error("syncUserRoleToJwt: getUserById returned no user");
  }

  const prev = { ...(authData.user.app_metadata ?? {}) } as Record<string, unknown>;
  const app_metadata =
    role === null ? { ...prev, role: null as unknown } : { ...prev, role };

  const { error: upErr } = await admin.auth.admin.updateUserById(userId, {
    app_metadata,
  });
  if (upErr) {
    throw upErr;
  }
}
