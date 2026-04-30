import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { AppRole } from "@/lib/admin/appRoles";
import { isStaffAdminRole } from "@/lib/admin/appRoles";
import { fetchUserDeletedAtMap } from "@/lib/admin/adminUserAccount";

export const ADMIN_USERS_LIST_CHUNK = 150;

export type AdminUserListRow = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  banned_until: string | null;
  provider: string;
  is_admin: boolean;
  app_role: AppRole;
  deleted_at: string | null;
  full_name: string | null;
  organizer_count: number;
  pending_claim_count: number;
};

export function chunkIds<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

export function emailLocalPart(email: string | null | undefined): string {
  if (!email) return "—";
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at) : email;
}

export function providerKey(user: User): string {
  const raw = user.app_metadata?.provider;
  if (raw == null || raw === "") return "email";
  return String(raw).toLowerCase();
}

export type AdminUserListEnrich = {
  is_admin: boolean;
  app_role: AppRole;
  deleted_at: string | null;
  organizer_count: number;
  pending_claim_count: number;
};

export async function enrichUsersForAdminList(
  adminClient: SupabaseClient,
  userIds: string[],
): Promise<Map<string, AdminUserListEnrich>> {
  const map = new Map<string, AdminUserListEnrich>();
  for (const id of userIds) {
    map.set(id, {
      is_admin: false,
      app_role: "user",
      deleted_at: null,
      organizer_count: 0,
      pending_claim_count: 0,
    });
  }

  const chunks = chunkIds(userIds, ADMIN_USERS_LIST_CHUNK);

  for (const ids of chunks) {
    if (ids.length === 0) continue;

    const deletedMap = await fetchUserDeletedAtMap(adminClient, ids);
    for (const id of ids) {
      const cur = map.get(id);
      if (cur) cur.deleted_at = deletedMap.get(id) ?? null;
    }

    const { data: roles, error: rolesError } = await adminClient
      .from("user_roles")
      .select("user_id,role")
      .in("user_id", ids);

    if (rolesError) {
      throw new Error(`user_roles: ${rolesError.message}`);
    }

    for (const row of roles ?? []) {
      const cur = map.get(row.user_id as string);
      if (!cur) continue;
      const r = String(row.role ?? "");
      cur.app_role = r === "user" || r === "organizer" || r === "admin" || r === "super_admin" ? r : "user";
      cur.is_admin = isStaffAdminRole(cur.app_role);
    }

    const { data: members, error: membersError } = await adminClient
      .from("organizer_members")
      .select("user_id,status")
      .in("user_id", ids);

    if (membersError) {
      throw new Error(`organizer_members: ${membersError.message}`);
    }

    for (const row of members ?? []) {
      const cur = map.get(row.user_id as string);
      if (!cur) continue;
      if (row.status === "active") cur.organizer_count += 1;
      if (row.status === "pending") cur.pending_claim_count += 1;
    }
  }

  return map;
}

function displayNameFromUser(user: User): string | null {
  const meta = user.user_metadata;
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    const fn = (meta as Record<string, unknown>)["full_name"];
    if (typeof fn === "string" && fn.trim()) return fn.trim();
  }
  return null;
}

export function userToAdminListRow(user: User, enrich: AdminUserListEnrich): AdminUserListRow {
  return {
    id: user.id,
    email: user.email ?? null,
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at ?? null,
    email_confirmed_at: user.email_confirmed_at ?? null,
    banned_until: user.banned_until ?? null,
    provider: providerKey(user),
    is_admin: enrich.is_admin,
    app_role: enrich.app_role,
    deleted_at: enrich.deleted_at,
    full_name: displayNameFromUser(user),
    organizer_count: enrich.organizer_count,
    pending_claim_count: enrich.pending_claim_count,
  };
}

export function emailMatchesQuery(email: string | null | undefined, q: string): boolean {
  if (!email) return false;
  return email.toLowerCase().includes(q.trim().toLowerCase());
}

export function nameMatchesQuery(user: User, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return false;
  const n = displayNameFromUser(user);
  return Boolean(n && n.toLowerCase().includes(needle));
}

const STALE_LOGIN_MS = 90 * 24 * 60 * 60 * 1000;

export function userMatchesLastLoginFilter(
  user: User,
  lastLogin: "recent" | "stale" | "" | "all",
): boolean {
  return lastSignInMatchesLastLoginFilter(user.last_sign_in_at ?? null, lastLogin);
}

export function lastSignInMatchesLastLoginFilter(
  lastSignInAt: string | null,
  lastLogin: "recent" | "stale" | "" | "all",
): boolean {
  if (lastLogin !== "recent" && lastLogin !== "stale") return true;
  if (!lastSignInAt) {
    return lastLogin === "stale";
  }
  const t = new Date(lastSignInAt).getTime();
  if (!Number.isFinite(t)) {
    return lastLogin === "stale";
  }
  const recent = Date.now() - t < STALE_LOGIN_MS;
  return lastLogin === "recent" ? recent : !recent;
}
