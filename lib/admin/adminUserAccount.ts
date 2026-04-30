import type { SupabaseClient } from "@supabase/supabase-js";
import { isStaffAdminRole } from "@/lib/admin/appRoles";

export async function fetchUserDeletedAtMap(
  adminClient: SupabaseClient,
  userIds: string[],
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  for (const id of userIds) {
    map.set(id, null);
  }
  if (userIds.length === 0) return map;

  const { data, error } = await adminClient.from("users").select("id, deleted_at").in("id", userIds);

  if (error) {
    throw new Error(`users: ${error.message}`);
  }

  for (const row of data ?? []) {
    const id = row.id as string;
    const del = (row as { deleted_at?: string | null }).deleted_at ?? null;
    map.set(id, del);
  }

  return map;
}

export async function countStaffAdminsExcluding(
  adminClient: SupabaseClient,
  excludeUserId: string,
): Promise<number> {
  const { data, error } = await adminClient
    .from("user_roles")
    .select("user_id")
    .in("role", ["admin", "super_admin"])
    .neq("user_id", excludeUserId);

  if (error) {
    throw new Error(`user_roles: ${error.message}`);
  }

  const ids = [...new Set((data ?? []).map((r) => r.user_id as string))];
  if (ids.length === 0) return 0;

  const deletedMap = await fetchUserDeletedAtMap(adminClient, ids);
  let n = 0;
  for (const id of ids) {
    if (!deletedMap.get(id)) {
      n += 1;
    }
  }
  return n;
}

export async function assertNotSoleOrganizerOwner(
  adminClient: SupabaseClient,
  targetUserId: string,
): Promise<void> {
  const { data: memberships, error: memErr } = await adminClient
    .from("organizer_members")
    .select("organizer_id, role, status")
    .eq("user_id", targetUserId)
    .eq("role", "owner")
    .eq("status", "active");

  if (memErr) {
    throw new Error(`organizer_members: ${memErr.message}`);
  }

  for (const m of memberships ?? []) {
    const orgId = m.organizer_id as string;
    const { data: owners, error: ownErr } = await adminClient
      .from("organizer_members")
      .select("user_id")
      .eq("organizer_id", orgId)
      .eq("role", "owner")
      .eq("status", "active");

    if (ownErr) {
      throw new Error(`organizer_members owners: ${ownErr.message}`);
    }

    const ownerIds = (owners ?? []).map((r) => r.user_id as string);
    if (ownerIds.length === 1 && ownerIds[0] === targetUserId) {
      throw new Error(
        "Този потребител е единственият активен собственик на организатор. Първо добавете друг собственик или прехвърлете правата.",
      );
    }
  }
}

export type DeleteGuardContext = {
  actorUserId: string;
  targetUserId: string;
};

export async function assertCanApplyDestructiveUserAction(
  adminClient: SupabaseClient,
  ctx: DeleteGuardContext,
  targetAppRole: string,
): Promise<void> {
  if (ctx.targetUserId === ctx.actorUserId) {
    throw new Error("Не можете да приложите това действие към собствения си акаунт.");
  }

  if (isStaffAdminRole(targetAppRole)) {
    const remaining = await countStaffAdminsExcluding(adminClient, ctx.targetUserId);
    if (remaining < 1) {
      throw new Error("Не може да се премахне последният администратор.");
    }
  }

  await assertNotSoleOrganizerOwner(adminClient, ctx.targetUserId);
}

export async function invalidateAuthSessions(adminClient: SupabaseClient, userId: string): Promise<void> {
  const { error } = await adminClient.rpc("admin_invalidate_auth_sessions", { target_user_id: userId });
  if (error) {
    throw new Error(`invalidate sessions: ${error.message}`);
  }
}

export async function setUserSoftDeleted(
  adminClient: SupabaseClient,
  userId: string,
  deleted: boolean,
): Promise<void> {
  if (deleted) {
    const { error } = await adminClient.from("users").upsert(
      { id: userId, deleted_at: new Date().toISOString() },
      { onConflict: "id" },
    );
    if (error) {
      throw new Error(`users soft delete: ${error.message}`);
    }
  } else {
    const { error } = await adminClient.from("users").upsert(
      { id: userId, deleted_at: null },
      { onConflict: "id" },
    );
    if (error) {
      throw new Error(`users restore: ${error.message}`);
    }
  }
}
