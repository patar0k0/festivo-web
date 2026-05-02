import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppRole } from "@/lib/admin/appRoles";
import { isAppRoleValue } from "@/lib/admin/appRoles";
import { isStaffAdminRole } from "@/lib/admin/appRoles";
import { countStaffAdminsExcluding } from "@/lib/admin/adminUserAccount";
import { syncUserRoleToJwt } from "@/lib/auth/syncUserRoleToJwt";

export async function getUserAppRole(adminClient: SupabaseClient, userId: string): Promise<AppRole> {
  const { data, error } = await adminClient.from("user_roles").select("role").eq("user_id", userId).maybeSingle();

  if (error) {
    throw new Error(`user_roles: ${error.message}`);
  }

  const r = data?.role != null ? String(data.role) : "";
  if (isAppRoleValue(r)) {
    return r;
  }
  return "user";
}

export async function assertCanSetAppRole(
  adminClient: SupabaseClient,
  _actorUserId: string,
  targetUserId: string,
  nextRole: AppRole,
): Promise<void> {
  const current = await getUserAppRole(adminClient, targetUserId);
  if (isStaffAdminRole(current) && !isStaffAdminRole(nextRole)) {
    const remaining = await countStaffAdminsExcluding(adminClient, targetUserId);
    if (remaining < 1) {
      throw new Error("Не може да се премахне последният администратор.");
    }
  }
}

export async function persistUserAppRole(adminClient: SupabaseClient, userId: string, role: AppRole): Promise<void> {
  if (role === "user") {
    const { error } = await adminClient.from("user_roles").delete().eq("user_id", userId);
    if (error) {
      throw new Error(`user_roles: ${error.message}`);
    }
    await syncUserRoleToJwt(userId);
    return;
  }

  const { error } = await adminClient.from("user_roles").upsert({ user_id: userId, role }, { onConflict: "user_id" });
  if (error) {
    throw new Error(`user_roles: ${error.message}`);
  }
  await syncUserRoleToJwt(userId);
}
